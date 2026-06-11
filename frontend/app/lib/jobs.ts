import * as Sentry from "@sentry/nextjs";
import { count, eq } from "drizzle-orm";
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
        await db.insert(heatmapCache).values({ id: job.cacheKey, prompt: payload.prompt, modelName: payload.modelName, r2Key: job.cacheKey }).onConflictDoNothing();
      } else if (job.jobType === "attn") {
        await db.insert(attnCache).values({ id: job.cacheKey, modelName: payload.modelName, prompt: payload.prompt, r2Key: job.cacheKey }).onConflictDoNothing();
      } else if (job.jobType === "dla") {
        await db.insert(dlaCache).values({ id: job.cacheKey, modelName: payload.modelName, prompt: payload.prompt, targetPosition: payload.targetPosition, targetToken: payload.targetToken, r2Key: job.cacheKey }).onConflictDoNothing();
      } else if (job.jobType === "attribution") {
        await db.insert(attributionCache).values({ id: job.cacheKey, modelName: payload.modelName, prompt: payload.prompt, corruptedPrompt: payload.corruptedPrompt, targetPosition: payload.targetPosition, targetToken: payload.targetToken, r2Key: job.cacheKey }).onConflictDoNothing();
      } else if (job.jobType === "activation-patch") {
        await db.insert(activationPatchCache).values({ id: job.cacheKey, modelName: payload.modelName, cleanPrompt: payload.cleanPrompt, corruptedPrompt: payload.corruptedPrompt, r2Key: job.cacheKey }).onConflictDoNothing();
      } else if (job.jobType === "steering") {
        await db.insert(steeringCache).values({ id: job.cacheKey, modelName: payload.modelName, cleanPrompt: payload.cleanPrompt, corruptedPrompt: payload.corruptedPrompt, r2Key: job.cacheKey }).onConflictDoNothing();
      }
    } catch (err) {
      console.error("Cache write failed:", err);
      Sentry.captureException(err, { extra: { jobId: job.id, jobType: job.jobType } });
    }
  }
}

/**
 * Bill a job that was stopped before producing a result (user cancel or sweeper
 * timeout). The GPU ran for the elapsed time either way.
 */
export async function billStoppedJob(job: ActiveJob): Promise<void> {
  if (!(await claimJob(job.id))) return;
  await deductJobCost(job.userId, job.gpuTier, elapsedMs(job)).catch(reportBillingError(job));
}
