import { describe, it, expect, vi, beforeEach } from "vitest";
import { userCredits, creditLedger } from "../app/schema";

/* The fake db records inserts against the table they targeted rather than the
   order they arrived in, so reordering unrelated writes does not break a test. */
const inserts: { table: unknown; values: Record<string, unknown> }[] = [];
const rowsFor = (table: unknown) =>
  inserts.filter((i) => i.table === table).map((i) => i.values);

/** Rows the monthly-grant UPDATE returns. Non-empty means the grant was applied. */
let grantRows: { balance_micros: number }[] = [];
/** Row the balance lookup returns when no grant was due. */
let balanceRows: { b: number }[] = [];

vi.mock("../app/db", () => ({
  db: {
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    insert: (table: unknown) => ({
      values: (v: Record<string, unknown>) => {
        inserts.push({ table, values: v });
        return Object.assign(Promise.resolve(), {
          onConflictDoNothing: () => Promise.resolve(),
        });
      },
    }),
    execute: () => Promise.resolve({ rows: grantRows }),
    select: () => ({ from: () => ({ where: () => Promise.resolve(balanceRows) }) }),
  },
}));

import { deductJobCost, checkBalance, ensureGrantAndGetBalance } from "../app/lib/credits";
import { FREE_MONTHLY_GRANT_MICROS } from "../app/lib/rates";

beforeEach(() => {
  inserts.length = 0;
  grantRows = [];
  balanceRows = [];
});

describe("deductJobCost", () => {
  /* The expected costs below are worked out by hand, not recomputed from
     rates.ts. A test that reads the same rate constant the code reads would
     still pass after a mispriced rate change, which is the one failure that
     matters here. */

  it("charges GPU wall time plus metered CPU and memory, ceiled to whole micros", async () => {
    // 10s L4 at 222/s = 2220, plus 2 core-s at 13.1 = 26.2, plus 3 GiB-s at 2.22
    // = 6.66. Total 2252.86.
    const cost = await deductJobCost("user_1", "tl_small", 10_000, { cpuCoreS: 2, memGibS: 3 });
    expect(cost).toBe(2253);
  });

  it("charges GPU time only when no usage is metered", async () => {
    // 90s L4 at 222/s.
    const cost = await deductJobCost("user_1", "tl_small", 90_000);
    expect(cost).toBe(19_980);
  });

  it("writes a negative usage ledger row matching the deducted amount", async () => {
    const cost = await deductJobCost("user_1", "tl_medium", 60_000);
    expect(rowsFor(creditLedger)).toEqual([
      {
        userId: "user_1",
        type: "usage",
        amountMicros: -cost,
        jobTier: "tl_medium",
        jobDurationMs: 60_000,
      },
    ]);
  });

  it("rejects unknown GPU tiers before touching the balance", async () => {
    await expect(deductJobCost("user_1", "tl_mega", 1_000)).rejects.toThrow("Unknown GPU tier");
    expect(inserts).toHaveLength(0);
  });
});

describe("ensureGrantAndGetBalance", () => {
  it("writes a free_grant ledger row and returns the topped-up balance", async () => {
    grantRows = [{ balance_micros: 1_500_000 }];
    const balance = await ensureGrantAndGetBalance("user_1");

    expect(balance).toBe(1_500_000);
    expect(rowsFor(creditLedger)).toEqual([
      { userId: "user_1", type: "free_grant", amountMicros: FREE_MONTHLY_GRANT_MICROS },
    ]);
  });

  it("grants nothing when this month's grant was already taken", async () => {
    // The UPDATE is guarded on last_free_grant_month, so no returned row means
    // no grant. A ledger row here would be free money, once per call.
    grantRows = [];
    balanceRows = [{ b: 250_000 }];
    const balance = await ensureGrantAndGetBalance("user_1");

    expect(balance).toBe(250_000);
    expect(rowsFor(creditLedger)).toEqual([]);
  });

  it("reports a zero balance for a user with no credits row yet", async () => {
    grantRows = [];
    balanceRows = [];
    expect(await ensureGrantAndGetBalance("user_1")).toBe(0);
  });

  it("bootstraps a credits row without overwriting an existing balance", async () => {
    grantRows = [];
    balanceRows = [{ b: 250_000 }];
    await ensureGrantAndGetBalance("user_1");
    expect(rowsFor(userCredits)).toEqual([{ userId: "user_1", balanceMicros: 0 }]);
  });
});

describe("checkBalance", () => {
  /* The floor is the cost of a minimum-length job on that tier: 90s on tl_small.
     It stops a user starting a job they clearly cannot pay for. */

  it("allows a balance exactly at the tier floor", async () => {
    balanceRows = [{ b: 19_980 }];
    expect(await checkBalance("user_1", "tl_small")).toEqual({
      allowed: true,
      balanceMicros: 19_980,
    });
  });

  it("blocks a balance one micro under the floor", async () => {
    balanceRows = [{ b: 19_979 }];
    expect((await checkBalance("user_1", "tl_small")).allowed).toBe(false);
  });

  it("holds a bigger tier to a bigger floor", async () => {
    // 150s L40S at 542/s = 81_300, well over tl_small's 19_980.
    balanceRows = [{ b: 50_000 }];
    expect((await checkBalance("user_1", "tl_small")).allowed).toBe(true);
    expect((await checkBalance("user_1", "tl_medium")).allowed).toBe(false);
  });

  it("blocks a negative balance left by an overrunning job", async () => {
    balanceRows = [{ b: -5_000 }];
    expect((await checkBalance("user_1", "tl_small")).allowed).toBe(false);
  });

  it("rejects an unknown tier rather than treating it as free", async () => {
    balanceRows = [{ b: 1_000_000 }];
    await expect(checkBalance("user_1", "tl_mega")).rejects.toThrow("Unknown GPU tier");
  });
});
