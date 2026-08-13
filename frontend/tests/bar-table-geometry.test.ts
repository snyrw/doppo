import { describe, it, expect } from "vitest";
import {
  CONTENT_W, ROW_H, BAR_H, TICK_H, TICK_W, COL_GAP, LABEL_GAP,
  LAYER_LABEL_W, LAYER_ZONE_W, TOP_LABEL_W, TOP_ZONE_W, VALUE_W,
  ACTIVATION_ZONE_W, ACTIVATION_VALUE_W,
  HEAD_LABEL_W, HEAD_GAP, HEAD_GAP_FLOOR, HEAD_CELL_BASE, HEAD_CELL_MIN, HEAD_CELL_FLOOR,
  HEAD_CELL_MAX, HEAD_VIEW_MAX_W, HEAD_LABEL_HIDE_BELOW, BORDER_W,
  barRect, headCellSize, headGridWidth, headViewWidth, headLayout, headLabelText,
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
    expect(ACTIVATION_ZONE_W).toBeGreaterThanOrEqual(FLOOR);
  });

  it("never overflow the content width", () => {
    expect(
      LAYER_LABEL_W + LABEL_GAP + LAYER_ZONE_W + COL_GAP + LAYER_ZONE_W + COL_GAP + VALUE_W,
    ).toBeLessThanOrEqual(CONTENT_W);
    expect(TOP_LABEL_W + LABEL_GAP + TOP_ZONE_W + COL_GAP + VALUE_W)
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

describe("head grid packs left, never scrolls", () => {
  const w = (n: number) => headViewWidth(n, CARD_INSET, CARD_MIN_W, HEAD_VIEW_MAX_W);
  const contentOf = (cardW: number) => cardW - BORDER_W - CARD_INSET * 2;
  const fit = (n: number) => {
    const content = contentOf(w(n));
    const { cell, gap } = headLayout(n, content);
    return { content, cell, gap, grid: headGridWidth(n, cell, gap) };
  };

  it("card sizes to the head count between the bounds", () => {
    expect(w(12)).toBe(CARD_MIN_W);       // clamps up
    expect(w(200)).toBe(HEAD_VIEW_MAX_W); // clamps down
  });

  it("has more headroom than the shared card cap, so more heads stay legible", () => {
    expect(HEAD_VIEW_MAX_W).toBeGreaterThan(CARD_MAX_W);
  });

  it("cells grow to fill the column rather than leaving a hole", () => {
    const { content, grid } = fit(12);
    // The old fixed 14px cell left ~50px unused; filling must beat that.
    expect(headCellSize(12, content)).toBeGreaterThan(HEAD_CELL_BASE);
    expect(grid).toBeGreaterThan(content - 12);
    expect(grid).toBeLessThanOrEqual(content);
  });

  it("the label gutter is its own, tighter width — head labels are always short", () => {
    // Deliberately narrower than the bar tables' LAYER_LABEL_W: "L0".."L999"
    // never needs the room "emb"/"ln_bias" does, so the grid sits close to
    // the labels instead of leaving a wide gap before the first cell.
    expect(HEAD_LABEL_W).toBeLessThan(LAYER_LABEL_W);
    expect(HEAD_GAP).toBe(COL_GAP);
  });

  it("when cells have room to spare, the grid packs left instead of centering or stretching", () => {
    // Few heads at a wide-ish content width: cell caps at HEAD_CELL_MAX, the
    // gap stays nominal, and whatever's left just sits empty at the right —
    // no outer centering margin, no gap-stretching to fill the column.
    const content = 320;
    const { cell, gap } = headLayout(3, content);
    expect(cell).toBe(HEAD_CELL_MAX);
    expect(gap).toBe(HEAD_GAP);
    expect(headGridWidth(3, cell, gap)).toBeLessThan(content);
  });

  it("cells shrink as heads multiply, down to the old floor, then further", () => {
    const sizes = [12, 20, 32, 64, 128].map(n => fit(n).cell);
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeLessThanOrEqual(sizes[i - 1]);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(HEAD_CELL_FLOOR);
  });

  it("many heads: the gap shrinks toward its floor before the cell drops below HEAD_CELL_MIN", () => {
    // Comfortably past HEAD_VIEW_MAX_W's natural fit: cell sits right at
    // HEAD_CELL_MIN while the gap has already given up most of its room.
    const { cell, gap } = fit(48);
    expect(cell).toBe(HEAD_CELL_MIN);
    expect(gap).toBeLessThan(HEAD_GAP);

    // Past that, the cell itself has to shrink below HEAD_CELL_MIN, with the
    // gap already pinned at its own floor.
    const { cell: cellTighter, gap: gapTighter } = fit(72);
    expect(cellTighter).toBeLessThan(HEAD_CELL_MIN);
    expect(gapTighter).toBe(HEAD_GAP_FLOOR);
  });

  it("never scrolls: the grid fits the column at any realistic head count", () => {
    for (const n of [1, 2, 12, 16, 20, 24, 32, 40, 64, 96, 128]) {
      const { content, grid } = fit(n);
      expect(grid).toBeLessThanOrEqual(content);
    }
  });

  it("extreme head counts still produce a positive, non-degenerate cell", () => {
    const { cell, gap } = fit(128);
    expect(cell).toBeGreaterThanOrEqual(HEAD_CELL_FLOOR);
    expect(gap).toBeGreaterThanOrEqual(HEAD_GAP_FLOOR);
  });

  it("a very narrow model caps rather than blowing cells up", () => {
    expect(headCellSize(2, contentOf(w(2)))).toBe(HEAD_CELL_MAX);
  });

  it("a single head has no gap to distribute, so it just left-aligns", () => {
    const { cell, gap } = headLayout(1, 320);
    expect(cell).toBe(HEAD_CELL_MAX);
    expect(gap).toBe(HEAD_GAP);
  });
});

describe("headLabelText degrades instead of truncating mid-glyph", () => {
  it("shows the full label when the cell is comfortably at or above HEAD_CELL_BASE", () => {
    expect(headLabelText("H10", HEAD_CELL_BASE)).toBe("H10");
    expect(headLabelText("H10", HEAD_CELL_MAX)).toBe("H10");
  });

  it("drops the H prefix once the cell is smaller than HEAD_CELL_BASE", () => {
    expect(headLabelText("H10", HEAD_CELL_BASE - 1)).toBe("10");
    expect(headLabelText("H5", HEAD_CELL_MIN)).toBe("5");
  });

  it("drops the label entirely below HEAD_LABEL_HIDE_BELOW", () => {
    expect(headLabelText("H10", HEAD_LABEL_HIDE_BELOW - 1)).toBe("");
    expect(headLabelText("H5", HEAD_CELL_FLOOR)).toBe("");
  });

  it("the bare number at HEAD_LABEL_HIDE_BELOW is the boundary, still shown", () => {
    expect(headLabelText("H10", HEAD_LABEL_HIDE_BELOW)).toBe("10");
  });
});
