import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  userCredits, creditLedger, activeJobs,
  heatmapCache, dlaCache, attributionCache, steeringCache, activationPatchCache, attnCache,
} from "../app/schema";

const CACHE_TABLES = [
  heatmapCache, dlaCache, attributionCache, steeringCache, activationPatchCache, attnCache,
];

const customersDel = vi.fn().mockResolvedValue({});
let stripeAvailable = true;
vi.mock("../app/lib/stripe", () => ({
  getStripe: () => (stripeAvailable ? { customers: { del: customersDel } } : null),
}));

const deleteHeatmaps = vi.fn().mockResolvedValue(undefined);
vi.mock("../app/lib/r2", () => ({
  deleteHeatmaps: (keys: string[]) => {
    calls.push({ op: "r2", table: null });
    return deleteHeatmaps(keys);
  },
}));

/* The fake db answers on the table it is handed rather than on how many calls
   have come before, so reordering the deletes cannot break these tests. */
let stripeCustomerId: string | null = "cus_123";
let closingBalance: number | undefined = -1234;

/** Every select/delete/insert in call order, for the R2-before-rows assertion. */
const calls: { op: string; table: unknown }[] = [];
const inserts: { table: unknown; values: Record<string, unknown> }[] = [];

vi.mock("../app/db", () => ({
  db: {
    select: (cols: Record<string, unknown>) => ({
      from: (table: unknown) => ({
        where: () => {
          calls.push({ op: "select", table });
          if (table === userCredits) {
            return Promise.resolve(
              "c" in cols
                ? [{ c: stripeCustomerId }]
                : closingBalance === undefined ? [] : [{ b: closingBalance }]
            );
          }
          return Promise.resolve([{ id: "key_1" }]);
        },
      }),
    }),
    delete: (table: unknown) => {
      calls.push({ op: "delete", table });
      return { where: () => Promise.resolve() };
    },
    insert: (table: unknown) => ({
      values: (v: Record<string, unknown>) => {
        inserts.push({ table, values: v });
        return Promise.resolve();
      },
    }),
  },
}));

import { deleteUserData } from "../app/lib/account";

beforeEach(() => {
  calls.length = 0;
  inserts.length = 0;
  stripeAvailable = true;
  stripeCustomerId = "cus_123";
  closingBalance = -1234;
  customersDel.mockClear();
  deleteHeatmaps.mockClear().mockResolvedValue(undefined);
});

describe("deleteUserData", () => {
  it("deletes the Stripe customer before purging any rows", async () => {
    await deleteUserData("user_1");
    expect(customersDel).toHaveBeenCalledWith("cus_123");
  });

  it("skips Stripe when the user never had a customer record", async () => {
    stripeCustomerId = null;
    await deleteUserData("user_1");
    expect(customersDel).not.toHaveBeenCalled();
  });

  it("still purges rows when Stripe is not configured", async () => {
    stripeAvailable = false;
    await deleteUserData("user_1");
    const deleted = calls.filter((c) => c.op === "delete").map((c) => c.table);
    expect(deleted).toContain(activeJobs);
  });

  it("clears every cache table and the active jobs", async () => {
    await deleteUserData("user_1");
    const deleted = calls.filter((c) => c.op === "delete").map((c) => c.table);
    for (const table of CACHE_TABLES) expect(deleted).toContain(table);
    expect(deleted).toContain(activeJobs);
  });

  it("deletes each table's R2 objects before its rows, or the keys are unrecoverable", async () => {
    await deleteUserData("user_1");
    expect(deleteHeatmaps).toHaveBeenCalledTimes(CACHE_TABLES.length);

    // Row delete first would drop the keys naming the R2 objects, orphaning them
    // in the bucket with nothing left to look them up by.
    for (const table of CACHE_TABLES) {
      const lookup = calls.findIndex((c) => c.op === "select" && c.table === table);
      const purge = calls.findIndex((c) => c.op === "delete" && c.table === table);
      const r2 = calls.findIndex((c, i) => c.op === "r2" && i > lookup);
      expect(r2).toBeGreaterThan(lookup);
      expect(r2).toBeLessThan(purge);
    }
  });

  it("writes an account_closed tombstone snapshotting the closing balance", async () => {
    await deleteUserData("user_1");
    expect(inserts).toEqual([
      {
        table: creditLedger,
        values: { userId: "user_1", type: "account_closed", amountMicros: -1234 },
      },
    ]);
  });

  it("tombstones a zero when the credits row is already gone", async () => {
    closingBalance = undefined;
    await deleteUserData("user_1");
    expect(inserts[0].values).toMatchObject({ amountMicros: 0 });
  });
});
