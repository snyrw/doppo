import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/app/db";
import { heatmapCache, activeJobs } from "@/app/schema";
import { getHeatmap } from "@/app/lib/r2";
import { requireAuth, resolveModelTier, validateGpuTier, backendHeaders } from "@/app/lib/api-helpers";
import { checkBalance } from "@/app/lib/credits";

export async function POST(request: NextRequest) {
  const { prompt, modelName, gpuTier, topK } = (await request.json()) as {
    prompt: string; modelName: string; gpuTier?: string; topK?: number;
  };

  if (typeof modelName !== "string" || modelName.length < 1 || modelName.length > 200)
    return Response.json({ error: "Invalid modelName" }, { status: 400 });
  if (typeof prompt !== "string" || prompt.length < 1 || prompt.length > 8000)
    return Response.json({ error: "Invalid prompt" }, { status: 400 });
  if (gpuTier !== undefined && !validateGpuTier(gpuTier))
    return Response.json({ error: "Invalid gpuTier" }, { status: 400 });

  const resolvedTier = await resolveModelTier(modelName);
  if (!resolvedTier) return Response.json({ error: "Model not found or invalid." }, { status: 400 });

  const authResult = await requireAuth();
  if (!("userId" in authResult)) return authResult;
  const { userId } = authResult;

  const resolvedTopK = topK ?? 5;
  const cacheKey = createHash("sha256").update(`${userId}:${modelName}:${prompt}:${resolvedTopK}`).digest("hex");

  const cached = await db.select({ r2Key: heatmapCache.r2Key }).from(heatmapCache).where(eq(heatmapCache.id, cacheKey)).limit(1);
  if (cached.length > 0 && cached[0].r2Key) {
    const data = await getHeatmap(cached[0].r2Key);
    db.update(heatmapCache).set({ lastAccessedAt: new Date() }).where(eq(heatmapCache.id, cacheKey)).catch(console.error);
    return Response.json({ status: "cached", data });
  }

  const { allowed } = await checkBalance(userId, resolvedTier);
  if (!allowed) return Response.json({ error: "Insufficient credits. Add credits to continue." }, { status: 402 });

  const spawnRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/job/spawn-lens`, {
    method: "POST",
    headers: backendHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ prompt, model_name: modelName, top_k: resolvedTopK }),
  });
  if (!spawnRes.ok) {
    const err = await spawnRes.json().catch(() => ({})) as { detail?: string };
    return Response.json({ error: err.detail ?? "Failed to spawn job" }, { status: 500 });
  }
  const { job_id } = await spawnRes.json() as { job_id: string };

  await db.insert(activeJobs).values({
    id: job_id, userId, gpuTier: resolvedTier, jobType: "lens", modelName,
    cacheKey, cachePayload: JSON.stringify({ prompt, modelName, topK: resolvedTopK }),
    startedAt: new Date(),
  });

  return Response.json({ jobId: job_id });
}
