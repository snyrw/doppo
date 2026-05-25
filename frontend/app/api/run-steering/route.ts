import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/app/db";
import { steeringCache } from "@/app/schema";
import { putHeatmap, getHeatmap } from "@/app/lib/r2";
import { checkAndIncrementQuota } from "@/app/lib/quota";
import {
  SSE_HEADERS,
  requireAuth,
  fetchUpstream,
  validateGpuTier,
  resolveModelTier,
  resolveEndpointUrl,
} from "@/app/lib/api-helpers";

export async function POST(request: NextRequest) {
  const {
    cleanPrompt,
    corruptedPrompt,
    generationPrompt,
    modelName,
    gpuTier,
    targetPosition,
    components,
    alpha,
    nTokens,
    nPairs,
    extraPairs,
    temperature,
    repetitionPenalty,
  } = (await request.json()) as {
    cleanPrompt: string;
    corruptedPrompt: string;
    generationPrompt?: string;
    modelName: string;
    gpuTier?: string;
    targetPosition: number | "last";
    components: Array<{ layer: number; head: number | null; injectionType: string }>;
    alpha: number;
    nTokens: number;
    nPairs?: number;
    extraPairs?: Array<{ clean: string; corrupted: string }>;
    temperature?: number;
    repetitionPenalty?: number;
  };

  // Input validation
  if (typeof modelName !== "string" || modelName.length < 1 || modelName.length > 200) {
    return new Response(
      JSON.stringify({ error: "modelName must be a string between 1 and 200 characters" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (typeof cleanPrompt !== "string" || cleanPrompt.length < 1 || cleanPrompt.length > 8000) {
    return new Response(
      JSON.stringify({ error: "cleanPrompt must be a non-empty string of at most 8000 characters" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (
    typeof corruptedPrompt !== "string" ||
    corruptedPrompt.length < 1 ||
    corruptedPrompt.length > 8000
  ) {
    return new Response(
      JSON.stringify({
        error: "corruptedPrompt must be a non-empty string of at most 8000 characters",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (gpuTier !== undefined && !validateGpuTier(gpuTier)) {
    return new Response(
      JSON.stringify({ error: "gpuTier must be one of: tl_small, tl_medium, tl_large, tl_xlarge" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (!Number.isInteger(nTokens) || nTokens < 1 || nTokens > 500) {
    return new Response(
      JSON.stringify({ error: "nTokens must be an integer between 1 and 500" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (typeof alpha !== "number" || alpha < -100 || alpha > 100) {
    return new Response(
      JSON.stringify({ error: "alpha must be a number between -100 and 100" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const resolvedTemperature = temperature ?? 1.0;
  if (typeof resolvedTemperature !== "number" || resolvedTemperature < 0 || resolvedTemperature > 5) {
    return new Response(
      JSON.stringify({ error: "temperature must be a number between 0 and 5" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (nPairs !== undefined && (!Number.isInteger(nPairs) || nPairs < 1 || nPairs > 40)) {
    return new Response(
      JSON.stringify({ error: "nPairs must be an integer between 1 and 40" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const resolvedTier = await resolveModelTier(modelName);
  if (!resolvedTier) {
    return new Response(
      JSON.stringify({ error: "Model not found or invalid." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const authResult = await requireAuth(resolvedTier);
  if (!("userId" in authResult)) return authResult;
  const userId = authResult.userId;

  // Normalise arrays so the cache key is order-independent for semantically
  // commutative inputs. Components are summed; extra_pairs are averaged —
  // neither depends on iteration order.
  const sortedComponents = [...components].sort(
    (a, b) => a.layer - b.layer || (a.head ?? -1) - (b.head ?? -1)
  );
  const sortedExtraPairs = extraPairs
    ? [...extraPairs].sort((a, b) => (a.clean + a.corrupted).localeCompare(b.clean + b.corrupted))
    : [];
  const resolvedPosition = String(targetPosition);
  const resolvedRep = repetitionPenalty ?? 1.3;

  const userScope = userId || "anon";
  const cacheKey = createHash("sha256")
    .update(userScope)
    .update(modelName)
    .update(cleanPrompt)
    .update(corruptedPrompt)
    .update(generationPrompt ?? "")
    .update(resolvedPosition)
    .update(JSON.stringify(sortedComponents))
    .update(String(alpha))
    .update(String(nTokens))
    .update(String(resolvedTemperature))
    .update(String(resolvedRep))
    .update(JSON.stringify(sortedExtraPairs))
    .digest("hex");

  const cached = await db
    .select({ r2Key: steeringCache.r2Key })
    .from(steeringCache)
    .where(eq(steeringCache.id, cacheKey))
    .limit(1);

  if (cached.length > 0 && cached[0].r2Key) {
    const data = await getHeatmap(cached[0].r2Key);
    db.update(steeringCache)
      .set({ lastAccessedAt: new Date() })
      .where(eq(steeringCache.id, cacheKey))
      .catch(console.error);
    return new Response(`data: ${JSON.stringify({ stage: "done", data })}\n\n`, {
      headers: SSE_HEADERS,
    });
  }

  // Cache miss — check quota before spinning up a GPU container.
  if (userId) {
    const { allowed, count } = await checkAndIncrementQuota(userId);
    if (!allowed) {
      return new Response(
        JSON.stringify({
          error: `Daily inference limit reached (${count - 1} calls used). Resets at midnight UTC.`,
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // Cache miss — submit to RunPod and poll.
  const endpointUrl = resolveEndpointUrl(resolvedTier);
  const workerInput = {
    endpoint: "run_steering",
    model_id: modelName,
    clean_prompt: cleanPrompt,
    corrupted_prompt: corruptedPrompt,
    generation_prompt: generationPrompt ?? null,
    target_position: targetPosition,
    components: components.map((c) => ({
      layer: c.layer,
      head: c.head,
      injection_type: c.injectionType,
    })),
    alpha,
    n_tokens: nTokens,
    extra_pairs: extraPairs ?? null,
    temperature: resolvedTemperature,
    repetition_penalty: resolvedRep,
  };

  const encoder = new TextEncoder();
  let doneData: unknown = null;

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  (async () => {
    try {
      doneData = await fetchUpstream(endpointUrl, workerInput, writer, encoder);
    } finally {
      await writer.close().catch(() => {});
    }

    if (doneData) {
      try {
        await putHeatmap(cacheKey, doneData);
        await db
          .insert(steeringCache)
          .values({
            id: cacheKey,
            modelName,
            cleanPrompt,
            corruptedPrompt,
            r2Key: cacheKey,
          })
          .onConflictDoNothing();
      } catch (err) {
        console.error("Steering cache write failed:", err);
      }
    }
  })();

  return new Response(readable, { headers: SSE_HEADERS });
}
