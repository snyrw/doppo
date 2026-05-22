import { auth } from "./auth";
import { headers } from "next/headers";
import { hashIp, checkAndIncrementAnonQuota } from "./ip-quota";
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

// Module-level cache for the featured models list — warm after first request.
let featuredModelsCache: Array<{ id: string; gpu_tier: string }> | null = null;

/**
 * Resolves a model name to its authoritative GPU tier from the backend.
 * Never trusts the client-supplied gpuTier for auth decisions.
 * Returns null if the model is unknown or invalid.
 */
export async function resolveModelTier(modelName: string): Promise<GpuTier | null> {
  if (!featuredModelsCache) {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/models`);
      if (res.ok) featuredModelsCache = (await res.json()) as Array<{ id: string; gpu_tier: string }>;
    } catch { /* fall through to validate-model */ }
  }
  const featured = featuredModelsCache?.find((m) => m.id === modelName);
  if (featured) return validateGpuTier(featured.gpu_tier) ? featured.gpu_tier : null;

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/validate-model`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo_id: modelName }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { gpu_tier?: string };
    return validateGpuTier(json.gpu_tier) ? json.gpu_tier : null;
  } catch {
    return null;
  }
}

export type AuthResult = { userId: string } | Response;

export async function requireAuth(gpuTier: string): Promise<AuthResult> {
  const hdrs = await headers();
  if (gpuTier === "tl_small") {
    const rawIp = hdrs.get("x-forwarded-for") ?? hdrs.get("cf-connecting-ip") ?? "unknown";
    const ip = rawIp.split(",")[0].trim();
    const quota = await checkAndIncrementAnonQuota(hashIp(ip));
    if (!quota.allowed) {
      return new Response(
        JSON.stringify({ error: "Daily limit reached. Sign in for more access." }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }
    return { userId: "" };
  }
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
