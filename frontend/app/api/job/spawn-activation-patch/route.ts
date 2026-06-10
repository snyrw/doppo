import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/app/db";
import { activationPatchCache, activeJobs } from "@/app/schema";
import { getHeatmap } from "@/app/lib/r2";
import { requireAuth, resolveModelTier, validateGpuTier, backendHeaders } from "@/app/lib/api-helpers";
import { checkBalance } from "@/app/lib/credits";

export async function POST(request: NextRequest) {
  const { cleanPrompt, corruptedPrompt, modelName, gpuTier, targetPosition, targetTokenIdx, contrastiveTokenIdx, components, k } =
    (await request.json()) as {
      cleanPrompt: string; corruptedPrompt: string; modelName: string; gpuTier?: string;
      targetPosition: number | "last"; targetTokenIdx: number; contrastiveTokenIdx: number | null;
      components: object[]; k: number;
    };

  if (typeof modelName !== "string" || modelName.length < 1 || modelName.length > 200)
    return Response.json({ error: "Invalid modelName" }, { status: 400 });
  if (typeof cleanPrompt !== "string" || cleanPrompt.length < 1 || cleanPrompt.length > 8000)
    return Response.json({ error: "Invalid cleanPrompt" }, { status: 400 });
  if (typeof corruptedPrompt !== "string" || corruptedPrompt.length < 1 || corruptedPrompt.length > 8000)
    return Response.json({ error: "Invalid corruptedPrompt" }, { status: 400 });
  if (gpuTier !== undefined && !validateGpuTier(gpuTier))
    return Response.json({ error: "Invalid gpuTier" }, { status: 400 });

  const resolvedTier = await resolveModelTier(modelName);
  if (!resolvedTier) return Response.json({ error: "Model not found or invalid." }, { status: 400 });

  const authResult = await requireAuth();
  if (!("userId" in authResult)) return authResult;
  const { userId } = authResult;

  const cacheKey = createHash("sha256")
    .update(userId).update(modelName).update(cleanPrompt).update(corruptedPrompt)
    .update(String(targetPosition)).update(String(targetTokenIdx))
    .update(String(contrastiveTokenIdx ?? "null")).update(JSON.stringify(components)).update(String(k))
    .digest("hex");

  const cached = await db.select({ r2Key: activationPatchCache.r2Key }).from(activationPatchCache).where(eq(activationPatchCache.id, cacheKey)).limit(1);
  if (cached.length > 0 && cached[0].r2Key) {
    const data = await getHeatmap(cached[0].r2Key);
    db.update(activationPatchCache).set({ lastAccessedAt: new Date() }).where(eq(activationPatchCache.id, cacheKey)).catch(console.error);
    return Response.json({ status: "cached", data });
  }

  const { allowed } = await checkBalance(userId, resolvedTier);
  if (!allowed) return Response.json({ error: "Insufficient credits. Add credits to continue." }, { status: 402 });

  const spawnRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/job/spawn-activation-patch`, {
    method: "POST",
    headers: backendHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ prompt: cleanPrompt, corrupted_prompt: corruptedPrompt, model_name: modelName, target_position: targetPosition, target_token_idx: targetTokenIdx, contrastive_token_idx: contrastiveTokenIdx, components, k }),
  });
  if (!spawnRes.ok) {
    const err = await spawnRes.json().catch(() => ({})) as { detail?: string };
    return Response.json({ error: err.detail ?? "Failed to spawn job" }, { status: 500 });
  }
  const { job_id } = await spawnRes.json() as { job_id: string };

  await db.insert(activeJobs).values({
    id: job_id, userId, gpuTier: resolvedTier, jobType: "activation-patch", modelName,
    cacheKey,
    cachePayload: JSON.stringify({ modelName, cleanPrompt, corruptedPrompt }),
    startedAt: new Date(),
  });

  return Response.json({ jobId: job_id });
}
