// frontend/tests/techniqueFigures.test.ts
import { describe, it, expect } from "vitest";
import { CELL_LIP, ATTN_CELL_LIP, BAR_LIP } from "../app/components/sections/techniqueFigureData";
import { LENS_COLS, LENS_ROWS, LENS_GRID } from "../app/components/sections/techniqueFigureData";

describe("figure depth lips (~20% of mark height)", () => {
  it("scales each lip with a clamp() that tracks the mark's size", () => {
    expect(CELL_LIP).toBe("clamp(3px,0.36vw,6px)");
    expect(ATTN_CELL_LIP).toBe("clamp(5px,0.55vw,8px)");
    expect(BAR_LIP).toBe("clamp(3px,0.4vw,6px)");
  });
});

describe("logit lens grid (dim until the last layer)", () => {
  it("has one row per layer label and one column per position token", () => {
    expect(LENS_COLS).toEqual(["Hello", ",", "world", "."]);
    expect(LENS_ROWS).toHaveLength(8);
    expect(LENS_GRID).toHaveLength(LENS_ROWS.length);
    for (const row of LENS_GRID) expect(row).toHaveLength(LENS_COLS.length);
  });

  it("lights up only at the deepest layer — final row is strictly brightest", () => {
    const maxLevel = (row: { level: number }[]) => Math.max(...row.map((c) => c.level));
    const last = LENS_GRID.length - 1;
    const finalMax = maxLevel(LENS_GRID[last]);
    expect(finalMax).toBe(3);
    for (let r = 0; r < last; r++) expect(maxLevel(LENS_GRID[r])).toBeLessThan(finalMax);
    expect(maxLevel(LENS_GRID[0])).toBeLessThanOrEqual(1); // earliest layers are dim
  });

  it("resolves to the real continuation at the deepest layer", () => {
    expect(LENS_GRID[LENS_GRID.length - 1].map((c) => c.token)).toEqual([",", "world", ".", "<eos>"]);
  });
});
