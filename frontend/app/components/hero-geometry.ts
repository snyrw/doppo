// Deck-mode hero figure geometry. Every length is a multiple of one unit
// `--hf-u` = 1svh, so the figure scales with viewport height only and NEVER
// shrinks with width. At 16:9 (10.8px at 1920×1080) these constants reproduce
// the legacy vw-based Figma transcription pixel-for-pixel. The stage's left
// edge is max(35%, 100% − stage width): above 16:9 the right-anchored arm
// wins (figure holds constant size, extra width becomes gutter); below 16:9
// landscape the 35% pin wins — the figure stays put at the hairline and the
// surplus clips off the viewport's right edge. Because the lattice, hairline,
// and caption all share this unit, they form one rigid group that cannot
// shear apart at any aspect ratio.
//
// Pure module (no React) so tests/hero-geometry.test.ts can lock the numbers.

export const HF_UNIT = "1svh";

/** px value of 1u at viewport height h — JS mirror of HF_UNIT, for tests. */
export const uPx = (h: number) => h / 100;

/** CSS length of `n` units (the stage defines --hf-u). */
export const u = (n: number) => `calc(${n} * var(--hf-u))`;

// vw → u conversion is ×16/9 (Nvw = N×(16/9)svh at 16:9).
const VW = 16 / 9;

// Tile lattice (legacy: 275/168/46px in the 1920 frame = 14.3/8.75/2.4vw).
export const CELL_W_U = 14.3 * VW;
export const CELL_H_U = 8.75 * VW;
export const GAP_U = 2.4 * VW;

// Darker backing-tile offset (legacy shadow `2.2vw 2.6vw`).
export const SHADOW_X_U = 2.2 * VW;
export const SHADOW_Y_U = 2.6 * VW;

// The stage spans the legacy 65vw figure region (old wrapper at left-[35%]).
// Children are positioned from the stage's top-left corner.
export const STAGE_W_U = 65 * VW;

// Stage left edge: right-anchored until that would push it left of the legacy
// 35% line, then pinned there (surplus width clips off the right).
export const STAGE_MIN_LEFT_PCT = 35;
export const STAGE_LEFT_CSS = `max(${STAGE_MIN_LEFT_PCT}%, calc(100% - ${u(STAGE_W_U)}))`;

/** px value of the stage's left edge at a given viewport — for tests. */
export const stageLeftPx = (w: number, h: number) =>
  Math.max((STAGE_MIN_LEFT_PCT / 100) * w, w - STAGE_W_U * uPx(h));

// Lattice anchor (legacy: left 7% × top 20% of the 65vw wrapper). The vertical
// figure region at 1080p is 998px tall (1080 − 50 navbar − 32 footer); tops
// were %-of-that-height and convert via ×998/10.8 to units.
const MAIN_H_1080 = 1080 - 50 - 32;
const PX_PER_U_1080 = 10.8;
export const LATTICE_LEFT_U = 0.07 * 65 * VW;
export const LATTICE_TOP_U = (0.2 * MAIN_H_1080) / PX_PER_U_1080;

// Hairline (legacy left-[33%] of viewport = 2vw left of the stage edge) and
// caption (legacy left-[37%] top-[40%]).
export const HAIRLINE_LEFT_U = -2 * VW;
export const CAPTION_LEFT_U = 2 * VW;
export const CAPTION_TOP_U = (0.4 * MAIN_H_1080) / PX_PER_U_1080;
