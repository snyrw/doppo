// frontend/tests/techniqueFigures.test.ts
import { describe, it, expect } from "vitest";
import { LENS_COLS, LENS_ROWS, LENS_GRID } from "../app/components/sections/techniqueFigureData";

describe("logit lens grid (real GPT-2 Small run, 'Hello, world.')", () => {
  it("has one row per layer label and one column per position token", () => {
    expect(LENS_COLS).toEqual(["Hello", ",", "world", "."]);
    expect(LENS_ROWS).toEqual([0, 2, 4, 6, 8, 9, 10, 11]);
    expect(LENS_GRID).toHaveLength(LENS_ROWS.length);
    for (const row of LENS_GRID) expect(row).toHaveLength(LENS_COLS.length);
  });

  it("never hits the top confidence level in the first two (shallowest) rows", () => {
    const maxLevel = (row: { level: number }[]) => Math.max(...row.map((c) => c.level));
    expect(maxLevel(LENS_GRID[0])).toBeLessThan(3);
    expect(maxLevel(LENS_GRID[1])).toBeLessThan(3);
  });

  it("hits top confidence mid-stack on the 'world' column ('!' takes over)", () => {
    // Real run: layers 8-10 all land on "!" at >=0.85 for this column before
    // the prompt ends — the clearest "locks on" moment in this short prompt.
    const col = LENS_GRID.map((row) => row[2]);
    expect(col.some((c) => c.level === 3)).toBe(true);
  });

  it("never confidently resolves in the final row on this short prompt", () => {
    // Unlike the old IOI-prompt data, "Hello, world." has no strongly likely
    // continuation, so the real final-layer top-1 stays low-confidence.
    const last = LENS_GRID[LENS_GRID.length - 1];
    expect(last.every((c) => c.level < 2)).toBe(true);
  });
});

import { ATTN_TOKENS, ATTN_GRID } from "../app/components/sections/techniqueFigureData";

describe("attention grid (Gemma Hello,world. pattern)", () => {
  it("is lower-triangular over the bos-prefixed prompt", () => {
    expect(ATTN_TOKENS).toEqual(["<bos>", "Hello", ",", "world", "."]);
    expect(ATTN_GRID).toHaveLength(ATTN_TOKENS.length);
    ATTN_GRID.forEach((row, r) => {
      expect(row).toHaveLength(ATTN_TOKENS.length);
      for (let cKey = r + 1; cKey < row.length; cKey++) expect(row[cKey]).toBe(""); // upper triangle empty
    });
  });

  it("makes comma→Hello and period→world the only strong cells", () => {
    const strong: [number, number][] = [];
    ATTN_GRID.forEach((row, r) => row.forEach((s, cKey) => s === "strong" && strong.push([r, cKey])));
    // row 2 = ",", col 1 = "Hello"; row 4 = ".", col 3 = "world"
    expect(strong).toEqual([
      [2, 1],
      [4, 3],
    ]);
  });
});

import { DLA_BARS } from "../app/components/sections/techniqueFigureData";

describe("DLA bars (per-layer, 8x stride)", () => {
  it("labels each bar with its layer and uses the requested signs", () => {
    expect(DLA_BARS.map((b) => b.label)).toEqual(["L0", "L8", "L16", "L24", "L31"]);
    const by = Object.fromEntries(DLA_BARS.map((b) => [b.label, b.signed]));
    expect(by.L0).toBeGreaterThan(0);
    expect(by.L8).toBeGreaterThan(0);
    expect(by.L24).toBeGreaterThan(0);
    expect(by.L16).toBeLessThan(0); // L16 negative
  });

  it("is strongest at the bottom (last bar has the largest magnitude, positive)", () => {
    const last = DLA_BARS[DLA_BARS.length - 1];
    expect(last.label).toBe("L31");
    expect(last.signed).toBeGreaterThan(0);
    for (let i = 0; i < DLA_BARS.length - 1; i++) {
      expect(Math.abs(DLA_BARS[i].signed)).toBeLessThan(Math.abs(last.signed));
    }
  });
});

import { PATCH_PAIRS } from "../app/components/sections/techniqueFigureData";

describe("patching pairs (predict vs actual)", () => {
  it("uses the four requested component labels in order", () => {
    expect(PATCH_PAIRS.map((p) => p.label)).toEqual(["L31·MLP", "L30·H15", "L24·H21", "L19·MLP"]);
  });

  it("has predict stronger than actual in every pair", () => {
    for (const p of PATCH_PAIRS) {
      expect(p.predict).toBeGreaterThan(p.actual);
      expect(p.predict).toBeLessThanOrEqual(1);
      expect(p.actual).toBeGreaterThan(0);
    }
  });
});

import { faceRamp, shadeRamp } from "../app/components/sections/techniqueFigureData";
import { TECHNIQUES } from "../app/lib/techniques";

describe("faceRamp / shadeRamp (shared figure color ramps)", () => {
  it("anchors the top step exactly on the technique's shadow color", () => {
    for (const t of TECHNIQUES) {
      const ramp = faceRamp(t, 4);
      expect(ramp[ramp.length - 1].toLowerCase()).toBe(t.shadow.toLowerCase());
    }
  });

  it("keeps every step visibly distinct from the next (no duplicate steps)", () => {
    for (const t of TECHNIQUES) {
      const ramp = faceRamp(t, 4);
      const unique = new Set(ramp.map((c) => c.toLowerCase()));
      expect(unique.size).toBe(4);
    }
  });

  it("never returns the bare card-surface color for the palest step", () => {
    const SURFACE = "#ecebe4";
    for (const t of TECHNIQUES) {
      const ramp = faceRamp(t, 4);
      expect(ramp[0].toLowerCase()).not.toBe(SURFACE);
    }
  });

  it("pairs each face with a darker lip via bandShadow", () => {
    for (const t of TECHNIQUES) {
      const pairs = shadeRamp(t, 4);
      expect(pairs).toHaveLength(4);
      for (const { face, lip } of pairs) {
        const [fr, fg, fb] = [0, 2, 4].map((i) => parseInt(face.slice(1 + i, 3 + i), 16));
        const [lr, lg, lb] = [0, 2, 4].map((i) => parseInt(lip.slice(1 + i, 3 + i), 16));
        expect(lr + lg + lb).toBeLessThan(fr + fg + fb); // lip strictly darker than its face
      }
    }
  });
});

import { ATTN_GRID as ATTN_GRID_V2 } from "../app/components/sections/techniqueFigureData";

describe("attention grid has three real intensity steps, not two", () => {
  it("uses weak, medium, and strong at least once each", () => {
    const seen = new Set<string>();
    ATTN_GRID_V2.forEach((row) => row.forEach((s) => s && seen.add(s)));
    expect(seen).toEqual(new Set(["weak", "medium", "strong"]));
  });

  it("keeps comma→Hello and period→world as the only strong cells", () => {
    const strong: [number, number][] = [];
    ATTN_GRID_V2.forEach((row, r) => row.forEach((s, c) => s === "strong" && strong.push([r, c])));
    expect(strong).toEqual([[2, 1], [4, 3]]);
  });
});

import { dlaStrongestLabel, patchAlwaysOverestimates } from "../app/components/sections/techniqueFigureData";

describe("DLA/Patching derived callouts", () => {
  it("dlaStrongestLabel names the largest-magnitude bar", () => {
    expect(dlaStrongestLabel(DLA_BARS)).toBe("L31");
  });

  it("patchAlwaysOverestimates is true for the current data (predict > actual, every pair)", () => {
    expect(patchAlwaysOverestimates(PATCH_PAIRS)).toBe(true);
  });
});
