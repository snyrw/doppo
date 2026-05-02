import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/app/db";
import { heatmapCache } from "@/app/schema";
import { auth } from "@/app/lib/auth";
import { putHeatmap, getHeatmap } from "@/app/lib/r2";

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
  const { prompt, modelName, gpuTier } = (await request.json()) as {
    prompt: string;
    modelName: string;
    gpuTier?: string;
  };

  // Anything other than a known tl_small request requires a session.
  if (gpuTier !== "tl_small") {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return new Response(
        JSON.stringify({ error: "Sign in to access medium and large models" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // Cache hit — fetch blob from R2 and emit a single done event.
  const cached = await db
    .select({ id: heatmapCache.id, r2Key: heatmapCache.r2Key })
    .from(heatmapCache)
    .where(and(eq(heatmapCache.prompt, prompt), eq(heatmapCache.modelName, modelName)))
    .limit(1);

  if (cached.length > 0 && cached[0].r2Key) {
    const data = await getHeatmap(cached[0].r2Key);
    db.update(heatmapCache)
      .set({ lastAccessedAt: new Date() })
      .where(eq(heatmapCache.id, cached[0].id))
      .catch(console.error);
    const payload = JSON.stringify({ stage: "done", data });
    return new Response(`data: ${payload}\n\n`, { headers: SSE_HEADERS });
  }

  // Cache miss — connect to Modal and pipe the SSE stream through.
  const upstream = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/run-lens-stream`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, model_name: modelName }),
    }
  ).catch((err: unknown) => {
    throw new Error(`Could not reach inference backend: ${err instanceof Error ? err.message : err}`);
  });

  if (!upstream.ok || !upstream.body) {
    const errData = await upstream.json().catch(() => ({})) as { detail?: string };
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

  // Pipe events to the client in the background; intercept the done event to cache.
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
      const id = createHash("sha256").update(`${modelName}:${prompt}`).digest("hex");
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
