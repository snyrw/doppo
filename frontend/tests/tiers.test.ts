import { describe, it, expect } from "vitest";
import { isGatedTier, GATED_TIERS } from "../app/lib/tiers";

describe("isGatedTier", () => {
  it("gates large and above", () => {
    expect(isGatedTier("tl_large")).toBe(true);
    expect(isGatedTier("tl_xlarge")).toBe(true);
    expect(isGatedTier("tl_xxlarge")).toBe(true);
  });

  it("does not gate small or medium", () => {
    expect(isGatedTier("tl_small")).toBe(false);
    expect(isGatedTier("tl_medium")).toBe(false);
  });

  it("does not gate unknown tiers", () => {
    expect(isGatedTier("tl_bogus")).toBe(false);
  });

  it("GATED_TIERS holds exactly the three gated tiers", () => {
    expect([...GATED_TIERS].sort()).toEqual(["tl_large", "tl_xlarge", "tl_xxlarge"]);
  });
});
