import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/app/db";
import { activationPatchCache } from "@/app/schema";
import { putHeatmap, getHeatmap } from "@/app/lib/r2";
import {
  SSE_HEADERS,
  parseSSE,
  requireAuth,
  fetchUpstream,
  validateGpuTier,
  resolveModelTier,
} from "@/app/lib/api-helpers";
import { checkBalance, deductJobCost } from "@/app/lib/credits";

export async function POST(request: NextRequest) {
  const {
    cleanPrompt,
    corruptedPrompt,
    modelName,
    gpuTier,
    targetPosition,
    targetTokenIdx,
    contrastiveTokenIdx,
    components,
    k,
  } = (await request.json()) as {
    cleanPrompt: string;
    corruptedPrompt: string;
    modelName: string;
    gpuTier?: string;
    targetPosition: number | "last";
    targetTokenIdx: number;
    contrastiveTokenIdx: number | null;
    components: object[];
    k: number;
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

  const resolvedPosition = String(targetPosition);
  const resolvedContrastive = String(contrastiveTokenIdx ?? "null");

  const userScope = userId;
  const cacheKey = createHash("sha256")
    .update(userScope)
    .update(modelName)
    .update(cleanPrompt)
    .update(corruptedPrompt)
    .update(resolvedPosition)
    .update(String(targetTokenIdx))
    .update(resolvedContrastive)
    .update(JSON.stringify(components))
    .update(String(k))
    .digest("hex");

  const cached = await db
    .select({ r2Key: activationPatchCache.r2Key })
    .from(activationPatchCache)
    .where(eq(activationPatchCache.id, cacheKey))
    .limit(1);

  if (cached.length > 0 && cached[0].r2Key) {
    const data = await getHeatmap(cached[0].r2Key);
    db.update(activationPatchCache)
      .set({ lastAccessedAt: new Date() })
      .where(eq(activationPatchCache.id, cacheKey))
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

  // Cache miss — connect to Modal and pipe the SSE stream through.
  // main.py calls _resolve_model(bump=True) for this endpoint — no tier bump needed here.
  const upstreamResult = await fetchUpstream(
    `${process.env.NEXT_PUBLIC_API_URL}/api/run-activation-patch-stream`,
    {
      prompt: cleanPrompt,
      corrupted_prompt: corruptedPrompt,
      model_name: modelName,
      target_position: targetPosition,
      target_token_idx: targetTokenIdx,
      contrastive_token_idx: contrastiveTokenIdx ?? null,
      components,
      k,
    }
  );
  if (!upstreamResult.ok) return upstreamResult.errorResponse;

  const encoder = new TextEncoder();
  let doneData: unknown = null;

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  (async () => {
    const startTime = Date.now();
    try {
      for await (const event of parseSSE(upstreamResult.response.body!)) {
        await writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        if (event.stage === "done") doneData = event.data;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await writer
        .write(encoder.encode(`data: ${JSON.stringify({ stage: "error", error: msg })}\n\n`))
        .catch(() => {});
    } finally {
      await writer.close().catch(() => {});
    }

    if (doneData) {
      deductJobCost(userId, resolvedTier, Date.now() - startTime).catch(console.error);
      try {
        await putHeatmap(cacheKey, doneData);
        await db
          .insert(activationPatchCache)
          .values({
            id: cacheKey,
            modelName,
            cleanPrompt,
            corruptedPrompt,
            r2Key: cacheKey,
          })
          .onConflictDoNothing();
      } catch (err) {
        console.error("Activation patch cache write failed:", err);
      }
    }
  })();

  return new Response(readable, { headers: SSE_HEADERS });
}
