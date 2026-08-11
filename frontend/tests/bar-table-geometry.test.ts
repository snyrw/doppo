import { describe, it, expect } from "vitest";
import {
  CONTENT_W, ROW_H, BAR_H, TICK_H, TICK_W, COL_GAP, LABEL_GAP,
  LAYER_LABEL_W, LAYER_ZONE_W, TOP_LABEL_W, TOP_ZONE_W, VALUE_W,
  ATTR_ZONE_W, ACTIVATION_ZONE_W, ACTIVATION_VALUE_W,
  HEAD_LABEL_W, HEAD_GAP, HEAD_CELL_BASE, HEAD_CELL_MIN, HEAD_CELL_MAX, BORDER_W,
  barRect, headCellSize, headGridWidth, headViewWidth,
} from "../app/components/bar-table-geometry";
/* Imported, not restated. card-geometry.ts is pure for exactly this reason, and
   local copies here would go stale the moment the frame is retuned — while still
   passing, because the assertions would be checking the copies against each other. */
import { CARD_INSET, CARD_MAX_W, CARD_MIN_W } from "../app/components/card-geometry";

describe("content width", () => {
  // Two of the four row layouts split their remainder in half, so "even" is not
  // enough — the remainder itself has to be even. Everything downstream depends
  // on this one fact, and it is what pins CARD_MIN_W to a value that looks
  // arbitrary and is not.
  it("is divisible by 4, so every derived zone lands even", () => {
    expect(CONTENT_W % 4).toBe(0);
  });

  it("is the card less its border and both insets", () => {
    expect(CONTENT_W).toBe(CARD_MIN_W - BORDER_W - CARD_INSET * 2);
  });
});

describe("derived bar zones", () => {
  /* These are the real guard now that the zones are computed from CONTENT_W
     rather than authored. The tests that used to live here asserted that each
     layout *sums* to CONTENT_W — true by construction once the zones are derived
     from it, so they would have passed on any arithmetic at all. What can still
     break is parity, and a zone narrowing to uselessness. */

  it("are an even width, so the baseline tick lands on a whole pixel", () => {
    expect(LAYER_ZONE_W % 2).toBe(0);
    expect(TOP_ZONE_W % 2).toBe(0);
    expect(ATTR_ZONE_W % 2).toBe(0);
    expect(ACTIVATION_ZONE_W % 2).toBe(0);
    // The emb row spans both layer zones plus the gap between them.
    expect((LAYER_ZONE_W + COL_GAP + LAYER_ZONE_W) % 2).toBe(0);
  });

  it("stay wide enough to render a bar at all", () => {
    // Below this a zone is a rendering bug, not a tight layout: the tick alone
    // is 1px and a bar needs room either side of it. Catches a future narrowing
    // loudly instead of silently shipping a 12px zone.
    const FLOOR = 64;
    expect(LAYER_ZONE_W).toBeGreaterThanOrEqual(FLOOR);
    expect(TOP_ZONE_W).toBeGreaterThanOrEqual(FLOOR);
    expect(ATTR_ZONE_W).toBeGreaterThanOrEqual(FLOOR);
    expect(ACTIVATION_ZONE_W).toBeGreaterThanOrEqual(FLOOR);
  });

  it("never overflow the content width", () => {
    expect(
      LAYER_LABEL_W + LABEL_GAP + LAYER_ZONE_W + COL_GAP + LAYER_ZONE_W + COL_GAP + VALUE_W,
    ).toBeLessThanOrEqual(CONTENT_W);
    expect(TOP_LABEL_W + LABEL_GAP + TOP_ZONE_W + COL_GAP + VALUE_W)
      .toBeLessThanOrEqual(CONTENT_W);
    expect(LAYER_LABEL_W + LABEL_GAP + ATTR_ZONE_W + COL_GAP + VALUE_W)
      .toBeLessThanOrEqual(CONTENT_W);
    expect(
      TOP_LABEL_W + LABEL_GAP + ACTIVATION_ZONE_W + COL_GAP + ACTIVATION_ZONE_W
        + COL_GAP + ACTIVATION_VALUE_W,
    ).toBeLessThanOrEqual(CONTENT_W);
  });

  // "−100.0%" at 9px mono overflows the 38px column DLA's "+0.30" fits in.
  it("activation's value column is wider than the shared default", () => {
    expect(ACTIVATION_VALUE_W).toBeGreaterThan(VALUE_W);
  });
});

describe("row proportions", () => {
  it("bar and tick sit inside the row", () => {
    expect(BAR_H).toBeLessThan(TICK_H);
    expect(TICK_H).toBeLessThan(ROW_H);
  });
  it("tick keeps roughly the mock's 37/63 ratio", () => {
    expect(TICK_H / ROW_H).toBeCloseTo(37 / 63, 1);
  });
  // A 1px line centred on a half-pixel is antialiased into a 2px grey smear.
  it("bar and tick both centre on whole pixels in the row", () => {
    expect((ROW_H - TICK_H) / 2 % 1).toBe(0);
    expect((ROW_H - BAR_H) / 2 % 1).toBe(0);
  });
});

describe("barRect grows out of the baseline tick, never through it", () => {
  const ZONE = LAYER_ZONE_W;
  const HALF = ZONE / 2;
  const SPAN = HALF - TICK_W;   // max bar length, equal on both sides

  // The tick occupies [HALF, HALF + TICK_W). Bars must abut it, not overlap it.
  it("positive bars start at the tick's right edge", () => {
    expect(barRect(1, 1, ZONE)).toEqual({ left: HALF + TICK_W, width: SPAN });
    expect(barRect(0.5, 1, ZONE)).toEqual({ left: HALF + TICK_W, width: SPAN / 2 });
  });
  it("negative bars end at the tick's left edge", () => {
    expect(barRect(-1, 1, ZONE)).toEqual({ left: HALF - SPAN, width: SPAN });
    expect(barRect(-0.5, 1, ZONE)).toEqual({ left: HALF - SPAN / 2, width: SPAN / 2 });
  });
  it("equal magnitudes are symmetric about the tick's centre", () => {
    const pos = barRect(0.7, 1, ZONE);
    const neg = barRect(-0.7, 1, ZONE);
    const tickCentre = HALF + TICK_W / 2;
    expect(pos.left - tickCentre).toBeCloseTo(tickCentre - (neg.left + neg.width), 10);
    expect(pos.width).toBeCloseTo(neg.width, 10);
  });
  it("a full-scale bar stops at the zone edge", () => {
    const pos = barRect(1, 1, ZONE);
    expect(pos.left + pos.width).toBe(ZONE);
  });
  it("zero draws nothing", () => {
    expect(barRect(0, 1, ZONE).width).toBe(0);
  });
  it("clamps beyond absMax rather than overflowing the zone", () => {
    expect(barRect(3, 1, ZONE).width).toBe(SPAN);
    expect(barRect(-3, 1, ZONE)).toEqual({ left: HALF - SPAN, width: SPAN });
  });
  it("degenerate absMax draws nothing instead of dividing by zero", () => {
    expect(barRect(0, 0, ZONE).width).toBe(0);
    expect(barRect(5, 0, ZONE).width).toBe(0);
  });
});

describe("head grid fills its column, then falls back to scrolling", () => {
  const w = (n: number) => headViewWidth(n, CARD_INSET, CARD_MIN_W, CARD_MAX_W);
  const contentOf = (cardW: number) => cardW - BORDER_W - CARD_INSET * 2;
  const fit = (n: number) => {
    const content = contentOf(w(n));
    return { content, grid: headGridWidth(n, headCellSize(n, content)) };
  };

  it("card sizes to the head count between the bounds", () => {
    expect(w(12)).toBe(CARD_MIN_W);   // 46 + 168 + 66 + 68 = 348, clamps up
    expect(w(64)).toBe(CARD_MAX_W);   // 1388, clamps down
  });

  it("cells grow to fill the column rather than leaving a hole", () => {
    const { content, grid } = fit(12);
    // The old fixed 14px cell left ~50px unused; filling must beat that.
    expect(headCellSize(12, content)).toBeGreaterThan(HEAD_CELL_BASE);
    expect(grid).toBeGreaterThan(content - 12);
    expect(grid).toBeLessThanOrEqual(content);
  });

  it("the label gutter matches the tables, so cells start where bars start", () => {
    expect(HEAD_LABEL_W).toBe(LAYER_LABEL_W);
    expect(HEAD_GAP).toBe(COL_GAP);
  });

  it("cells shrink as heads multiply, down to the floor", () => {
    const sizes = [12, 20, 32].map(n => headCellSize(n, contentOf(w(n))));
    expect(sizes[0]).toBeGreaterThan(sizes[1]);
    expect(sizes[1]).toBeGreaterThan(sizes[2]);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(HEAD_CELL_MIN);
  });

  it("many heads: cells bottom out and the grid overflows into a scroll", () => {
    expect(headCellSize(64, contentOf(w(64)))).toBe(HEAD_CELL_MIN);
    const { content, grid } = fit(64);
    expect(grid).toBeGreaterThan(content);
  });

  it("never exceeds the column while cells are still above the floor", () => {
    for (const n of [12, 16, 20, 24, 32]) {
      const { content, grid } = fit(n);
      if (headCellSize(n, content) > HEAD_CELL_MIN) expect(grid).toBeLessThanOrEqual(content);
    }
  });

  it("a very narrow model caps rather than blowing cells up", () => {
    expect(headCellSize(2, contentOf(w(2)))).toBe(HEAD_CELL_MAX);
  });
});
