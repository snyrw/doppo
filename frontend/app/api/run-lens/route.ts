import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/app/db";
import { heatmapCache } from "@/app/schema";
import { putHeatmap, getHeatmap } from "@/app/lib/r2";
import {
  SSE_HEADERS,
  parseSSE,
  requireAuth,
  fetchUpstream,
  validateGpuTier,
} from "@/app/lib/api-helpers";

export async function POST(request: NextRequest) {
  const { prompt, modelName, gpuTier, topK } = (await request.json()) as {
    prompt: string;
    modelName: string;
    gpuTier?: string;
    topK?: number;
  };

  // Input validation
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
  if (!validateGpuTier(gpuTier)) {
    return new Response(
      JSON.stringify({ error: "gpuTier must be one of: tl_small, tl_medium, tl_large, tl_xlarge" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (topK !== undefined && (!Number.isInteger(topK) || topK < 1 || topK > 100)) {
    return new Response(
      JSON.stringify({ error: "topK must be an integer between 1 and 100" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const authResult = await requireAuth(gpuTier);
  if (!("userId" in authResult)) return authResult;

  const resolvedTopK = topK ?? 5;
  const id = createHash("sha256").update(`${modelName}:${prompt}:${resolvedTopK}`).digest("hex");

  // Cache hit — fetch blob from R2 and emit a single done event.
  const cached = await db
    .select({ r2Key: heatmapCache.r2Key })
    .from(heatmapCache)
    .where(eq(heatmapCache.id, id))
    .limit(1);

  if (cached.length > 0 && cached[0].r2Key) {
    const data = await getHeatmap(cached[0].r2Key);
    db.update(heatmapCache)
      .set({ lastAccessedAt: new Date() })
      .where(eq(heatmapCache.id, id))
      .catch(console.error);
    const payload = JSON.stringify({ stage: "done", data });
    return new Response(`data: ${payload}\n\n`, { headers: SSE_HEADERS });
  }

  // Cache miss — connect to Modal and pipe the SSE stream through.
  const upstreamResult = await fetchUpstream(
    `${process.env.NEXT_PUBLIC_API_URL}/api/run-lens-stream`,
    { prompt, model_name: modelName, top_k: resolvedTopK }
  );
  if (!upstreamResult.ok) return upstreamResult.errorResponse;

  const encoder = new TextEncoder();
  let doneData: unknown = null;

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  // Pipe events to the client in the background; intercept the done event to cache.
  (async () => {
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
      try {
        await putHeatmap(id, doneData);
        await db
          .insert(heatmapCache)
          .values({ id, prompt, modelName, r2Key: id })
          .onConflictDoNothing();
      } catch (err) {
        console.error("Cache write failed:", err);
      }
    }
  })();

  return new Response(readable, { headers: SSE_HEADERS });
}
