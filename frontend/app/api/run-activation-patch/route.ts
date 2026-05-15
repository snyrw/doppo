import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/app/db";
import { activationPatchCache } from "@/app/schema";
import { auth } from "@/app/lib/auth";
import { putHeatmap, getHeatmap } from "@/app/lib/r2";
import { checkAndIncrementQuota } from "@/app/lib/quota";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  "Connection": "keep-alive",
};

async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.split("\n").find((l) => l.startsWith("data: "));
        if (line) yield line.slice(6);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

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

  let session = null;
  if (gpuTier !== "tl_small") {
    session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return new Response(
        JSON.stringify({ error: "Sign in to access medium and large models" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  const resolvedPosition = String(targetPosition);
  const resolvedContrastive = String(contrastiveTokenIdx ?? "null");

  const cacheKey = createHash("sha256")
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

  // Cache miss — check quota before spinning up a GPU container.
  if (session?.user) {
    const { allowed, count } = await checkAndIncrementQuota(session.user.id);
    if (!allowed) {
      return new Response(
        JSON.stringify({
          error: `Daily inference limit reached (${count - 1} calls used). Resets at midnight UTC.`,
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  const upstream = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/run-activation-patch-stream`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: cleanPrompt,
        corrupted_prompt: corruptedPrompt,
        model_name: modelName,
        target_position: targetPosition,
        target_token_idx: targetTokenIdx,
        contrastive_token_idx: contrastiveTokenIdx ?? null,
        components,
        k,
      }),
    }
  ).catch((err: unknown) => {
    throw new Error(
      `Could not reach inference backend: ${err instanceof Error ? err.message : err}`
    );
  });

  if (!upstream.ok || !upstream.body) {
    const errData = (await upstream.json().catch(() => ({}))) as { detail?: string };
    const detail = errData.detail ?? `Upstream error ${upstream.status}`;
    return new Response(
      `data: ${JSON.stringify({ stage: "error", error: detail })}\n\n`,
      { headers: SSE_HEADERS }
    );
  }

  const encoder = new TextEncoder();
  let doneData: unknown = null;

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  (async () => {
    try {
      for await (const eventData of parseSSE(upstream.body!)) {
        await writer.write(encoder.encode(`data: ${eventData}\n\n`));
        try {
          const event = JSON.parse(eventData) as { stage: string; data?: unknown };
          if (event.stage === "done") doneData = event.data;
        } catch {
          // Malformed chunk — skip.
        }
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
