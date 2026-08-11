import { describe, it, expect } from "vitest";
import {
  uPx, pxToU, stageLeftPx, fieldLeftPx, STAGE_W_U, FRAME_W_U,
} from "../app/components/figure-geometry";

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

describe("section field stages (full 1920 design frame)", () => {
  it("stage left edge is exactly 0 at 16:9 (pixel parity)", () => {
    expect(fieldLeftPx(1920, 1080)).toBeCloseTo(0, 6);
    expect(fieldLeftPx(2560, 1440)).toBeCloseTo(0, 6);
  });
  it("right-anchors on ultrawide, pins at 0 below 16:9 (clips, never shrinks)", () => {
    expect(fieldLeftPx(3440, 1440)).toBeCloseTo(3440 - FRAME_W_U * 14.4, 6); // 880
    expect(fieldLeftPx(1024, 768)).toBe(0);
    expect(FRAME_W_U * uPx(768)).toBeGreaterThan(1024); // genuinely overflows
  });
  it("pxToU round-trips design px at 1080p (3-decimal rounding)", () => {
    expect(pxToU(845.64) * 10.8).toBeCloseTo(845.64, 1);
  });
});
