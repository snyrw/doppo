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

// ── RunPod endpoint routing ───────────────────────────────────────────────────

const RUNPOD_ENDPOINTS: Record<GpuTier, string> = {
  tl_small:   process.env.RUNPOD_ENDPOINT_SMALL!,
  tl_medium:  process.env.RUNPOD_ENDPOINT_MEDIUM!,
  tl_large:   process.env.RUNPOD_ENDPOINT_LARGE!,
  tl_xlarge:  process.env.RUNPOD_ENDPOINT_XLARGE!,
};

function bumpTier(tier: GpuTier): GpuTier {
  const order: GpuTier[] = ["tl_small", "tl_medium", "tl_large", "tl_xlarge"];
  const idx = order.indexOf(tier);
  return order[Math.min(idx + 1, order.length - 1)];
}

export function resolveEndpointUrl(tier: GpuTier, bump = false): string {
  return RUNPOD_ENDPOINTS[bump ? bumpTier(tier) : tier];
}

// ── RunPod polling fetchUpstream ─────────────────────────────────────────────

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY!;
const POLL_INTERVAL_MS = 400;

type RunPodChunk = {
  output: { stage: string; data?: unknown; error?: string };
};

/**
 * Submit a job to a RunPod endpoint and poll /stream until done.
 * Writes SSE events to `writer` as they arrive.
 * Returns the `data` payload from the "done" event, or null on error.
 */
export async function fetchUpstream(
  endpointUrl: string,
  body: unknown,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
): Promise<unknown> {
  const send = async (data: object) =>
    writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

  let submitRes: Response;
  try {
    submitRes = await fetch(`${endpointUrl}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNPOD_API_KEY}`,
      },
      body: JSON.stringify({ input: body }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await send({ stage: "error", error: `Could not reach inference backend: ${msg}` });
    return null;
  }

  if (!submitRes.ok) {
    await send({ stage: "error", error: `RunPod submit failed: ${submitRes.status}` });
    return null;
  }

  const { id: jobId } = (await submitRes.json()) as { id: string };
  let doneData: unknown = null;

  for (;;) {
    await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));

    let pollRes: Response;
    try {
      pollRes = await fetch(`${endpointUrl}/stream/${jobId}`, {
        headers: { Authorization: `Bearer ${RUNPOD_API_KEY}` },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await send({ stage: "error", error: `Poll failed: ${msg}` });
      return null;
    }

    if (!pollRes.ok) {
      await send({ stage: "error", error: `RunPod poll HTTP ${pollRes.status}` });
      return null;
    }

    const { stream, status } = (await pollRes.json()) as {
      stream?: RunPodChunk[];
      status: string;
    };

    for (const chunk of stream ?? []) {
      await send(chunk.output);
      if (chunk.output.stage === "done") doneData = chunk.output.data ?? null;
      if (chunk.output.stage === "done" || chunk.output.stage === "error") return doneData;
    }

    if (status === "FAILED") {
      await send({ stage: "error", error: "RunPod job failed" });
      return null;
    }
  }
}
