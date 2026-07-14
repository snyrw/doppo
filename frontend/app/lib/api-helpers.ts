import { auth } from "./auth";
import { headers } from "next/headers";
import { FEATURED_MODELS } from "./featured-models";

/**
 * Headers for any request to the Modal GPU backend. Attaches the shared bearer
 * secret so the backend (which has no user/credit awareness) only accepts calls
 * from this server. BACKEND_API_SECRET is server-only — never NEXT_PUBLIC.
 */
function backendHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const secret = process.env.BACKEND_API_SECRET;
  if (secret) headers["Authorization"] = `Bearer ${secret}`;
  return headers;
}

/** Thrown by `backendFetch` when the request never got an HTTP response (socket
 *  reset, DNS failure, or the per-request timeout fired). An HTTP error *status*
 *  is not this — that comes back as a normal Response with `ok === false`. */
export class BackendFetchError extends Error {
  constructor(readonly original: unknown) {
    super(original instanceof Error ? original.message : String(original));
    this.name = "BackendFetchError";
  }
}

const BACKEND_TIMEOUT_MS = 60_000;

/**
 * The single entry point for every server→Modal-backend request. Attaches the
 * bearer secret, bounds the call with an AbortSignal timeout, and — for calls
 * the caller marks `retry: true` — retries **once** on a transient network
 * failure.
 *
 * Why the retry: Node's global fetch (undici) pools keep-alive connections;
 * Modal (or its LB) closes idle ones, so an on-demand call can land on a
 * half-dead socket and reject with `TypeError: fetch failed`
 * (`SocketError: other side closed`). The request died on the wire before the
 * backend read it, so a retry on a fresh connection is safe **only for
 * idempotent / read-only calls**. Never pass `retry: true` for job spawns — a
 * spawn creates a billable Modal job and a retry could double-spawn.
 *
 * A network failure (never an HTTP status) throws `BackendFetchError`; callers
 * translate that into a clean response instead of letting it surface as an
 * uncaught 500.
 */
export async function backendFetch(
  path: string,
  init: RequestInit & { retry?: boolean; timeoutMs?: number } = {}
): Promise<Response> {
  const { retry = false, timeoutMs = BACKEND_TIMEOUT_MS, headers, ...rest } = init;
  const url = `${process.env.NEXT_PUBLIC_API_URL}${path}`;
  const attempts = retry ? 2 : 1;

  let lastErr: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        ...rest,
        headers: backendHeaders(headers as Record<string, string> | undefined),
        signal: controller.signal,
      });
    } catch (err) {
      lastErr = err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new BackendFetchError(lastErr);
}

/** Must match MAX_PROMPT_CHARS in backend/schemas.py — the backend 422s anything longer. */
export const MAX_PROMPT_CHARS = 2000;

/** Must match MAX_EXTRA_PAIRS in backend/schemas.py (pair cap of 100 minus the seed). */
export const MAX_EXTRA_PAIRS = 99;

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

export type ValidationResult = {
  valid: boolean;
  gpu_tier: GpuTier | null;
  reason: string;
  adapter?: { base_id: string; adapter_id: string };
};

/**
 * The single call site for HF repo validation — proxies to the backend's
 * validate_hf_repo (the authoritative validator; there is no frontend copy of
 * this logic). Used by both /api/validate-model and resolveModelTier so they
 * can't drift.
 */
export async function validateModelUpstream(repoId: string): Promise<ValidationResult> {
  let res: Response;
  try {
    // Idempotent read-only check → safe to retry on a dropped keep-alive socket.
    res = await backendFetch("/api/validate-model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo_id: repoId }),
      retry: true,
    });
  } catch {
    return {
      valid: false,
      gpu_tier: null,
      reason: "Could not reach the validation service. Please try again.",
    };
  }
  if (res.ok) return (await res.json()) as ValidationResult;
  const err = (await res.json().catch(() => ({}))) as { detail?: string };
  return { valid: false, gpu_tier: null, reason: err.detail ?? `Validation failed: HTTP ${res.status}` };
}

export async function resolveModelTier(modelName: string): Promise<GpuTier | null> {
  const featured = FEATURED_MODELS[modelName];
  if (featured) return featured.gpu_tier;

  const result = await validateModelUpstream(modelName);
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
