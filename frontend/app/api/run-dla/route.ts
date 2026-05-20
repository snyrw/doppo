import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/app/db";
import { dlaCache } from "@/app/schema";
import { putHeatmap, getHeatmap } from "@/app/lib/r2";
import {
  SSE_HEADERS,
  parseSSE,
  requireAuth,
  fetchUpstream,
  validateGpuTier,
} from "@/app/lib/api-helpers";

export async function POST(request: NextRequest) {
  const { prompt, modelName, gpuTier, targetPosition, targetToken, contrastiveToken } =
    (await request.json()) as {
      prompt: string;
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

  const authResult = await requireAuth(gpuTier);
  if (!("userId" in authResult)) return authResult;

  // Cache key includes all parameters. Look up by hash only — avoids needing
  // a contrastive_token column in the DB schema.
  const resolvedToken = targetToken ?? "__auto__";
  const resolvedContrastive = contrastiveToken ?? "__none__";
  const resolvedPosition = String(targetPosition);
  const cacheKey = createHash("sha256")
    .update(`${modelName}:${prompt}:${resolvedPosition}:${resolvedToken}:${resolvedContrastive}`)
    .digest("hex");

  const cached = await db
    .select({ r2Key: dlaCache.r2Key })
    .from(dlaCache)
    .where(eq(dlaCache.id, cacheKey))
    .limit(1);

  if (cached.length > 0 && cached[0].r2Key) {
    const data = await getHeatmap(cached[0].r2Key);
    db.update(dlaCache)
      .set({ lastAccessedAt: new Date() })
      .where(eq(dlaCache.id, cacheKey))
      .catch(console.error);
    const payload = JSON.stringify({ stage: "done", data });
    return new Response(`data: ${payload}\n\n`, { headers: SSE_HEADERS });
  }

  const upstreamResult = await fetchUpstream(
    `${process.env.NEXT_PUBLIC_API_URL}/api/run-dla-stream`,
    {
      prompt,
      model_name: modelName,
      target_position: targetPosition,
      target_token: targetToken,
      contrastive_token: contrastiveToken ?? null,
    }
  );
  if (!upstreamResult.ok) return upstreamResult.errorResponse;

  const encoder = new TextEncoder();
  let doneData: unknown = null;

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

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
        await putHeatmap(cacheKey, doneData);
        await db
          .insert(dlaCache)
          .values({
            id: cacheKey,
            modelName,
            prompt,
            targetPosition: resolvedPosition,
            targetToken: resolvedToken,
            r2Key: cacheKey,
          })
          .onConflictDoNothing();
      } catch (err) {
        console.error("DLA cache write failed:", err);
      }
    }
  })();

  return new Response(readable, { headers: SSE_HEADERS });
}
