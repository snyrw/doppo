import { describe, it, expect, vi, beforeEach } from "vitest";

// db mock: a single chainable object serves every select/insert/delete call.
// `selectQueue` controls what each `db.select(...)` call resolves to (queued,
// one entry consumed per call); insert/delete calls are recorded for assertion.
const selectQueue: unknown[][] = [];
const selectMock = vi.fn(() => {
  const rows = selectQueue.shift() ?? [];
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(rows).then(resolve, reject),
  };
  return chain;
});
const insertValuesMock = vi.fn().mockResolvedValue(undefined);
const deleteWhereMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/app/db", () => ({
  db: {
    select: () => selectMock(),
    insert: () => ({ values: (v: unknown) => insertValuesMock(v) }),
    delete: () => ({ where: (...args: unknown[]) => deleteWhereMock(...args) }),
  },
}));

import {
  saveSteeringPairSetForUser,
  listSteeringPairSetSummariesForUser,
  loadSteeringPairSetForUser,
  deleteSteeringPairSetForUser,
} from "../app/lib/steering-presets";

beforeEach(() => {
  selectQueue.length = 0;
  selectMock.mockClear();
  insertValuesMock.mockClear();
  deleteWhereMock.mockClear();
});

describe("saveSteeringPairSetForUser", () => {
  it("inserts a row and returns its id when under the cap", async () => {
    selectQueue.push([{ c: 3 }]); // cap-check count
    const { id } = await saveSteeringPairSetForUser("user_1", "my concept", "clean", "corrupted", [
      { clean: "a", corrupted: "b" },
    ]);
    expect(typeof id).toBe("string");
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id,
        userId: "user_1",
        name: "my concept",
        cleanPrompt: "clean",
        corruptedPrompt: "corrupted",
        extraPairs: [{ clean: "a", corrupted: "b" }],
      })
    );
  });

  it("rejects at the 20-set cap without inserting", async () => {
    selectQueue.push([{ c: 20 }]);
    await expect(
      saveSteeringPairSetForUser("user_1", "concept", "clean", "corrupted", [])
    ).rejects.toThrow("Saved set limit reached (20)");
    expect(insertValuesMock).not.toHaveBeenCalled();
  });

  it("rejects a name over 200 characters without querying the db", async () => {
    await expect(
      saveSteeringPairSetForUser("user_1", "x".repeat(201), "clean", "corrupted", [])
    ).rejects.toThrow(/200/);
    expect(selectMock).not.toHaveBeenCalled();
    expect(insertValuesMock).not.toHaveBeenCalled();
  });

  it("rejects more than MAX_EXTRA_PAIRS pairs", async () => {
    const tooMany = Array.from({ length: 100 }, () => ({ clean: "a", corrupted: "b" }));
    await expect(
      saveSteeringPairSetForUser("user_1", "concept", "clean", "corrupted", tooMany)
    ).rejects.toThrow(/99/);
    expect(insertValuesMock).not.toHaveBeenCalled();
  });

  it("rejects a pair with an over-length prompt", async () => {
    await expect(
      saveSteeringPairSetForUser("user_1", "concept", "clean", "corrupted", [
        { clean: "x".repeat(2001), corrupted: "b" },
      ])
    ).rejects.toThrow(/2000/);
    expect(insertValuesMock).not.toHaveBeenCalled();
  });
});

describe("listSteeringPairSetSummariesForUser", () => {
  it("maps rows to summaries", async () => {
    selectQueue.push([
      { id: "s1", name: "set one", pairCount: 5, createdAt: new Date("2026-07-01") },
      { id: "s2", name: "set two", pairCount: 1, createdAt: new Date("2026-07-02") },
    ]);
    const rows = await listSteeringPairSetSummariesForUser("user_1");
    expect(rows).toEqual([
      { id: "s1", name: "set one", pairCount: 5, createdAt: new Date("2026-07-01") },
      { id: "s2", name: "set two", pairCount: 1, createdAt: new Date("2026-07-02") },
    ]);
  });
});

describe("loadSteeringPairSetForUser", () => {
  it("returns the pair detail when found", async () => {
    selectQueue.push([
      { cleanPrompt: "clean", corruptedPrompt: "corrupted", extraPairs: [{ clean: "a", corrupted: "b" }] },
    ]);
    const detail = await loadSteeringPairSetForUser("user_1", "s1");
    expect(detail).toEqual({
      cleanPrompt: "clean",
      corruptedPrompt: "corrupted",
      extraPairs: [{ clean: "a", corrupted: "b" }],
    });
  });

  it("throws when the row doesn't exist or isn't owned by this user", async () => {
    selectQueue.push([]);
    await expect(loadSteeringPairSetForUser("user_1", "missing")).rejects.toThrow(
      "Saved pair set not found."
    );
  });
});

describe("deleteSteeringPairSetForUser", () => {
  it("calls delete scoped to the given id and userId", async () => {
    await deleteSteeringPairSetForUser("user_1", "s1");
    expect(deleteWhereMock).toHaveBeenCalledTimes(1);
  });
});
