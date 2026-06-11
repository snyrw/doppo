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

  const result = await pollRes.json() as { status: string; data?: unknown; error?: string };

  if (result.status === "running") {
    return Response.json({ status: "running" });
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

  await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/job/${jobId}`, { method: "DELETE", headers: backendHeaders() }).catch(console.error);

  // The GPU ran until the cancel landed — bill the elapsed time.
  if (rows.length > 0) await billStoppedJob(rows[0]);

  return Response.json({ cancelled: true });
}
