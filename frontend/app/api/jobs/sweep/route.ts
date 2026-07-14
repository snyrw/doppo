import { timingSafeEqual } from "node:crypto";
import { lt } from "drizzle-orm";
import { db } from "@/app/db";
import { activeJobs } from "@/app/schema";
import { backendFetch } from "@/app/lib/api-helpers";
import { settleJob, billStoppedJob, JOB_HARD_TIMEOUT_MS, type ActiveJob } from "@/app/lib/jobs";

/**
 * Settles jobs whose owner stopped polling (closed tab, network drop, abuse).
 * Without this, billing only happens via GET /api/job/[jobId] — a job nobody
 * polls runs to completion on our Modal bill and is never charged.
 *
 * Meant to be hit every few minutes by a cron (Railway cron, GitHub Actions
 * schedule, or any external pinger) with `Authorization: Bearer $CRON_SECRET`.
 */

// Leave fresh jobs to the normal polling path; only sweep ones old enough
// that the client has plausibly gone away.
const SWEEP_MIN_AGE_MS = 2 * 60 * 1000;
const SWEEP_BATCH_LIMIT = 50;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function sweepOne(job: ActiveJob): Promise<"settled" | "timed_out" | "skipped"> {
  const ageMs = Date.now() - new Date(job.startedAt).getTime();

  let result: { status: string; data?: unknown } | null = null;
  try {
    const pollRes = await backendFetch(`/api/job/${job.id}`, { retry: true });
    if (pollRes.ok) result = await pollRes.json() as { status: string; data?: unknown };
  } catch (err) {
    console.error(`Sweep poll failed for job ${job.id}:`, err);
  }

  if (result && result.status !== "running") {
    await settleJob(job, result);
    return "settled";
  }

  // Still running (or unpollable) past the hard timeout: cancel, then bill only
  // execution time (heartbeat-based) — not the queue/boot wait before it.
  if (ageMs > JOB_HARD_TIMEOUT_MS) {
    let execStartedTs: number | null | undefined = undefined;
    try {
      const res = await backendFetch(`/api/job/${job.id}`, { method: "DELETE", retry: true });
      if (res.ok) {
        const body = await res.json() as { exec_started_ts?: number | null };
        if ("exec_started_ts" in body) execStartedTs = body.exec_started_ts;
      }
    } catch (err) {
      console.error(err);
    }
    await billStoppedJob(job, execStartedTs);
    return "timed_out";
  }

  return "skipped";
}

async function handle(req: Request) {
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - SWEEP_MIN_AGE_MS);
  const stale = await db
    .select()
    .from(activeJobs)
    .where(lt(activeJobs.startedAt, cutoff))
    .limit(SWEEP_BATCH_LIMIT);

  const counts = { settled: 0, timed_out: 0, skipped: 0 };
  for (const job of stale) {
    counts[await sweepOne(job)] += 1;
  }

  return Response.json({ swept: stale.length, ...counts });
}

export { handle as GET, handle as POST };
