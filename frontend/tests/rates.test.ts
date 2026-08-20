import { describe, it, expect } from "vitest";
import { formatTierRate } from "../app/lib/rates";

describe("formatTierRate", () => {
  it("formats a known tier as label · cents/min", () => {
    expect(formatTierRate("tl_medium")).toBe("L40S · 3.3¢/min");
  });

  it("returns null for an unresolved tier", () => {
    expect(formatTierRate(undefined)).toBeNull();
  });

  it("returns null for an unknown tier", () => {
    expect(formatTierRate("tl_bogus")).toBeNull();
  });
});
