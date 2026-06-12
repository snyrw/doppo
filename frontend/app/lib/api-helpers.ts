import { auth } from "./auth";
import { headers } from "next/headers";
import { FEATURED_MODELS } from "./featured-models";
import { validateHfRepo } from "./validate-model";

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

/** Must match MAX_EXTRA_PAIRS in backend/schemas.py (largest tier pair cap). */
export const MAX_EXTRA_PAIRS = 40;

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
