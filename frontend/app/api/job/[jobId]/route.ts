import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/app/db";
import { activeJobs } from "@/app/schema";
import { requireAuth, backendHeaders } from "@/app/lib/api-helpers";
import { settleJob, billStoppedJob } from "@/app/lib/jobs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const authResult = await requireAuth();
  if (!("userId" in authResult)) return authResult;
  const { userId } = authResult;

  const rows = await db.select().from(activeJobs).where(eq(activeJobs.id, jobId)).limit(1);
  if (rows.length > 0 && rows[0].userId !== userId)
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  const job = rows[0];

  const pollRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/job/${jobId}`, {
    headers: backendHeaders(),
  });
  if (!pollRes.ok) return Response.json({ status: "error", error: `Poll failed (${pollRes.status})` });

  const result = await pollRes.json() as {
    status: string; data?: unknown; error?: string;
    stage?: string | null; stage_age_s?: number | null;
    progress?: { done_bytes: number; total_bytes: number | null } | null;
  };

  if (result.status === "running") {
    return Response.json({
      status: "running",
      stage: result.stage ?? null,
      stageAgeS: result.stage_age_s ?? null,
      progress: result.progress
        ? { doneBytes: result.progress.done_bytes, totalBytes: result.progress.total_bytes ?? null }
        : null,
    });
  }

  // No row means the job was already settled (sweeper or a concurrent poll) —
  // billing and cache writes happened there; just relay the result. The jobId
  // is a high-entropy Modal FunctionCall ID known only to the spawning client.
  if (job) await settleJob(job, result);

  if (result.status === "error") {
    return Response.json({ status: "error", error: result.error ?? "Unknown error" });
  }

  return Response.json({ status: "done", data: result.data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const authResult = await requireAuth();
  if (!("userId" in authResult)) return authResult;
  const { userId } = authResult;

  const rows = await db.select().from(activeJobs).where(eq(activeJobs.id, jobId)).limit(1);
  if (rows.length > 0 && rows[0].userId !== userId)
    return Response.json({ error: "Unauthorized" }, { status: 403 });

  // The backend reads the job's heartbeat before killing it: exec_started_ts is
  // when execution actually began (null = never started, or heartbeat missing).
  let execStartedTs: number | null | undefined = undefined;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/job/${jobId}`, { method: "DELETE", headers: backendHeaders() });
    if (res.ok) {
      const body = await res.json() as { exec_started_ts?: number | null };
      if ("exec_started_ts" in body) execStartedTs = body.exec_started_ts;
    }
  } catch (err) {
    console.error(err);
  }

  // Bill only GPU execution time, not queue/boot wait before the job started.
  if (rows.length > 0) await billStoppedJob(rows[0], execStartedTs);

  return Response.json({ cancelled: true });
}
