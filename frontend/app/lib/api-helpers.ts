import { auth } from "./auth";
import { headers } from "next/headers";
import { FEATURED_MODELS } from "./featured-models";
import { validateHfRepo } from "./validate-model";
export type { SSEEvent } from "./stream-sse";
export { parseSSE } from "./stream-sse";

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  "Connection": "keep-alive",
} as const;

/**
 * Headers for any request to the Modal GPU backend. Attaches the shared bearer
 * secret so the backend (which has no user/credit awareness) only accepts calls
 * from this server. BACKEND_API_SECRET is server-only — never NEXT_PUBLIC.
 */
export function backendHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const secret = process.env.BACKEND_API_SECRET;
  if (secret) headers["Authorization"] = `Bearer ${secret}`;
  return headers;
}

export type GpuTier = "tl_small" | "tl_medium" | "tl_large" | "tl_xlarge" | "tl_xxlarge";

export function validateGpuTier(tier: unknown): tier is GpuTier {
  return (
    tier === "tl_small" ||
    tier === "tl_medium" ||
    tier === "tl_large" ||
    tier === "tl_xlarge" ||
    tier === "tl_xxlarge"
  );
}

export async function resolveModelTier(modelName: string): Promise<GpuTier | null> {
  const featured = FEATURED_MODELS[modelName];
  if (featured) return featured.gpu_tier;

  const result = await validateHfRepo(modelName);
  return result.valid && result.gpu_tier ? result.gpu_tier : null;
}

export type AuthResult = { userId: string } | Response;

export async function requireAuth(): Promise<AuthResult> {
  const hdrs = await headers();
  const session = await auth.api.getSession({ headers: hdrs });
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
      headers: backendHeaders({ "Content-Type": "application/json" }),
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
