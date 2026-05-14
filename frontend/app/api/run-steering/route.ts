import { NextRequest } from "next/server";
import { auth } from "@/app/lib/auth";

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
  const { cleanPrompt, corruptedPrompt, modelName, gpuTier, targetPosition, components, alpha, nTokens } =
    (await request.json()) as {
      cleanPrompt: string;
      corruptedPrompt: string;
      modelName: string;
      gpuTier?: string;
      targetPosition: number | "last";
      components: Array<{ layer: number; head: number | null; injectionType: string }>;
      alpha: number;
      nTokens: number;
    };

  if (gpuTier !== "tl_small") {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return new Response(
        JSON.stringify({ error: "Sign in to access medium and large models" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
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
        target_position: targetPosition,
        components: components.map((c) => ({
          layer: c.layer,
          head: c.head,
          injection_type: c.injectionType,
        })),
        alpha,
        n_tokens: nTokens,
      }),
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
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  (async () => {
    try {
      for await (const eventData of parseSSE(upstream.body!)) {
        await writer.write(encoder.encode(`data: ${eventData}\n\n`));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await writer
        .write(encoder.encode(`data: ${JSON.stringify({ stage: "error", error: msg })}\n\n`))
        .catch(() => {});
    } finally {
      await writer.close().catch(() => {});
    }
  })();

  return new Response(readable, { headers: SSE_HEADERS });
}
