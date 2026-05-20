export type SSEEvent = { stage: string; data?: unknown; error?: string };

export function isSSEEvent(x: unknown): x is SSEEvent {
  return (
    typeof x === "object" &&
    x !== null &&
    "stage" in x &&
    typeof (x as Record<string, unknown>).stage === "string"
  );
}

/** Parse SSE events from a raw ReadableStream (e.g. upstream response body). */
export async function* parseSSE(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<SSEEvent> {
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
        if (!line) continue;
        try {
          const parsed = JSON.parse(line.slice(6));
          if (isSSEEvent(parsed)) yield parsed;
        } catch {
          // Malformed chunk — skip.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** Parse SSE events from a fetch Response (client-side convenience wrapper). */
export async function* readSSEStream(response: Response): AsyncGenerator<SSEEvent> {
  if (!response.body) return;
  yield* parseSSE(response.body);
}
