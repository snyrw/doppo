// frontend/tests/palette.test.ts
import { describe, it, expect } from "vitest";
import {
  interpolateColor,
  interpolateColorDivergent,
  getContrastColor,
  getHeadColor,
} from "../app/lib/palette";

describe("interpolateColor — warm-mono", () => {
  it("uses prob directly as rgba alpha", () => {
    expect(interpolateColor("warm-mono", 0)).toBe("rgba(175, 118, 32, 0)");
    expect(interpolateColor("warm-mono", 1)).toBe("rgba(175, 118, 32, 1)");
    expect(interpolateColor("warm-mono", 0.5)).toBe("rgba(175, 118, 32, 0.5)");
  });
});

describe("interpolateColor — rdbu", () => {
  it("prob=0 returns first stop (deep blue)", () => {
    expect(interpolateColor("rdbu", 0)).toBe("rgb(5,48,97)");
  });

  it("prob=1 returns last stop (deep red)", () => {
    expect(interpolateColor("rdbu", 1)).toBe("rgb(103,0,31)");
  });

  it("returns rgb() format", () => {
    expect(interpolateColor("rdbu", 0.5)).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
  });

  it("prob < 0 clamps to prob=0", () => {
    expect(interpolateColor("rdbu", -1)).toBe(interpolateColor("rdbu", 0));
  });

  it("prob > 1 clamps to prob=1", () => {
    expect(interpolateColor("rdbu", 2)).toBe(interpolateColor("rdbu", 1));
  });
});

describe("interpolateColor — viridis", () => {
  it("prob=0 returns first stop (deep purple)", () => {
    expect(interpolateColor("viridis", 0)).toBe("rgb(68,1,84)");
  });

  it("prob=1 returns last stop (bright yellow)", () => {
    expect(interpolateColor("viridis", 1)).toBe("rgb(253,231,37)");
  });
});

describe("interpolateColor — inferno", () => {
  it("prob=0 returns first stop (near black)", () => {
    expect(interpolateColor("inferno", 0)).toBe("rgb(0,0,4)");
  });

  it("prob=1 returns last stop (pale yellow)", () => {
    expect(interpolateColor("inferno", 1)).toBe("rgb(252,255,164)");
  });
});

describe("interpolateColorDivergent", () => {
  it("absMax=0 returns midpoint (t=0.5)", () => {
    expect(interpolateColorDivergent("rdbu", 0, 0)).toBe(interpolateColor("rdbu", 0.5));
  });

  it("value=+absMax maps to t=1", () => {
    expect(interpolateColorDivergent("rdbu", 10, 10)).toBe(interpolateColor("rdbu", 1));
  });

  it("value=-absMax maps to t=0", () => {
    expect(interpolateColorDivergent("rdbu", -10, 10)).toBe(interpolateColor("rdbu", 0));
  });

  it("value=0 with absMax>0 maps to t=0.5 (neutral)", () => {
    expect(interpolateColorDivergent("rdbu", 0, 10)).toBe(interpolateColor("rdbu", 0.5));
  });

  it("positive value maps above neutral", () => {
    const neutral = interpolateColor("rdbu", 0.5);
    const positive = interpolateColorDivergent("rdbu", 5, 10);
    expect(positive).not.toBe(neutral);
  });

  it("clamps value beyond ±absMax", () => {
    expect(interpolateColorDivergent("rdbu", 20, 10)).toBe(interpolateColor("rdbu", 1));
    expect(interpolateColorDivergent("rdbu", -20, 10)).toBe(interpolateColor("rdbu", 0));
  });
});

describe("getContrastColor", () => {
  it("warm-mono: prob > 0.55 → light text", () => {
    expect(getContrastColor("warm-mono", 0.6)).toBe("#ecebe4");
    expect(getContrastColor("warm-mono", 1.0)).toBe("#ecebe4");
  });

  it("warm-mono: prob <= 0.55 → dark text", () => {
    expect(getContrastColor("warm-mono", 0.5)).toBe("#1c1c1c");
    expect(getContrastColor("warm-mono", 0.0)).toBe("#1c1c1c");
  });

  it("inferno prob=0 (near-black background) → light text", () => {
    expect(getContrastColor("inferno", 0)).toBe("#ecebe4");
  });

  it("viridis prob=1 (bright yellow background) → dark text", () => {
    expect(getContrastColor("viridis", 1)).toBe("#1c1c1c");
  });

  it("rdbu prob=0 (deep blue background) → light text", () => {
    expect(getContrastColor("rdbu", 0)).toBe("#ecebe4");
  });
});

describe("getHeadColor", () => {
  it("returns a valid HSL string", () => {
    expect(getHeadColor(0, 8, 0.5)).toMatch(
      /^hsl\(\d+(\.\d+)?, \d+(\.\d+)?%, \d+(\.\d+)?%\)$/
    );
  });

  it("distributes hue evenly — 4 heads are 90° apart", () => {
    const h0 = getHeadColor(0, 4, 1);
    const h1 = getHeadColor(1, 4, 1);
    const h2 = getHeadColor(2, 4, 1);
    expect(h0).toContain("0.0,");   // hue = 0
    expect(h1).toContain("90.0,");  // hue = 90
    expect(h2).toContain("180.0,"); // hue = 180
  });

  it("nHeads=0 does not throw (uses max(nHeads,1))", () => {
    expect(() => getHeadColor(0, 0, 0.5)).not.toThrow();
  });

  it("weight=0 gives minimum saturation and near-white lightness", () => {
    const result = getHeadColor(0, 8, 0);
    // saturation = 0*80=0%, lightness = 95-0=95%
    expect(result).toContain("0.0%,");
    expect(result).toContain("95.0%");
  });

  it("weight=1 gives maximum saturation and minimum lightness", () => {
    const result = getHeadColor(0, 8, 1);
    // saturation = 1*80=80%, lightness = 95-70=25%
    expect(result).toContain("80.0%,");
    expect(result).toContain("25.0%");
  });
});
