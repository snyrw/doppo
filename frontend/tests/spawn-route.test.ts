import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

/* All of the handler's collaborators are mocked. What is under test is the
   order of its gates and what it does when one of them rejects. */

let authResult: unknown = { userId: "user_1" };
let resolvedTier: string | null = "tl_small";
const backendFetch = vi.fn();

vi.mock("@/app/lib/api-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/lib/api-helpers")>();
  return {
    ...actual,
    requireAuth: () => Promise.resolve(authResult),
    resolveModelTier: () => Promise.resolve(resolvedTier),
    backendFetch: (...a: unknown[]) => backendFetch(...a),
  };
});

let cacheRows: { r2Key: string | null }[] = [];
vi.mock("@/app/db", () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: () => Promise.resolve(cacheRows) }) }),
    }),
    update: () => ({ set: () => ({ where: () => ({ catch: () => {} }) }) }),
  },
}));

const getHeatmap = vi.fn();
vi.mock("@/app/lib/r2", () => ({ getHeatmap: (k: string) => getHeatmap(k) }));

let activeJobCount = 0;
let claimSucceeds = true;
const insertActiveJobIfUnderCap = vi.fn();
vi.mock("@/app/lib/jobs", () => ({
  MAX_ACTIVE_JOBS_PER_USER: 3,
  countActiveJobs: () => Promise.resolve(activeJobCount),
  insertActiveJobIfUnderCap: (job: unknown) => {
    insertActiveJobIfUnderCap(job);
    return Promise.resolve(claimSucceeds);
  },
}));

let balanceAllowed = true;
let paymentVerified = true;
vi.mock("@/app/lib/credits", () => ({
  checkBalance: () => Promise.resolve({ allowed: balanceAllowed }),
  isPaymentVerified: () => Promise.resolve(paymentVerified),
}));

import { POST } from "@/app/api/job/spawn-lens/route";
import { BackendFetchError } from "@/app/lib/api-helpers";

const spawnOk = (jobId = "job_1") =>
  ({ ok: true, json: async () => ({ job_id: jobId }) }) as unknown as Response;

const req = (body: Record<string, unknown> = {}): NextRequest =>
  ({
    json: async () => ({ modelName: "openai-community/gpt2", prompt: "hello", ...body }),
  }) as unknown as NextRequest;

beforeEach(() => {
  authResult = { userId: "user_1" };
  resolvedTier = "tl_small";
  cacheRows = [];
  activeJobCount = 0;
  claimSucceeds = true;
  balanceAllowed = true;
  paymentVerified = true;
  backendFetch.mockReset().mockResolvedValue(spawnOk());
  insertActiveJobIfUnderCap.mockClear();
  getHeatmap.mockReset().mockResolvedValue({ cached: "payload" });
});

describe("request validation", () => {
  it("rejects a missing or non-string modelName", async () => {
    const res = await POST(req({ modelName: undefined }));
    expect(res.status).toBe(400);
    expect(backendFetch).not.toHaveBeenCalled();
  });

  it("rejects an unknown gpuTier when one is supplied", async () => {
    const res = await POST(req({ gpuTier: "tl_enormous" }));
    expect(res.status).toBe(400);
  });

  it("rejects an empty prompt via the route's own parse step", async () => {
    const res = await POST(req({ prompt: "" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid prompt" });
  });

  it("validates the body before authenticating", async () => {
    authResult = new Response("Unauthorized", { status: 401 });
    const res = await POST(req({ prompt: "" }));
    expect(res.status).toBe(400);
  });
});

describe("gates that must run before a job is spawned", () => {
  it("relays the auth failure response untouched", async () => {
    authResult = new Response("Unauthorized", { status: 401 });
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(backendFetch).not.toHaveBeenCalled();
  });

  it("rejects a model whose tier cannot be resolved", async () => {
    resolvedTier = null;
    const res = await POST(req());
    expect(res.status).toBe(400);
    expect(backendFetch).not.toHaveBeenCalled();
  });

  it("returns 429 when the user is already at the job cap", async () => {
    activeJobCount = 3;
    const res = await POST(req());
    expect(res.status).toBe(429);
    expect(backendFetch).not.toHaveBeenCalled();
  });

  it("returns 402 on an insufficient balance", async () => {
    balanceAllowed = false;
    const res = await POST(req());
    expect(res.status).toBe(402);
    expect(backendFetch).not.toHaveBeenCalled();
  });

  it("returns 403 with a machine-readable code when a gated tier needs a card", async () => {
    resolvedTier = "tl_large";
    paymentVerified = false;
    const res = await POST(req());
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "verification_required" });
    expect(backendFetch).not.toHaveBeenCalled();
  });

  it("lets a gated tier through once the card is verified", async () => {
    resolvedTier = "tl_large";
    paymentVerified = true;
    const res = await POST(req());
    expect(res.status).toBe(200);
  });

  it("does not gate the small tiers on card verification", async () => {
    paymentVerified = false;
    const res = await POST(req());
    expect(res.status).toBe(200);
  });
});

describe("cache hit", () => {
  it("serves the stored payload without spawning a job", async () => {
    cacheRows = [{ r2Key: "r2_abc" }];
    const res = await POST(req());
    expect(await res.json()).toMatchObject({ status: "cached", data: { cached: "payload" } });
    expect(getHeatmap).toHaveBeenCalledWith("r2_abc");
    expect(backendFetch).not.toHaveBeenCalled();
    expect(insertActiveJobIfUnderCap).not.toHaveBeenCalled();
  });

  it("spawns anyway when the row exists but carries no r2Key", async () => {
    cacheRows = [{ r2Key: null }];
    const res = await POST(req());
    expect(await res.json()).toEqual({ jobId: "job_1" });
    expect(backendFetch).toHaveBeenCalled();
  });

  it("checks the cache before the job cap, so a cached result is still served at the cap", async () => {
    cacheRows = [{ r2Key: "r2_abc" }];
    activeJobCount = 3;
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "cached" });
  });
});

describe("upstream failures", () => {
  it("returns 502 without retrying, because a retry could spawn a second billable job", async () => {
    backendFetch.mockRejectedValue(new BackendFetchError("fetch failed"));
    const res = await POST(req());
    expect(res.status).toBe(502);
    expect(backendFetch).toHaveBeenCalledTimes(1);
    expect(insertActiveJobIfUnderCap).not.toHaveBeenCalled();
  });

  it("surfaces the backend's own detail message on a non-ok spawn", async () => {
    backendFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ detail: "Prompt too long: 99 tokens (max 48)." }),
    } as unknown as Response);
    const res = await POST(req());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Prompt too long: 99 tokens (max 48)." });
  });

  it("falls back to a generic message when the error body is not JSON", async () => {
    backendFetch.mockResolvedValue({
      ok: false,
      json: async () => { throw new Error("not json"); },
    } as unknown as Response);
    const res = await POST(req());
    expect(await res.json()).toEqual({ error: "Failed to spawn job" });
  });
});

describe("losing the atomic cap race", () => {
  /* A job that spawns but fails to claim a slot has no row tracking it, so
     nothing would ever bill it. It has to be cancelled. */

  it("cancels the orphaned job and returns 429", async () => {
    claimSucceeds = false;
    const res = await POST(req());

    expect(res.status).toBe(429);
    const cancel = backendFetch.mock.calls.find(([, init]) => init?.method === "DELETE");
    expect(cancel).toBeDefined();
    expect(cancel![0]).toBe("/api/job/job_1");
  });

  it("still returns 429 when the cancel itself fails", async () => {
    claimSucceeds = false;
    backendFetch.mockResolvedValueOnce(spawnOk()).mockRejectedValueOnce(new Error("backend down"));
    const res = await POST(req());
    expect(res.status).toBe(429);
  });
});

describe("a successful spawn", () => {
  it("returns the backend's job id", async () => {
    backendFetch.mockResolvedValue(spawnOk("modal_fc_xyz"));
    const res = await POST(req());
    expect(await res.json()).toEqual({ jobId: "modal_fc_xyz" });
  });

  it("sends the route's snake_case body upstream", async () => {
    await POST(req({ prompt: "The Eiffel Tower is", topK: 7 }));
    const [url, init] = backendFetch.mock.calls[0];
    expect(url).toBe("/api/job/spawn-lens");
    expect(JSON.parse(init.body)).toEqual({
      prompt: "The Eiffel Tower is",
      model_name: "openai-community/gpt2",
      top_k: 7,
    });
  });

  it("bills against the tier it resolved, not the tier the client sent", async () => {
    resolvedTier = "tl_medium";
    await POST(req({ gpuTier: "tl_small" }));
    expect(insertActiveJobIfUnderCap).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "job_1",
        userId: "user_1",
        gpuTier: "tl_medium",
        jobType: "lens",
        modelName: "openai-community/gpt2",
      })
    );
  });

  it("stores a cachePayload the settler can rebuild the cache row from", async () => {
    await POST(req({ prompt: "hi", topK: 5 }));
    const job = insertActiveJobIfUnderCap.mock.calls[0][0] as { cachePayload: string };
    expect(JSON.parse(job.cachePayload)).toEqual({
      prompt: "hi",
      modelName: "openai-community/gpt2",
      topK: 5,
    });
  });

  it("scopes the cache key to the user, so one user's result never serves another's", async () => {
    await POST(req());
    const first = (insertActiveJobIfUnderCap.mock.calls[0][0] as { cacheKey: string }).cacheKey;

    insertActiveJobIfUnderCap.mockClear();
    authResult = { userId: "user_2" };
    await POST(req());
    const second = (insertActiveJobIfUnderCap.mock.calls[0][0] as { cacheKey: string }).cacheKey;

    expect(first).not.toBe(second);
  });

  it("keys the cache on every parameter that changes the result", async () => {
    const keyFor = async (body: Record<string, unknown>) => {
      insertActiveJobIfUnderCap.mockClear();
      await POST(req(body));
      return (insertActiveJobIfUnderCap.mock.calls[0][0] as { cacheKey: string }).cacheKey;
    };
    const base = await keyFor({ prompt: "a", topK: 5 });
    expect(await keyFor({ prompt: "b", topK: 5 })).not.toBe(base);
    expect(await keyFor({ prompt: "a", topK: 6 })).not.toBe(base);
    expect(await keyFor({ prompt: "a", topK: 5, modelName: "gpt2-medium" })).not.toBe(base);
    expect(await keyFor({ prompt: "a", topK: 5 })).toBe(base);
  });
});
