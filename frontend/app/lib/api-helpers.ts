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

export type GpuTier = "tl_small" | "tl_medium" | "tl_large" | "tl_xlarge";

export function validateGpuTier(tier: unknown): tier is GpuTier {
  return (
    tier === "tl_small" ||
    tier === "tl_medium" ||
    tier === "tl_large" ||
    tier === "tl_xlarge"
  );
}

/**
 * Resolves a model name to its GPU tier.
 * Checks FEATURED_MODELS first; falls back to validateHfRepo for arbitrary HF IDs.
 * Returns null if the model is unknown or invalid.
 */
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

// ── RunPod API key ────────────────────────────────────────────────────────────

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY!;
const POLL_INTERVAL_MS = 400;

type RunPodChunk = {
  output: { stage: string; data?: unknown; error?: string };
};

// ── SSE streaming fetchUpstream ───────────────────────────────────────────────

/**
 * Submit a job to a RunPod endpoint and poll /stream until done.
 * Writes SSE events to `writer` as they arrive.
 */
export async function fetchUpstream(
  endpointUrl: string,
  body: unknown,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
): Promise<{ doneData: unknown; executionTimeMs: number | undefined }> {
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
    return { doneData: null, executionTimeMs: undefined };
  }

  if (!submitRes.ok) {
    await send({ stage: "error", error: `RunPod submit failed: ${submitRes.status}` });
    return { doneData: null, executionTimeMs: undefined };
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
      return { doneData: null, executionTimeMs: undefined };
    }

    if (!pollRes.ok) {
      await send({ stage: "error", error: `RunPod poll HTTP ${pollRes.status}` });
      return { doneData: null, executionTimeMs: undefined };
    }

    const { stream, status, executionTime } = (await pollRes.json()) as {
      stream?: RunPodChunk[];
      status: string;
      executionTime?: number;
    };

    for (const chunk of stream ?? []) {
      await send(chunk.output);
      if (chunk.output.stage === "done") doneData = chunk.output.data ?? null;
      if (chunk.output.stage === "done" || chunk.output.stage === "error") {
        return { doneData, executionTimeMs: executionTime };
      }
    }

    if (status === "FAILED") {
      await send({ stage: "error", error: "RunPod job failed" });
      return { doneData: null, executionTimeMs: undefined };
    }
  }
}

// ── Non-SSE RunPod job ────────────────────────────────────────────────────────

/**
 * Submit a job to RunPod and poll until done. Returns the `data` payload from
 * the "done" event. Throws on network error or job failure. No SSE, no credits.
 * Use for lightweight non-GPU operations like tokenization.
 */
export async function runPodJob(endpointUrl: string, body: unknown): Promise<unknown> {
  const submitRes = await fetch(`${endpointUrl}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RUNPOD_API_KEY}`,
    },
    body: JSON.stringify({ input: body }),
  });
  if (!submitRes.ok) throw new Error(`RunPod submit failed: ${submitRes.status}`);
  const { id: jobId } = (await submitRes.json()) as { id: string };

  for (;;) {
    await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
    const pollRes = await fetch(`${endpointUrl}/stream/${jobId}`, {
      headers: { Authorization: `Bearer ${RUNPOD_API_KEY}` },
    });
    if (!pollRes.ok) throw new Error(`RunPod poll HTTP ${pollRes.status}`);
    const { stream, status } = (await pollRes.json()) as {
      stream?: RunPodChunk[];
      status: string;
    };
    for (const chunk of stream ?? []) {
      if (chunk.output.stage === "done") return chunk.output.data ?? null;
      if (chunk.output.stage === "error")
        throw new Error(chunk.output.error ?? "RunPod job error");
    }
    if (status === "FAILED") throw new Error("RunPod job failed");
  }
}
