import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/app/db";
import {
  activeJobs, heatmapCache, attnCache, dlaCache,
  attributionCache, activationPatchCache, steeringCache,
} from "@/app/schema";
import { putHeatmap } from "@/app/lib/r2";
import { requireAuth } from "@/app/lib/api-helpers";
import { deductJobCost } from "@/app/lib/credits";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const authResult = await requireAuth();
  if (!("userId" in authResult)) return authResult;
  const { userId } = authResult;

  const rows = await db.select().from(activeJobs).where(eq(activeJobs.id, jobId)).limit(1);
  if (rows.length === 0) return Response.json({ error: "Job not found" }, { status: 404 });
  if (rows[0].userId !== userId) return Response.json({ error: "Unauthorized" }, { status: 403 });
  const job = rows[0];

  const pollRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/job/${jobId}`);
  if (!pollRes.ok) return Response.json({ status: "error", error: `Poll failed (${pollRes.status})` });

  const result = await pollRes.json() as { status: string; data?: unknown; error?: string };

  if (result.status === "running") {
    return Response.json({ status: "running" });
  }

  await db.delete(activeJobs).where(eq(activeJobs.id, jobId)).catch(console.error);

  if (result.status === "error") {
    return Response.json({ status: "error", error: result.error ?? "Unknown error" });
  }

  const durationMs = Date.now() - new Date(job.startedAt).getTime();
  await deductJobCost(userId, job.gpuTier, durationMs).catch(console.error);

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
    }
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

  const rows = await db.select({ userId: activeJobs.userId }).from(activeJobs).where(eq(activeJobs.id, jobId)).limit(1);
  if (rows.length > 0 && rows[0].userId !== userId)
    return Response.json({ error: "Unauthorized" }, { status: 403 });

  await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/job/${jobId}`, { method: "DELETE" }).catch(console.error);
  await db.delete(activeJobs).where(eq(activeJobs.id, jobId)).catch(console.error);

  return Response.json({ cancelled: true });
}
