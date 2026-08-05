import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const deductJobCost = vi.fn().mockResolvedValue(0);
vi.mock("../app/lib/credits", () => ({
  deductJobCost: (...a: unknown[]) => deductJobCost(...a),
}));

const putHeatmap = vi.fn().mockResolvedValue(undefined);
vi.mock("../app/lib/r2", () => ({
  putHeatmap: (...a: unknown[]) => putHeatmap(...a),
}));

const captureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureException: (...a: unknown[]) => captureException(...a),
}));

// db mock: delete().where().returning() drives claimJob (one row = claim won,
// empty = someone else settled first); insert().values().onConflictDoNothing()
// records cache-table writes.
let claimSucceeds = true;
const cacheInserts: unknown[] = [];
vi.mock("../app/db", () => ({
  db: {
    delete: () => ({
      where: () => ({
        returning: () => Promise.resolve(claimSucceeds ? [{ id: "job_1" }] : []),
      }),
    }),
    insert: () => ({
      values: (v: unknown) => {
        cacheInserts.push(v);
        return { onConflictDoNothing: () => Promise.resolve() };
      },
    }),
  },
}));

import { settleJob, billStoppedJob, type ActiveJob } from "../app/lib/jobs";

const NOW = new Date("2026-07-15T12:00:00Z").getTime();

function job(overrides: Partial<Record<string, unknown>> = {}): ActiveJob {
  return {
    id: "job_1",
    userId: "user_1",
    gpuTier: "tl_small",
    jobType: "lens",
    modelName: "openai-community/gpt2",
    cacheKey: "ck_1",
    cachePayload: JSON.stringify({ prompt: "p", modelName: "openai-community/gpt2" }),
    startedAt: new Date(NOW - 5_000),
    ...overrides,
  } as unknown as ActiveJob;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  claimSucceeds = true;
  cacheInserts.length = 0;
  deductJobCost.mockClear().mockResolvedValue(0);
  putHeatmap.mockClear().mockResolvedValue(undefined);
  captureException.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("settleJob", () => {
  it("bills the backend-metered duration and usage, not wall clock", async () => {
    await settleJob(job(), {
      status: "done",
      data: { x: 1 },
      duration_ms: 10_000,
      cpu_core_s: 2,
      mem_gib_s: 3,
    });
    expect(deductJobCost).toHaveBeenCalledWith("user_1", "tl_small", 10_000, {
      cpuCoreS: 2,
      memGibS: 3,
    });
  });

  it("falls back to spawn→now wall clock when the backend reported no usage", async () => {
    await settleJob(job(), { status: "done", data: { x: 1 } });
    expect(deductJobCost).toHaveBeenCalledWith("user_1", "tl_small", 5_000, {
      cpuCoreS: undefined,
      memGibS: undefined,
    });
  });

  it("does not bill failed jobs (but still claims the row)", async () => {
    await settleJob(job(), { status: "error", duration_ms: 10_000 });
    expect(deductJobCost).not.toHaveBeenCalled();
    expect(cacheInserts).toHaveLength(0);
  });

  it("does not bill or write cache when another caller already claimed the row", async () => {
    claimSucceeds = false;
    await settleJob(job(), { status: "done", data: { x: 1 }, duration_ms: 10_000 });
    expect(deductJobCost).not.toHaveBeenCalled();
    expect(putHeatmap).not.toHaveBeenCalled();
    expect(cacheInserts).toHaveLength(0);
  });

  it("writes the result to R2 and inserts a cache row on success", async () => {
    await settleJob(job(), { status: "done", data: { x: 1 }, duration_ms: 10_000 });
    expect(putHeatmap).toHaveBeenCalledWith("ck_1", { x: 1 });
    expect(cacheInserts).toEqual([
      {
        id: "ck_1",
        prompt: "p",
        modelName: "openai-community/gpt2",
        userId: "user_1",
        r2Key: "ck_1",
      },
    ]);
  });

  it("skips the cache write when the job has no cacheKey", async () => {
    await settleJob(job({ cacheKey: null }), { status: "done", data: { x: 1 }, duration_ms: 10_000 });
    expect(deductJobCost).toHaveBeenCalled();
    expect(putHeatmap).not.toHaveBeenCalled();
    expect(cacheInserts).toHaveLength(0);
  });

  it("reports a failed deduction to Sentry instead of throwing", async () => {
    deductJobCost.mockRejectedValueOnce(new Error("db down"));
    await expect(
      settleJob(job(), { status: "done", data: { x: 1 }, duration_ms: 10_000 })
    ).resolves.toBeUndefined();
    expect(captureException).toHaveBeenCalled();
  });

  it("reports a failed cache write to Sentry without unwinding the settlement", async () => {
    putHeatmap.mockRejectedValueOnce(new Error("r2 down"));
    await expect(
      settleJob(job(), { status: "done", data: { x: 1 }, duration_ms: 10_000 })
    ).resolves.toBeUndefined();
    expect(deductJobCost).toHaveBeenCalled();
    expect(captureException).toHaveBeenCalled();
  });
});

describe("billStoppedJob", () => {
  it("bills from the exec-start heartbeat, not from spawn", async () => {
    // Spawned 5s ago, but execution only started 2s ago — bill 2s.
    await billStoppedJob(job(), (NOW - 2_000) / 1000);
    expect(deductJobCost).toHaveBeenCalledWith("user_1", "tl_small", 2_000);
  });

  it("charges nothing when the heartbeat says execution never started (null)", async () => {
    await billStoppedJob(job(), null);
    expect(deductJobCost).not.toHaveBeenCalled();
  });

  it("falls back to spawn→now wall clock when the caller has no heartbeat info", async () => {
    await billStoppedJob(job());
    expect(deductJobCost).toHaveBeenCalledWith("user_1", "tl_small", 5_000);
  });

  it("does not bill when another caller already claimed the row", async () => {
    claimSucceeds = false;
    await billStoppedJob(job(), (NOW - 2_000) / 1000);
    expect(deductJobCost).not.toHaveBeenCalled();
  });

  it("clamps a future exec-start timestamp to zero instead of billing negative time", async () => {
    await billStoppedJob(job(), (NOW + 60_000) / 1000);
    expect(deductJobCost).not.toHaveBeenCalled();
  });
});
