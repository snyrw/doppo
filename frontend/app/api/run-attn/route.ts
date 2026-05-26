import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/app/db";
import { attnCache } from "@/app/schema";
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
  const { prompt, modelName, gpuTier } = (await request.json()) as {
    prompt: string;
    modelName: string;
    gpuTier?: string;
  };

  if (typeof modelName !== "string" || modelName.length < 1 || modelName.length > 200) {
    return new Response(
      JSON.stringify({ error: "modelName must be a string between 1 and 200 characters" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (typeof prompt !== "string" || prompt.length < 1 || prompt.length > 8000) {
    return new Response(
      JSON.stringify({ error: "prompt must be a non-empty string of at most 8000 characters" }),
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

  const cacheKey = createHash("sha256")
    .update(`${userScope}:${modelName}:${prompt}`)
    .digest("hex");

  const cached = await db
    .select({ r2Key: attnCache.r2Key })
    .from(attnCache)
    .where(eq(attnCache.id, cacheKey))
    .limit(1);

  if (cached.length > 0 && cached[0].r2Key) {
    const data = await getHeatmap(cached[0].r2Key);
    db.update(attnCache)
      .set({ lastAccessedAt: new Date() })
      .where(eq(attnCache.id, cacheKey))
      .catch(console.error);
    const payload = JSON.stringify({ stage: "done", data });
    return new Response(`data: ${payload}\n\n`, { headers: SSE_HEADERS });
  }

  // Cache miss — check balance before spinning up the GPU.
  const { allowed } = await checkBalance(userId, resolvedTier);
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: "Insufficient credits. Add credits to continue." }),
      { status: 402, headers: { "Content-Type": "application/json" } }
    );
  }

  // Cache miss — submit to RunPod and poll.
  const endpointUrl = resolveEndpointUrl(resolvedTier);
  const workerInput = {
    endpoint: "run_attn",
    model_id: modelName,
    prompt,
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
          .insert(attnCache)
          .values({
            id: cacheKey,
            modelName,
            prompt,
            r2Key: cacheKey,
          })
          .onConflictDoNothing();
      } catch (err) {
        console.error("Attn cache write failed:", err);
      }
    }
  })();

  return new Response(readable, { headers: SSE_HEADERS });
}
