import { describe, it, expect } from "vitest";
import { TECHNIQUES, BAND_ACTIVATION, bandShadow } from "../app/lib/techniques";

// Every fill the info button can sit on. BAND_ACTIVATION is not in TECHNIQUES —
// activation and attribution share the "patching" key but not the fill.
const ALL_BAND_FILLS = [...TECHNIQUES.map(t => t.band), BAND_ACTIVATION];

const channels = (hex: string) =>
  [0, 2, 4].map(i => parseInt(hex.replace("#", "").slice(i, i + 2), 16));

describe("bandShadow", () => {
  it("returns a well-formed six-digit hex for every band fill", () => {
    for (const fill of ALL_BAND_FILLS) {
      expect(bandShadow(fill)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("is strictly darker than its fill on every channel that had room to move", () => {
    for (const fill of ALL_BAND_FILLS) {
      const before = channels(fill);
      const after = channels(bandShadow(fill));
      before.forEach((c, i) => {
        expect(after[i]).toBeLessThan(c);
        expect(after[i]).toBeGreaterThanOrEqual(0);
      });
    }
  });

  it("pads single-digit channels rather than emitting a short hex", () => {
    // 0x05 * 0.7 rounds to 0x04, which must render as "04" and not "4".
    expect(bandShadow("#050505")).toBe("#040404");
  });

  it("keeps black at black", () => {
    expect(bandShadow("#000000")).toBe("#000000");
  });
});
