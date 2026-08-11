import { describe, it, expect } from "vitest";
import {
  PANEL_W, PANEL_GAP, VIEWPORT_MARGIN, panelPosition,
} from "../app/components/card-info-geometry";

const VIEWPORT = { width: 1440, height: 900 };
// An 18px button 300px from the left, 200px down.
const BUTTON = { left: 300, top: 200, bottom: 218 };

describe("panelPosition", () => {
  it("aligns the panel's left edge to the button's left edge", () => {
    expect(panelPosition(BUTTON, VIEWPORT, 300).left).toBe(300);
  });

  it("opens below the button, separated by the gap", () => {
    expect(panelPosition(BUTTON, VIEWPORT, 300).top).toBe(218 + PANEL_GAP);
  });

  it("clamps to the right viewport edge rather than overflowing", () => {
    const nearRight = { left: 1400, top: 200, bottom: 218 };
    expect(panelPosition(nearRight, VIEWPORT, 300).left)
      .toBe(VIEWPORT.width - PANEL_W - VIEWPORT_MARGIN);
  });

  it("clamps to the left viewport edge", () => {
    const offLeft = { left: -40, top: 200, bottom: 218 };
    expect(panelPosition(offLeft, VIEWPORT, 300).left).toBe(VIEWPORT_MARGIN);
  });

  it("flips above the button when opening below would overflow the bottom", () => {
    const nearBottom = { left: 300, top: 800, bottom: 818 };
    expect(panelPosition(nearBottom, VIEWPORT, 300).top).toBe(800 - PANEL_GAP - 300);
  });

  it("stays below when it fits below, even close to the bottom", () => {
    const fits = { left: 300, top: 500, bottom: 518 };
    // 518 + 4 + 300 = 822, and 900 - 8 = 892. Fits.
    expect(panelPosition(fits, VIEWPORT, 300).top).toBe(522);
  });

  it("clamps to the top margin when the panel fits in neither direction", () => {
    const tall = { left: 300, top: 100, bottom: 118 };
    expect(panelPosition(tall, VIEWPORT, 1000).top).toBe(VIEWPORT_MARGIN);
  });

  it("never places the panel off the left edge, even in the flipped case", () => {
    const corner = { left: -100, top: 850, bottom: 868 };
    const pos = panelPosition(corner, VIEWPORT, 400);
    expect(pos.left).toBeGreaterThanOrEqual(VIEWPORT_MARGIN);
    expect(pos.top).toBeGreaterThanOrEqual(VIEWPORT_MARGIN);
  });
});
