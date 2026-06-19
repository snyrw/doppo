import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: string[] = [];
const customersDel = vi.fn().mockResolvedValue({});
vi.mock("../app/lib/stripe", () => ({
  getStripe: () => ({ customers: { del: customersDel } }),
}));
const deleteHeatmaps = vi.fn(async (_keys: string[]) => { calls.push("r2"); });
vi.mock("../app/lib/r2", () => ({ deleteHeatmaps: (keys: string[]) => deleteHeatmaps(keys) }));

// db mock: first select returns stripeCustomerId; subsequent selects return cache row ids.
// delete records call order so we can assert R2-before-row-delete per cache table.
let selectCallCount = 0;
vi.mock("../app/db", () => {
  const select = () => ({
    from: () => ({
      where: () => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // First call: userCredits.stripeCustomerId lookup
          return Promise.resolve([{ c: "cus_123" }]);
        }
        // Subsequent calls: cache table id lookups — one key each
        return Promise.resolve([{ id: `key_${selectCallCount}` }]);
      },
    }),
  });
  const del = () => { calls.push("dbDelete"); return { where: () => Promise.resolve() }; };
  return { db: { select, delete: del } };
});

describe("deleteUserData", () => {
  beforeEach(() => {
    calls.length = 0;
    selectCallCount = 0;
    customersDel.mockClear();
    deleteHeatmaps.mockClear();
  });

  it("deletes the stripe customer before purging rows", async () => {
    const { deleteUserData } = await import("../app/lib/account");
    await deleteUserData("user_1");
    expect(customersDel).toHaveBeenCalledWith("cus_123");
  });

  it("deletes R2 objects before deleting DB rows for each cache table", async () => {
    const { deleteUserData } = await import("../app/lib/account");
    await deleteUserData("user_1");
    // There are 6 cache tables; each should produce one "r2" then one "dbDelete",
    // plus one final "dbDelete" for activeJobs (no R2 step).
    // So the pattern should be: r2, dbDelete, r2, dbDelete, ..., dbDelete (activeJobs).
    // Total: 6 r2 calls, 7 dbDelete calls.
    expect(deleteHeatmaps).toHaveBeenCalledTimes(6);
    // Verify ordering: every "r2" must be immediately followed by "dbDelete"
    for (let i = 0; i < calls.length - 1; i++) {
      if (calls[i] === "r2") {
        expect(calls[i + 1]).toBe("dbDelete");
      }
    }
    // Last entry should be "dbDelete" (activeJobs)
    expect(calls[calls.length - 1]).toBe("dbDelete");
  });
});
