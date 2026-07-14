import * as Sentry from "@sentry/nextjs";
import { count, eq, sql } from "drizzle-orm";
import { db } from "@/app/db";
import {
  activeJobs, heatmapCache, attnCache, dlaCache,
  attributionCache, activationPatchCache, steeringCache,
} from "@/app/schema";
import { putHeatmap } from "@/app/lib/r2";
import { deductJobCost } from "@/app/lib/credits";

/**
 * Max concurrent GPU jobs per user. checkBalance() only guarantees balance for a
 * single job's floor cost, so without this cap a user could spawn unbounded
 * parallel jobs before any deduction lands.
 */
export const MAX_ACTIVE_JOBS_PER_USER = 3;

/** Jobs still "running" after this long are presumed hung and cancelled by the sweeper. */
export const JOB_HARD_TIMEOUT_MS = 30 * 60 * 1000;

export type ActiveJob = typeof activeJobs.$inferSelect;

export async function countActiveJobs(userId: string): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(activeJobs)
    .where(eq(activeJobs.userId, userId));
  return row?.c ?? 0;
}

export type NewActiveJob = {
  id: string;
  userId: string;
  gpuTier: string;
  jobType: string;
  modelName: string;
  cacheKey: string | null;
  cachePayload: string;
};

/**
 * Insert an active-job row only while the user is still under
 * MAX_ACTIVE_JOBS_PER_USER — atomically. Returns true if the slot was claimed,
 * false if the user was already at the cap (caller must then not run the job).
 *
 * Why the advisory lock instead of a bare `insert ... where (count) < cap`:
 * neon-http runs every statement as its own READ COMMITTED autocommit
 * transaction, so two concurrent spawns each read `count = cap - 1` against their
 * own snapshot and both insert — the cap leaks under deliberate concurrency
 * (fire N spawns at once). A per-user `pg_advisory_xact_lock`, held for the
 * duration of this one statement, serializes the count-and-insert so the check is
 * truly atomic. `insert ... select from reservation` forces the lock CTE to be
 * evaluated (lock acquired) before the count subquery in the WHERE runs.
 */
export async function insertActiveJobIfUnderCap(job: NewActiveJob): Promise<boolean> {
  const res = await db.execute(sql`
    with reservation as (
      select pg_advisory_xact_lock(hashtext(${job.userId}))
    )
    insert into active_jobs (id, user_id, gpu_tier, job_type, model_name, cache_key, cache_payload, started_at)
    select ${job.id}, ${job.userId}, ${job.gpuTier}, ${job.jobType}, ${job.modelName}, ${job.cacheKey}, ${job.cachePayload}, now()
    from reservation
    where (select count(*) from active_jobs where user_id = ${job.userId}) < ${MAX_ACTIVE_JOBS_PER_USER}
    returning id
  `);
  return res.rows.length > 0;
}

/**
 * Atomically claim a job row for settlement. Exactly one caller (concurrent
 * polls, poll vs. sweeper, poll vs. cancel) wins; everyone else must not bill.
 */
async function claimJob(jobId: string): Promise<boolean> {
  const deleted = await db
    .delete(activeJobs)
    .where(eq(activeJobs.id, jobId))
    .returning({ id: activeJobs.id });
  return deleted.length > 0;
}

function elapsedMs(job: ActiveJob): number {
  return Math.max(0, Date.now() - new Date(job.startedAt).getTime());
}

// A failed deduction is silently lost revenue — the job row is already claimed,
// so nothing will retry it. Make sure it reaches Sentry, not just the log.
function reportBillingError(job: ActiveJob) {
  return (err: unknown) => {
    console.error(`Billing deduction failed for job ${job.id}:`, err);
    Sentry.captureException(err, { extra: { jobId: job.id, userId: job.userId, gpuTier: job.gpuTier } });
  };
}

/**
 * Settle a job whose backend status is no longer "running": claim the row,
 * bill GPU time on success, and write the result to the cache.
 * Failed jobs are not billed. Safe to call from multiple places concurrently.
 *
 * Billing prefers the backend-metered usage (wall time incl. boot and
 * scaledown attribution, CPU core-seconds, memory GiB-seconds — i.e. exactly
 * what Modal bills us) over spawn→settle wall clock, which includes unbilled
 * queue time and overshoots badly when the sweeper discovers a job long after
 * it finished. Wall clock is only the fallback for jobs spawned before the
 * backend reported usage.
 */
export async function settleJob(
  job: ActiveJob,
  result: { status: string; data?: unknown; duration_ms?: number; cpu_core_s?: number; mem_gib_s?: number }
): Promise<void> {
  if (!(await claimJob(job.id))) return;
  if (result.status !== "done") return;

  const billedMs = typeof result.duration_ms === "number" && result.duration_ms >= 0
    ? result.duration_ms
    : elapsedMs(job);
  await deductJobCost(job.userId, job.gpuTier, billedMs, {
    cpuCoreS: result.cpu_core_s,
    memGibS: result.mem_gib_s,
  }).catch(reportBillingError(job));

  if (job.cacheKey && result.data) {
    const payload = job.cachePayload ? JSON.parse(job.cachePayload) as Record<string, string> : {};
    try {
      await putHeatmap(job.cacheKey, result.data);
      if (job.jobType === "lens") {
        await db.insert(heatmapCache).values({ id: job.cacheKey, prompt: payload.prompt, modelName: payload.modelName, userId: job.userId, r2Key: job.cacheKey }).onConflictDoNothing();
      } else if (job.jobType === "attn") {
        await db.insert(attnCache).values({ id: job.cacheKey, modelName: payload.modelName, prompt: payload.prompt, userId: job.userId, r2Key: job.cacheKey }).onConflictDoNothing();
      } else if (job.jobType === "dla") {
        await db.insert(dlaCache).values({ id: job.cacheKey, modelName: payload.modelName, prompt: payload.prompt, targetPosition: payload.targetPosition, targetToken: payload.targetToken, userId: job.userId, r2Key: job.cacheKey }).onConflictDoNothing();
      } else if (job.jobType === "attribution") {
        await db.insert(attributionCache).values({ id: job.cacheKey, modelName: payload.modelName, prompt: payload.prompt, corruptedPrompt: payload.corruptedPrompt, targetPosition: payload.targetPosition, targetToken: payload.targetToken, userId: job.userId, r2Key: job.cacheKey }).onConflictDoNothing();
      } else if (job.jobType === "activation-patch") {
        await db.insert(activationPatchCache).values({ id: job.cacheKey, modelName: payload.modelName, cleanPrompt: payload.cleanPrompt, corruptedPrompt: payload.corruptedPrompt, userId: job.userId, r2Key: job.cacheKey }).onConflictDoNothing();
      } else if (job.jobType === "steering") {
        await db.insert(steeringCache).values({ id: job.cacheKey, modelName: payload.modelName, cleanPrompt: payload.cleanPrompt, corruptedPrompt: payload.corruptedPrompt, userId: job.userId, r2Key: job.cacheKey }).onConflictDoNothing();
      }
    } catch (err) {
      console.error("Cache write failed:", err);
      Sentry.captureException(err, { extra: { jobId: job.id, jobType: job.jobType } });
    }
  }
}

/**
 * Bill a job that was stopped before producing a result (user cancel or sweeper
 * timeout), charging only GPU execution time.
 *
 * `execStartedTsS` comes from the backend's heartbeat (epoch seconds):
 * - number  → execution began then; bill from there, not from spawn (spawn→exec
 *             gap is queue/cold-boot wait the user's job never ran during)
 * - null    → no heartbeat: the job never started executing (or the heartbeat
 *             was unreadable). Charge nothing — when in doubt, favor the user.
 * - undefined → caller has no heartbeat info (pre-heartbeat path); fall back to
 *             spawn→now wall clock as before.
 */
export async function billStoppedJob(job: ActiveJob, execStartedTsS?: number | null): Promise<void> {
  if (!(await claimJob(job.id))) return;
  let billedMs: number;
  if (execStartedTsS === null) billedMs = 0;
  else if (typeof execStartedTsS === "number") billedMs = Math.max(0, Date.now() - execStartedTsS * 1000);
  else billedMs = elapsedMs(job);
  if (billedMs <= 0) return;
  await deductJobCost(job.userId, job.gpuTier, billedMs).catch(reportBillingError(job));
}
