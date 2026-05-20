import { auth } from "./auth";
import { headers } from "next/headers";
export type { SSEEvent } from "./stream-sse";
export { parseSSE } from "./stream-sse";

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  "Connection": "keep-alive",
} as const;

export type GpuTier = "tl_small" | "tl_medium" | "tl_large" | "tl_xlarge";

export function validateGpuTier(tier: unknown): tier is GpuTier {
  return (
    tier === "tl_small" ||
    tier === "tl_medium" ||
    tier === "tl_large" ||
    tier === "tl_xlarge"
  );
}

export type AuthResult = { userId: string } | Response;

export async function requireAuth(gpuTier: string): Promise<AuthResult> {
  if (gpuTier === "tl_small") {
    return { userId: "" };
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  return { userId: session.user.id };
}

export type UpstreamResult =
  | { ok: true; response: Response }
  | { ok: false; errorResponse: Response };

export async function fetchUpstream(
  url: string,
  body: unknown
): Promise<UpstreamResult> {
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      errorResponse: new Response(
        `data: ${JSON.stringify({ stage: "error", error: `Could not reach inference backend: ${msg}` })}\n\n`,
        { headers: SSE_HEADERS }
      ),
    };
  }

  if (!upstream.ok || !upstream.body) {
    const errData = (await upstream.json().catch(() => ({}))) as {
      detail?: string;
    };
    const detail = errData.detail ?? `Upstream error ${upstream.status}`;
    return {
      ok: false,
      errorResponse: new Response(
        `data: ${JSON.stringify({ stage: "error", error: detail })}\n\n`,
        { headers: SSE_HEADERS }
      ),
    };
  }

  return { ok: true, response: upstream };
}
