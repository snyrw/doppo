import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/app/db";
import { steeringCache, activeJobs } from "@/app/schema";
import { getHeatmap } from "@/app/lib/r2";
import { requireAuth, resolveModelTier, validateGpuTier, backendHeaders, MAX_PROMPT_CHARS, MAX_EXTRA_PAIRS } from "@/app/lib/api-helpers";
import { checkBalance } from "@/app/lib/credits";

export async function POST(request: NextRequest) {
  const { cleanPrompt, corruptedPrompt, generationPrompt, modelName, gpuTier, targetPosition, components, alpha, nTokens, extraPairs, temperature, repetitionPenalty } =
    (await request.json()) as {
      cleanPrompt: string; corruptedPrompt: string; generationPrompt?: string;
      modelName: string; gpuTier?: string; targetPosition: number | "last";
      components: Array<{ layer: number; head: number | null; injectionType: string }>;
      alpha: number; nTokens: number;
      extraPairs?: Array<{ clean: string; corrupted: string }> | null;
      temperature?: number; repetitionPenalty?: number;
    };

  if (typeof modelName !== "string" || modelName.length < 1 || modelName.length > 200)
    return Response.json({ error: "Invalid modelName" }, { status: 400 });
  if (typeof cleanPrompt !== "string" || cleanPrompt.length < 1 || cleanPrompt.length > MAX_PROMPT_CHARS)
    return Response.json({ error: "Invalid cleanPrompt" }, { status: 400 });
  if (typeof corruptedPrompt !== "string" || corruptedPrompt.length < 1 || corruptedPrompt.length > MAX_PROMPT_CHARS)
    return Response.json({ error: "Invalid corruptedPrompt" }, { status: 400 });
  if (gpuTier !== undefined && !validateGpuTier(gpuTier))
    return Response.json({ error: "Invalid gpuTier" }, { status: 400 });
  if (typeof nTokens !== "number" || !Number.isInteger(nTokens) || nTokens < 1 || nTokens > 500)
    return Response.json({ error: "nTokens must be an integer between 1 and 500" }, { status: 400 });
  if (extraPairs != null && (!Array.isArray(extraPairs) || extraPairs.length > MAX_EXTRA_PAIRS))
    return Response.json({ error: `extraPairs must be an array of at most ${MAX_EXTRA_PAIRS} pairs` }, { status: 400 });

  const resolvedTier = await resolveModelTier(modelName);
  if (!resolvedTier) return Response.json({ error: "Model not found or invalid." }, { status: 400 });

  const authResult = await requireAuth();
  if (!("userId" in authResult)) return authResult;
  const { userId } = authResult;

  const resolvedTemp = temperature ?? 1.0;
  const resolvedRepPenalty = repetitionPenalty ?? 1.3;

  // Generation with temperature > 0 is non-deterministic sampling — serving a cached
  // result would silently pin one sample forever. Only cache deterministic (argmax) runs.
  const cacheKey = resolvedTemp <= 0
    ? createHash("sha256")
        .update(`${userId}:${modelName}:${cleanPrompt}:${corruptedPrompt}:${alpha}:${nTokens}:${resolvedTemp}:${resolvedRepPenalty}:${JSON.stringify(components)}`)
        .digest("hex")
    : null;

  if (cacheKey) {
    const cached = await db.select({ r2Key: steeringCache.r2Key }).from(steeringCache).where(eq(steeringCache.id, cacheKey)).limit(1);
    if (cached.length > 0 && cached[0].r2Key) {
      const data = await getHeatmap(cached[0].r2Key);
      db.update(steeringCache).set({ lastAccessedAt: new Date() }).where(eq(steeringCache.id, cacheKey)).catch(console.error);
      return Response.json({ status: "cached", data });
    }
  }

  const { allowed } = await checkBalance(userId, resolvedTier);
  if (!allowed) return Response.json({ error: "Insufficient credits. Add credits to continue." }, { status: 402 });

  const spawnRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/job/spawn-steering`, {
    method: "POST",
    headers: backendHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      model_name: modelName, clean_prompt: cleanPrompt, corrupted_prompt: corruptedPrompt,
      generation_prompt: generationPrompt ?? null, target_position: targetPosition,
      components: components.map(c => ({ layer: c.layer, head: c.head, injection_type: c.injectionType })),
      alpha, n_tokens: nTokens, extra_pairs: extraPairs ?? null,
      temperature: resolvedTemp, repetition_penalty: resolvedRepPenalty,
    }),
  });
  if (!spawnRes.ok) {
    const err = await spawnRes.json().catch(() => ({})) as { detail?: string };
    return Response.json({ error: err.detail ?? "Failed to spawn job" }, { status: 500 });
  }
  const { job_id } = await spawnRes.json() as { job_id: string };

  await db.insert(activeJobs).values({
    id: job_id, userId, gpuTier: resolvedTier, jobType: "steering", modelName,
    cacheKey,
    cachePayload: JSON.stringify({ modelName, cleanPrompt, corruptedPrompt }),
    startedAt: new Date(),
  });

  return Response.json({ jobId: job_id });
}
