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

export const ATTR_ZONE_W = CONTENT_W - LAYER_LABEL_W - LABEL_GAP - COL_GAP - VALUE_W;

export const ACTIVATION_ZONE_W =
  (CONTENT_W - TOP_LABEL_W - LABEL_GAP - COL_GAP - COL_GAP - ACTIVATION_VALUE_W) / 2;

export const HEAD_LABEL_W = LAYER_LABEL_W;
export const HEAD_GAP = COL_GAP;

/** Sizes the *card*; the rendered cell then fills whatever column that yields. */
export const HEAD_CELL_BASE = 14;
/** Below this the cells stop being hoverable targets; the grid scrolls instead. */
export const HEAD_CELL_MIN = 8;
/** Above this a narrow model's grid reads as a few big tiles, not a heatmap. */
export const HEAD_CELL_MAX = 24;

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

/** Rendered width of the head grid: label gutter, then cells with gaps between. */
export function headGridWidth(nHeads: number, cell: number): number {
  return HEAD_LABEL_W + LABEL_GAP + nHeads * cell + Math.max(0, nHeads - 1) * HEAD_GAP;
}

/**
 * Head-view card width, sized from the base cell so the card doesn't resize as
 * the fill calculation feeds back into itself.
 */
export function headViewWidth(nHeads: number, inset: number, minW: number, maxW: number): number {
  const raw = headGridWidth(nHeads, HEAD_CELL_BASE) + inset * 2 + BORDER_W;
  return Math.max(minW, Math.min(maxW, raw));
}
