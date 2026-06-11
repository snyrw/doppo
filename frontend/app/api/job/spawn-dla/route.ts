import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/app/db";
import { dlaCache, activeJobs } from "@/app/schema";
import { getHeatmap } from "@/app/lib/r2";
import { requireAuth, resolveModelTier, validateGpuTier, backendHeaders, MAX_PROMPT_CHARS } from "@/app/lib/api-helpers";
import { checkBalance } from "@/app/lib/credits";
import { countActiveJobs, MAX_ACTIVE_JOBS_PER_USER } from "@/app/lib/jobs";

export async function POST(request: NextRequest) {
  const { prompt, modelName, gpuTier, targetPosition, targetToken, contrastiveToken } = (await request.json()) as {
    prompt: string; modelName: string; gpuTier?: string;
    targetPosition: number | "last"; targetToken: string | null; contrastiveToken: string | null;
  };

  if (typeof modelName !== "string" || modelName.length < 1 || modelName.length > 200)
    return Response.json({ error: "Invalid modelName" }, { status: 400 });
  if (typeof prompt !== "string" || prompt.length < 1 || prompt.length > MAX_PROMPT_CHARS)
    return Response.json({ error: "Invalid prompt" }, { status: 400 });
  if (gpuTier !== undefined && !validateGpuTier(gpuTier))
    return Response.json({ error: "Invalid gpuTier" }, { status: 400 });

  const authResult = await requireAuth();
  if (!("userId" in authResult)) return authResult;
  const { userId } = authResult;

  const resolvedTier = await resolveModelTier(modelName);
  if (!resolvedTier) return Response.json({ error: "Model not found or invalid." }, { status: 400 });

  const resolvedToken = targetToken ?? "__auto__";
  const resolvedContrastive = contrastiveToken ?? "__none__";
  const resolvedPosition = String(targetPosition);
  const cacheKey = createHash("sha256")
    .update(`${userId}:${modelName}:${prompt}:${resolvedPosition}:${resolvedToken}:${resolvedContrastive}`)
    .digest("hex");

  const cached = await db.select({ r2Key: dlaCache.r2Key }).from(dlaCache).where(eq(dlaCache.id, cacheKey)).limit(1);
  if (cached.length > 0 && cached[0].r2Key) {
    const data = await getHeatmap(cached[0].r2Key);
    db.update(dlaCache).set({ lastAccessedAt: new Date() }).where(eq(dlaCache.id, cacheKey)).catch(console.error);
    return Response.json({ status: "cached", data });
  }

  if ((await countActiveJobs(userId)) >= MAX_ACTIVE_JOBS_PER_USER)
    return Response.json({ error: "Too many jobs in flight. Wait for one to finish." }, { status: 429 });

  const { allowed } = await checkBalance(userId, resolvedTier);
  if (!allowed) return Response.json({ error: "Insufficient credits. Add credits to continue." }, { status: 402 });

  const spawnRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/job/spawn-dla`, {
    method: "POST",
    headers: backendHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ prompt, model_name: modelName, target_position: targetPosition, target_token: targetToken, contrastive_token: contrastiveToken }),
  });
  if (!spawnRes.ok) {
    const err = await spawnRes.json().catch(() => ({})) as { detail?: string };
    return Response.json({ error: err.detail ?? "Failed to spawn job" }, { status: 500 });
  }
  const { job_id } = await spawnRes.json() as { job_id: string };

  await db.insert(activeJobs).values({
    id: job_id, userId, gpuTier: resolvedTier, jobType: "dla", modelName,
    cacheKey,
    cachePayload: JSON.stringify({ modelName, prompt, targetPosition: resolvedPosition, targetToken: resolvedToken }),
    startedAt: new Date(),
  });

  return Response.json({ jobId: job_id });
}
