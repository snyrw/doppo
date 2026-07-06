import { describe, it, expect } from "vitest";
import {
  uPx, stageLeftPx, CELL_W_U, CELL_H_U, GAP_U, SHADOW_X_U, SHADOW_Y_U,
  STAGE_W_U, LATTICE_LEFT_U, LATTICE_TOP_U,
  HAIRLINE_LEFT_U, CAPTION_LEFT_U, CAPTION_TOP_U,
} from "../app/components/hero-geometry";

// 1u at 1080p viewport height.
const U = uPx(1080);

// Legacy vw constants (pre-refactor HeroFigure/Hero values); 1vw = 19.2px at 1920.
const vwPx = (n: number) => n * 19.2;

describe("uPx (JS mirror of --hf-u = 1svh)", () => {
  it("scales with height only — the figure never shrinks with width", () => {
    expect(uPx(1080)).toBeCloseTo(10.8, 10);
    expect(uPx(720)).toBeCloseTo(7.2, 10);
    expect(uPx(1440)).toBe(14.4);
  });
});

describe("stage left edge: right-anchored with a 35% pin", () => {
  it("equals the legacy 35% exactly at 16:9", () => {
    expect(stageLeftPx(1920, 1080)).toBeCloseTo(0.35 * 1920, 6);
  });
  it("right-anchors on ultrawide (extra width becomes gutter)", () => {
    expect(stageLeftPx(3440, 1440)).toBeCloseTo(3440 - STAGE_W_U * 14.4, 6);
    expect(stageLeftPx(3440, 1440)).toBeGreaterThan(0.35 * 3440);
  });
  it("pins at 35% below 16:9 (figure clips off the right, never shrinks)", () => {
    expect(stageLeftPx(1024, 768)).toBeCloseTo(0.35 * 1024, 6);
    // the stage genuinely overflows the viewport there
    expect(0.35 * 1024 + STAGE_W_U * uPx(768)).toBeGreaterThan(1024);
  });
});

describe("pixel parity with legacy vw sizing at 1920×1080", () => {
  it.each([
    ["CELL_W", CELL_W_U, 14.3],
    ["CELL_H", CELL_H_U, 8.75],
    ["GAP", GAP_U, 2.4],
    ["SHADOW_X", SHADOW_X_U, 2.2],
    ["SHADOW_Y", SHADOW_Y_U, 2.6],
    ["STAGE_W", STAGE_W_U, 65],
  ])("%s matches", (_name, uConst, legacyVw) => {
    expect(uConst * U).toBeCloseTo(vwPx(legacyVw), 6);
  });
});

describe("stage-relative positions reproduce the legacy layout at 1920×1080", () => {
  const STAGE_LEFT = stageLeftPx(1920, 1080); // = old left-[35%] = 672px
  it("lattice anchor = old 35% + 7%-of-wrapper = 759.36px", () => {
    expect(STAGE_LEFT + LATTICE_LEFT_U * U).toBeCloseTo(759.36, 6);
  });
  it("hairline = old left-[33%] = 633.6px", () => {
    expect(STAGE_LEFT + HAIRLINE_LEFT_U * U).toBeCloseTo(633.6, 6);
  });
  it("caption = old left-[37%] = 710.4px", () => {
    expect(STAGE_LEFT + CAPTION_LEFT_U * U).toBeCloseTo(710.4, 6);
  });
  it("vertical anchors match old %-of-main (998px main at 1080p)", () => {
    expect(LATTICE_TOP_U * U).toBeCloseTo(0.2 * 998, 6); // 199.6
    expect(CAPTION_TOP_U * U).toBeCloseTo(0.4 * 998, 6); // 399.2
  });
});
