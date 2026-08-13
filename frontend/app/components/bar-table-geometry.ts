/* Bar-table and head-grid geometry for DLA/patching and attention cards.

   Pure by design — no React import — so vitest can load it directly. That
   matters more than usual here: the tutorial runs GPT-2 small, 12 layers by 12
   heads, so neither the head-view width clamp nor the gap floor is ever reached
   in a browser. The arithmetic below is only exercised in a test. */

import { BORDER_W, CARD_INSET, CARD_MIN_W } from "./card-geometry";

export { BORDER_W };

export const CONTENT_W = CARD_MIN_W - BORDER_W - CARD_INSET * 2;

export const ROW_H = 24;
export const BAR_H = 8;

export const TICK_H = 14;
export const TICK_W = 1;

export const HEADER_ROW_H = 28;

export const LABEL_GAP = 4;
export const COL_GAP = 6;

export const LAYER_LABEL_W = 42;

export const TOP_LABEL_W = 56;

export const VALUE_W = 38;

export const ACTIVATION_VALUE_W = 48;

export const LAYER_ZONE_W =
  (CONTENT_W - LAYER_LABEL_W - LABEL_GAP - COL_GAP - COL_GAP - VALUE_W) / 2;

export const TOP_ZONE_W = CONTENT_W - TOP_LABEL_W - LABEL_GAP - COL_GAP - VALUE_W;

export const ACTIVATION_ZONE_W =
  (CONTENT_W - TOP_LABEL_W - LABEL_GAP - COL_GAP - COL_GAP - ACTIVATION_VALUE_W) / 2;

/** Head-grid row labels are always short "L0".."L999" unlike the bar
 *  tables' "emb"/"ln_bias" rows, so this is its own, tighter width rather
 *  than reusing LAYER_LABEL_W: fits four characters at the 9px mono label
 *  size with room to spare, so the grid sits close against the labels. */
export const HEAD_LABEL_W = 28;
export const HEAD_GAP = COL_GAP;
/** Gap keeps shrinking past HEAD_GAP as heads multiply, but never fully closes —
 *  below this, adjacent swatches read as one smear rather than a grid. */
export const HEAD_GAP_FLOOR = 2;

/** Sizes the *card*; the rendered cell then fills whatever column that yields. */
export const HEAD_CELL_BASE = 14;
/** The cell size headCellSize() targets before the gap starts giving up room.
 *  Past this, headLayout() shrinks the gap first, then the cell itself. */
export const HEAD_CELL_MIN = 8;
/** Above this a narrow model's grid reads as a few big tiles, not a heatmap. */
export const HEAD_CELL_MAX = 24;

export const HEAD_CELL_FLOOR = 2;

export const HEAD_LABEL_HIDE_BELOW = 6;

export const HEAD_VIEW_MAX_W = 720;

/**
 * Where one bar sits inside its zone, in px from the zone's left edge.
 */
export function signed(v: number, dp = 2): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(dp)}`;
}

export function barRect(val: number, absMax: number, zoneW: number): { left: number; width: number } {
  const half = zoneW / 2;
  const span = half - TICK_W;
  if (absMax <= 0) return { left: half + TICK_W, width: 0 };
  const width = Math.min(1, Math.abs(val) / absMax) * span;
  return val >= 0
    ? { left: half + TICK_W, width }
    : { left: half - width, width };
}

/**
 * Square cell size that fills the column.
 */
export function headCellSize(nHeads: number, contentW: number): number {
  if (nHeads <= 0) return HEAD_CELL_MIN;
  const avail = contentW - HEAD_LABEL_W - LABEL_GAP - (nHeads - 1) * HEAD_GAP;
  return Math.max(HEAD_CELL_MIN, Math.min(HEAD_CELL_MAX, Math.floor(avail / nHeads)));
}

/**
 * Column header text for a given cell size: the full "H{n}" when there's
 * room, the bare number once the cell can't fit the "H" too, and nothing
 * once even the bare number wouldn't be legible (see HEAD_LABEL_HIDE_BELOW).
 */
export function headLabelText(label: string, cell: number): string {
  if (cell >= HEAD_CELL_BASE) return label;
  if (cell < HEAD_LABEL_HIDE_BELOW) return "";
  return label.replace(/^H/, "");
}

/** Rendered width of the head grid: label gutter, then cells with gaps between. */
export function headGridWidth(nHeads: number, cell: number, gap: number = HEAD_GAP): number {
  return HEAD_LABEL_W + LABEL_GAP + nHeads * cell + Math.max(0, nHeads - 1) * gap;
}

/**
 * Head-view card width, sized from the base cell so the card doesn't resize as
 * the fill calculation feeds back into itself.
 */
export function headViewWidth(nHeads: number, inset: number, minW: number, maxW: number): number {
  const raw = headGridWidth(nHeads, HEAD_CELL_BASE) + inset * 2 + BORDER_W;
  return Math.max(minW, Math.min(maxW, raw));
}

export function headLayout(nHeads: number, contentW: number): { cell: number; gap: number } {
  if (nHeads <= 0) return { cell: HEAD_CELL_MIN, gap: HEAD_GAP };

  const fixed = HEAD_LABEL_W + LABEL_GAP;
  const gaps = Math.max(0, nHeads - 1);
  const cell = headCellSize(nHeads, contentW);

  if (gaps === 0) return { cell, gap: HEAD_GAP };

  const roomyWidth = fixed + nHeads * cell + gaps * HEAD_GAP;
  if (roomyWidth <= contentW) {
    // Fits at the nominal gap: pack left, leave any slack empty at the right.
    return { cell, gap: HEAD_GAP };
  }

  // Tight: headCellSize already clamped to HEAD_CELL_MIN. Shrink the gap
  // toward its floor before shrinking the cell below HEAD_CELL_MIN.
  const tightWidth = fixed + nHeads * HEAD_CELL_MIN + gaps * HEAD_GAP_FLOOR;
  if (tightWidth <= contentW) {
    const gap = Math.max(HEAD_GAP_FLOOR, Math.floor((contentW - fixed - nHeads * HEAD_CELL_MIN) / gaps));
    return { cell: HEAD_CELL_MIN, gap };
  }

  // Very tight: even HEAD_CELL_MIN cells at the gap floor overflow. Shrink
  // the cell itself rather than let the grid scroll.
  const avail = contentW - fixed - gaps * HEAD_GAP_FLOOR;
  const tightCell = Math.max(HEAD_CELL_FLOOR, Math.floor(avail / nHeads));
  return { cell: tightCell, gap: HEAD_GAP_FLOOR };
}
