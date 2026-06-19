import { describe, it, expect } from "vitest";
import { buildDataExport } from "../app/lib/data-export";

describe("buildDataExport", () => {
  it("assembles profile, projects, and ledger with a timestamp", () => {
    const out = buildDataExport(
      { name: "A", email: "a@b.c", emailVerified: true, createdAt: new Date("2026-01-01") },
      [{ id: "p1", name: "Proj", cards: [], canvas: {}, createdAt: new Date("2026-02-01"), updatedAt: new Date("2026-02-02") }],
      [{ type: "purchase", amountMicros: 500000, jobTier: null, jobDurationMs: null, createdAt: new Date("2026-03-01") }],
    );
    expect(out.profile.email).toBe("a@b.c");
    expect(out.projects).toHaveLength(1);
    expect(out.creditLedger[0].type).toBe("purchase");
    expect(typeof out.exportedAt).toBe("string");
  });
});
