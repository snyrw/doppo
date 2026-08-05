import { describe, it, expect, vi, beforeEach } from "vitest";

// db mock: update().set().where() applies the balance delta; insert().values()
// records ledger rows so the audit amounts can be asserted.
const ledgerInserts: Record<string, unknown>[] = [];
vi.mock("../app/db", () => ({
  db: {
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        ledgerInserts.push(v);
        return Promise.resolve();
      },
    }),
  },
}));

import { deductJobCost } from "../app/lib/credits";
import {
  TIER_RATES_MICROS_PER_SEC,
  CPU_RATE_MICROS_PER_CORE_SEC,
  MEM_RATE_MICROS_PER_GIB_SEC,
} from "../app/lib/rates";

beforeEach(() => {
  ledgerInserts.length = 0;
});

describe("deductJobCost", () => {
  it("charges GPU wall time plus metered CPU and memory, ceiled to whole micros", async () => {
    const cost = await deductJobCost("user_1", "tl_small", 10_000, { cpuCoreS: 2, memGibS: 3 });
    const expected = Math.ceil(
      (10_000 * TIER_RATES_MICROS_PER_SEC.tl_small) / 1000 +
        2 * CPU_RATE_MICROS_PER_CORE_SEC +
        3 * MEM_RATE_MICROS_PER_GIB_SEC
    );
    expect(cost).toBe(expected);
    expect(cost).toBe(2253); // 2220 GPU + 26.2 CPU + 6.66 mem, ceiled
  });

  it("charges GPU time only when no usage is metered", async () => {
    const cost = await deductJobCost("user_1", "tl_small", 90_000);
    expect(cost).toBe(90 * TIER_RATES_MICROS_PER_SEC.tl_small);
  });

  it("writes a negative usage ledger row matching the deducted amount", async () => {
    const cost = await deductJobCost("user_1", "tl_medium", 60_000);
    expect(ledgerInserts).toEqual([
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
    expect(ledgerInserts).toHaveLength(0);
  });
});
