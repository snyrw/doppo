import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runJob } from "../app/projects/hooks/job-runner";
import type { AppAction } from "../app/projects/types";

const jsonResponse = (body: unknown) => ({ ok: true, json: async () => body });

// Stage keys dispatched via CARD_STAGE, in order.
const dispatchedStages = (dispatch: ReturnType<typeof vi.fn>) =>
  dispatch.mock.calls
    .map(([a]) => a as AppAction)
    .filter((a) => a.type === "CARD_STAGE")
    .map((a) => (a as { stage: { stage: string | null } }).stage.stage);

describe("runJob done sweep", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });
    vi.stubGlobal(
      "CustomEvent",
      class {
        constructor(public type: string) {}
      }
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("plays remaining phases through before resolving", async () => {
    // Job finishes before any stage was ever observed (phase 1): the sweep
    // must tick phases 2, 3, and the all-done state before onResolve fires.
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ jobId: "j1" }))
      .mockResolvedValueOnce(jsonResponse({ status: "done", data: { x: 1 } }));
    vi.stubGlobal("fetch", fetch);

    const dispatch = vi.fn();
    const onResolve = vi.fn();
    const run = runJob({
      endpoint: "/api/job/spawn-lens",
      body: {},
      cardId: "c1",
      startedAt: Date.now(),
      dispatch,
      onResolve,
    });

    await vi.advanceTimersByTimeAsync(2000); // first poll returns done
    expect(onResolve).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000); // sweep steps elapse
    await run;

    expect(dispatchedStages(dispatch)).toEqual(["loading_model", "computing", "done"]);
    expect(onResolve).toHaveBeenCalledWith({ x: 1 });
  });

  it("sweeps only the unseen phases when compute stages were observed", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ jobId: "j1" }))
      .mockResolvedValueOnce(jsonResponse({ status: "running", stage: "computing" }))
      .mockResolvedValueOnce(jsonResponse({ status: "done", data: { x: 2 } }));
    vi.stubGlobal("fetch", fetch);

    const dispatch = vi.fn();
    const onResolve = vi.fn();
    const run = runJob({
      endpoint: "/api/job/spawn-lens",
      body: {},
      cardId: "c1",
      startedAt: Date.now(),
      dispatch,
      onResolve,
    });

    await vi.advanceTimersByTimeAsync(5000); // two polls + sweep
    await run;

    expect(dispatchedStages(dispatch)).toEqual(["computing", "done"]);
    expect(onResolve).toHaveBeenCalledWith({ x: 2 });
  });

  it("resolves cached spawns immediately with no sweep", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: "cached", data: { x: 3 } }));
    vi.stubGlobal("fetch", fetch);

    const dispatch = vi.fn();
    const onResolve = vi.fn();
    await runJob({
      endpoint: "/api/job/spawn-lens",
      body: {},
      cardId: "c1",
      startedAt: Date.now(),
      dispatch,
      onResolve,
    });

    expect(dispatchedStages(dispatch)).toEqual([]);
    expect(onResolve).toHaveBeenCalledWith({ x: 3 });
  });
});
