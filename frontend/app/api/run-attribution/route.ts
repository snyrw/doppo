import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/app/db";
import { attributionCache } from "@/app/schema";
import { putHeatmap, getHeatmap } from "@/app/lib/r2";
import {
  SSE_HEADERS,
  requireAuth,
  fetchUpstream,
  validateGpuTier,
  resolveModelTier,
  resolveEndpointUrl,
} from "@/app/lib/api-helpers";
import { checkBalance, deductJobCost } from "@/app/lib/credits";

export async function POST(request: NextRequest) {
  const {
    cleanPrompt,
    corruptedPrompt,
    modelName,
    gpuTier,
    targetPosition,
    targetToken,
    contrastiveToken,
  } = (await request.json()) as {
    cleanPrompt: string;
    corruptedPrompt: string;
    modelName: string;
    gpuTier?: string;
    targetPosition: number | "last";
    targetToken: string | null;
    contrastiveToken: string | null;
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

  const resolvedTier = await resolveModelTier(modelName);
  if (!resolvedTier) {
    return new Response(
      JSON.stringify({ error: "Model not found or invalid." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const authResult = await requireAuth();
  if (!("userId" in authResult)) return authResult;
  const userId = authResult.userId;

  const userScope = userId;
  const resolvedToken = targetToken ?? "__auto__";
  const resolvedContrastive = contrastiveToken ?? "__none__";
  const resolvedPosition = String(targetPosition);
  const cacheKey = createHash("sha256")
    .update(
      `${userScope}:${modelName}:${cleanPrompt}:${corruptedPrompt}:${resolvedPosition}:${resolvedToken}:${resolvedContrastive}`
    )
    .digest("hex");

  const cached = await db
    .select({ r2Key: attributionCache.r2Key })
    .from(attributionCache)
    .where(eq(attributionCache.id, cacheKey))
    .limit(1);

  if (cached.length > 0 && cached[0].r2Key) {
    const data = await getHeatmap(cached[0].r2Key);
    db.update(attributionCache)
      .set({ lastAccessedAt: new Date() })
      .where(eq(attributionCache.id, cacheKey))
      .catch(console.error);
    return new Response(`data: ${JSON.stringify({ stage: "done", data })}\n\n`, {
      headers: SSE_HEADERS,
    });
  }

  // Cache miss — check balance before spinning up the GPU.
  const { allowed } = await checkBalance(userId, resolvedTier);
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: "Insufficient credits. Add credits to continue." }),
      { status: 402, headers: { "Content-Type": "application/json" } }
    );
  }

  // Cache miss — submit to RunPod and poll (bump=true: backward pass needs extra VRAM).
  const endpointUrl = resolveEndpointUrl(resolvedTier, true);
  const workerInput = {
    endpoint: "run_attribution",
    model_id: modelName,
    prompt: cleanPrompt,
    corrupted_prompt: corruptedPrompt,
    target_position: targetPosition,
    target_token: targetToken,
    contrastive_token: contrastiveToken ?? null,
  };

  const encoder = new TextEncoder();
  let doneData: unknown = null;
  let executionTimeMs: number | undefined;

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  (async () => {
    try {
      ({ doneData, executionTimeMs } = await fetchUpstream(endpointUrl, workerInput, writer, encoder));
    } finally {
      await writer.close().catch(() => {});
    }

    if (doneData) {
      if (executionTimeMs !== undefined) {
        deductJobCost(userId, resolvedTier, executionTimeMs).catch(console.error);
      }
      try {
        await putHeatmap(cacheKey, doneData);
        await db
          .insert(attributionCache)
          .values({
            id: cacheKey,
            modelName,
            prompt: cleanPrompt,
            corruptedPrompt,
            targetPosition: resolvedPosition,
            targetToken: resolvedToken,
            r2Key: cacheKey,
          })
          .onConflictDoNothing();
      } catch (err) {
        console.error("Attribution cache write failed:", err);
      }
    }
  })();

  return new Response(readable, { headers: SSE_HEADERS });
}
