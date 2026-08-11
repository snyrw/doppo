import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

/* Collaborators are mocked so the route's own branching is what is under test:
   who is allowed to poll a job, when a job gets settled, and what the client is
   told when the backend does not answer. */

let authResult: unknown = { userId: "user_1" };
const backendFetch = vi.fn();

vi.mock("@/app/lib/api-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/lib/api-helpers")>();
  return {
    ...actual,
    requireAuth: () => Promise.resolve(authResult),
    backendFetch: (...a: unknown[]) => backendFetch(...a),
  };
});

let jobRows: Record<string, unknown>[] = [];
vi.mock("@/app/db", () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: () => Promise.resolve(jobRows) }) }),
    }),
  },
}));

const settleJob = vi.fn().mockResolvedValue(undefined);
const billStoppedJob = vi.fn().mockResolvedValue(undefined);
vi.mock("@/app/lib/jobs", () => ({
  settleJob: (...a: unknown[]) => settleJob(...a),
  billStoppedJob: (...a: unknown[]) => billStoppedJob(...a),
}));

import { GET, DELETE } from "@/app/api/job/[jobId]/route";

const ctx = (jobId = "job_1") => ({ params: Promise.resolve({ jobId }) });
const request = {} as NextRequest;

const job = (overrides: Record<string, unknown> = {}) => ({
  id: "job_1",
  userId: "user_1",
  gpuTier: "tl_small",
  cacheKey: "ck_1",
  ...overrides,
});

const backendJson = (body: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 500, json: async () => body }) as unknown as Response;

beforeEach(() => {
  authResult = { userId: "user_1" };
  jobRows = [job()];
  backendFetch.mockReset();
  settleJob.mockClear().mockResolvedValue(undefined);
  billStoppedJob.mockClear().mockResolvedValue(undefined);
});

describe("GET ownership", () => {
  it("relays the auth failure response untouched", async () => {
    authResult = new Response("Unauthorized", { status: 401 });
    const res = await GET(request, ctx());
    expect(res.status).toBe(401);
    expect(backendFetch).not.toHaveBeenCalled();
  });

  it("refuses to poll another user's job", async () => {
    jobRows = [job({ userId: "user_2" })];
    const res = await GET(request, ctx());
    expect(res.status).toBe(403);
    expect(backendFetch).not.toHaveBeenCalled();
    expect(settleJob).not.toHaveBeenCalled();
  });
});

describe("GET while the job is running", () => {
  it("maps the backend's snake_case progress fields to the client's shape", async () => {
    backendFetch.mockResolvedValue(
      backendJson({
        status: "running",
        stage: "downloading_weights",
        stage_age_s: 12,
        progress: { done_bytes: 1000, total_bytes: 5000 },
      })
    );
    const res = await GET(request, ctx());
    expect(await res.json()).toEqual({
      status: "running",
      stage: "downloading_weights",
      stageAgeS: 12,
      progress: { doneBytes: 1000, totalBytes: 5000 },
    });
  });

  it("nulls the fields the backend omitted rather than dropping them", async () => {
    backendFetch.mockResolvedValue(backendJson({ status: "running" }));
    expect(await (await GET(request, ctx())).json()).toEqual({
      status: "running",
      stage: null,
      stageAgeS: null,
      progress: null,
    });
  });

  it("carries a download with an unknown total", async () => {
    backendFetch.mockResolvedValue(
      backendJson({ status: "running", progress: { done_bytes: 900, total_bytes: null } })
    );
    const body = await (await GET(request, ctx())).json();
    expect(body.progress).toEqual({ doneBytes: 900, totalBytes: null });
  });

  it("does not settle a job that is still running, so nothing is billed early", async () => {
    backendFetch.mockResolvedValue(backendJson({ status: "running" }));
    await GET(request, ctx());
    expect(settleJob).not.toHaveBeenCalled();
  });
});

describe("GET when the backend does not answer", () => {
  it("reports running on a network failure, so the client keeps polling a live job", async () => {
    backendFetch.mockRejectedValue(new Error("fetch failed"));
    const res = await GET(request, ctx());
    expect(await res.json()).toMatchObject({ status: "running" });
    expect(settleJob).not.toHaveBeenCalled();
  });

  it("reports an error carrying the status code on a non-ok poll", async () => {
    backendFetch.mockResolvedValue(backendJson({}, false));
    const body = await (await GET(request, ctx())).json();
    expect(body).toEqual({ status: "error", error: "Poll failed (500)" });
    expect(settleJob).not.toHaveBeenCalled();
  });
});

describe("GET when the job finishes", () => {
  const done = { status: "done", data: { x: 1 }, duration_ms: 10_000 };

  it("settles the job and returns the data with its cache key", async () => {
    backendFetch.mockResolvedValue(backendJson(done));
    const res = await GET(request, ctx());

    expect(settleJob).toHaveBeenCalledWith(expect.objectContaining({ id: "job_1" }), done);
    expect(await res.json()).toEqual({ status: "done", data: { x: 1 }, cacheKey: "ck_1" });
  });

  it("relays the result without settling when the row is already gone", async () => {
    // The sweeper or a concurrent poll got there first and did the billing.
    // Settling twice would charge the user twice.
    jobRows = [];
    backendFetch.mockResolvedValue(backendJson(done));
    const res = await GET(request, ctx());

    expect(settleJob).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ status: "done", data: { x: 1 }, cacheKey: null });
  });

  it("settles a failed job too, then relays the backend's message", async () => {
    const failed = { status: "error", error: "Prompt too long: 99 tokens (max 48)." };
    backendFetch.mockResolvedValue(backendJson(failed));
    const res = await GET(request, ctx());

    expect(settleJob).toHaveBeenCalledWith(expect.objectContaining({ id: "job_1" }), failed);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Prompt too long: 99 tokens (max 48).",
    });
  });

  it("substitutes a message when the backend reports an error without one", async () => {
    backendFetch.mockResolvedValue(backendJson({ status: "error" }));
    expect(await (await GET(request, ctx())).json()).toEqual({
      status: "error",
      error: "Unknown error",
    });
  });
});

describe("DELETE", () => {
  beforeEach(() => {
    backendFetch.mockResolvedValue(backendJson({ exec_started_ts: 990 }));
  });

  it("relays the auth failure response untouched", async () => {
    authResult = new Response("Unauthorized", { status: 401 });
    const res = await DELETE(request, ctx());
    expect(res.status).toBe(401);
    expect(billStoppedJob).not.toHaveBeenCalled();
  });

  it("refuses to cancel another user's job", async () => {
    jobRows = [job({ userId: "user_2" })];
    const res = await DELETE(request, ctx());
    expect(res.status).toBe(403);
    expect(backendFetch).not.toHaveBeenCalled();
    expect(billStoppedJob).not.toHaveBeenCalled();
  });

  it("bills from the backend's exec-start timestamp, not from spawn", async () => {
    await DELETE(request, ctx());
    expect(billStoppedJob).toHaveBeenCalledWith(expect.objectContaining({ id: "job_1" }), 990);
  });

  it("passes through a null exec start, which means the job never began running", async () => {
    backendFetch.mockResolvedValue(backendJson({ exec_started_ts: null }));
    await DELETE(request, ctx());
    expect(billStoppedJob).toHaveBeenCalledWith(expect.anything(), null);
  });

  it("leaves the exec start unknown when the backend answers without it", async () => {
    // undefined and null differ here: undefined makes billStoppedJob fall back to
    // spawn-to-now wall clock, null means charge nothing.
    backendFetch.mockResolvedValue(backendJson({}));
    await DELETE(request, ctx());
    expect(billStoppedJob).toHaveBeenCalledWith(expect.anything(), undefined);
  });

  it("still bills and reports success when the backend cancel fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    backendFetch.mockRejectedValue(new Error("backend down"));

    const res = await DELETE(request, ctx());
    expect(await res.json()).toEqual({ cancelled: true });
    expect(billStoppedJob).toHaveBeenCalledWith(expect.anything(), undefined);
    consoleError.mockRestore();
  });

  it("bills nothing when the job was already settled", async () => {
    jobRows = [];
    const res = await DELETE(request, ctx());
    expect(billStoppedJob).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ cancelled: true });
  });
});
