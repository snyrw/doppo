import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/app/db";
import { steeringCache } from "@/app/schema";
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
    generationPrompt,
    modelName,
    gpuTier,
    targetPosition,
    components,
    alpha,
    nTokens,
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
    extraPairs?: Array<{ clean: string; corrupted: string }>;
    temperature?: number;
    repetitionPenalty?: number;
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
  const resolvedTemp = temperature ?? 1.0;
  const resolvedRep = repetitionPenalty ?? 1.3;

  const cacheKey = createHash("sha256")
    .update(modelName)
    .update(cleanPrompt)
    .update(corruptedPrompt)
    .update(generationPrompt ?? "")
    .update(resolvedPosition)
    .update(JSON.stringify(sortedComponents))
    .update(String(alpha))
    .update(String(nTokens))
    .update(String(resolvedTemp))
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
    `${process.env.NEXT_PUBLIC_API_URL}/api/run-steering-stream`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model_name: modelName,
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
        temperature: resolvedTemp,
        repetition_penalty: resolvedRep,
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
