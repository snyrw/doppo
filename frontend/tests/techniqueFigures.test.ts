// frontend/tests/techniqueFigures.test.ts
import { describe, it, expect } from "vitest";
import { CELL_LIP, ATTN_CELL_LIP, BAR_LIP } from "../app/components/sections/techniqueFigureData";

describe("figure depth lips (~20% of mark height)", () => {
  it("scales each lip with a clamp() that tracks the mark's size", () => {
    expect(CELL_LIP).toBe("clamp(3px,0.36vw,6px)");
    expect(ATTN_CELL_LIP).toBe("clamp(5px,0.55vw,8px)");
    expect(BAR_LIP).toBe("clamp(3px,0.4vw,6px)");
  });
});
