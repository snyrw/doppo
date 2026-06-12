import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/app/db";
import {
  activeJobs,
  heatmapCache,
  dlaCache,
  attributionCache,
  steeringCache,
  activationPatchCache,
  attnCache,
} from "@/app/schema";
import { getHeatmap } from "@/app/lib/r2";
import {
  requireAuth,
  resolveModelTier,
  validateGpuTier,
  backendHeaders,
  MAX_PROMPT_CHARS,
} from "./api-helpers";
import { checkBalance } from "./credits";
import { countActiveJobs, MAX_ACTIVE_JOBS_PER_USER } from "./jobs";

type CacheTable =
  | typeof heatmapCache
  | typeof dlaCache
  | typeof attributionCache
  | typeof steeringCache
  | typeof activationPatchCache
  | typeof attnCache;

export type ParseResult<P> = { ok: true; params: P } | { ok: false; error: string };

export function isValidPrompt(v: unknown): v is string {
  return typeof v === "string" && v.length >= 1 && v.length <= MAX_PROMPT_CHARS;
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export type SpawnConfig<P> = {
  /** Job type stored in activeJobs; also names the upstream endpoint `spawn-${jobType}`. */
  jobType: "lens" | "dla" | "attribution" | "activation-patch" | "steering" | "attn";
  cacheTable: CacheTable;
  /** Route-specific body validation. `modelName` and `gpuTier` are checked by the factory. */
  parse: (body: Record<string, unknown>) => ParseResult<P>;
  /** Exact cache-key string — changing it orphans existing cache rows. null disables caching. */
  cacheKey: (userId: string, params: P) => string | null;
  /** snake_case payload for the Modal backend. */
  upstreamBody: (params: P) => Record<string, unknown>;
  /** Stored on activeJobs; the settlement/sweeper uses it to write the cache row on completion. */
  cachePayload: (params: P) => Record<string, unknown>;
};

export function createSpawnHandler<P extends { modelName: string }>(cfg: SpawnConfig<P>) {
  return async function POST(request: NextRequest) {
    const body = (await request.json()) as Record<string, unknown>;

    const modelName = body.modelName;
    if (typeof modelName !== "string" || modelName.length < 1 || modelName.length > 200)
      return Response.json({ error: "Invalid modelName" }, { status: 400 });
    if (body.gpuTier !== undefined && !validateGpuTier(body.gpuTier))
      return Response.json({ error: "Invalid gpuTier" }, { status: 400 });

    const parsed = cfg.parse(body);
    if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
    const params = parsed.params;

    const authResult = await requireAuth();
    if (!("userId" in authResult)) return authResult;
    const { userId } = authResult;

    const resolvedTier = await resolveModelTier(modelName);
    if (!resolvedTier) return Response.json({ error: "Model not found or invalid." }, { status: 400 });

    const table = cfg.cacheTable;
    const cacheKey = cfg.cacheKey(userId, params);
    if (cacheKey) {
      const cached = await db.select({ r2Key: table.r2Key }).from(table).where(eq(table.id, cacheKey)).limit(1);
      if (cached.length > 0 && cached[0].r2Key) {
        const data = await getHeatmap(cached[0].r2Key);
        db.update(table).set({ lastAccessedAt: new Date() }).where(eq(table.id, cacheKey)).catch(console.error);
        return Response.json({ status: "cached", data });
      }
    }

    if ((await countActiveJobs(userId)) >= MAX_ACTIVE_JOBS_PER_USER)
      return Response.json({ error: "Too many jobs in flight. Wait for one to finish." }, { status: 429 });

    const { allowed } = await checkBalance(userId, resolvedTier);
    if (!allowed) return Response.json({ error: "Insufficient credits. Add credits to continue." }, { status: 402 });

    const spawnRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/job/spawn-${cfg.jobType}`, {
      method: "POST",
      headers: backendHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(cfg.upstreamBody(params)),
    });
    if (!spawnRes.ok) {
      const err = await spawnRes.json().catch(() => ({})) as { detail?: string };
      return Response.json({ error: err.detail ?? "Failed to spawn job" }, { status: 500 });
    }
    const { job_id } = await spawnRes.json() as { job_id: string };

    await db.insert(activeJobs).values({
      id: job_id, userId, gpuTier: resolvedTier, jobType: cfg.jobType, modelName,
      cacheKey,
      cachePayload: JSON.stringify(cfg.cachePayload(params)),
      startedAt: new Date(),
    });

    return Response.json({ jobId: job_id });
  };
}
