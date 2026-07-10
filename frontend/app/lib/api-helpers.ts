import { auth } from "./auth";
import { headers } from "next/headers";
import { FEATURED_MODELS } from "./featured-models";

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
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/validate-model`, {
    method: "POST",
    headers: backendHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ repo_id: repoId }),
  });
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
