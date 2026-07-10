// Deck-mode figure geometry for every landing section. Every length is a
// multiple of one unit `--hf-u` = 1svh, so figures scale with viewport height
// only and NEVER shrink with width. At 16:9 (10.8px at 1920×1080) these
// constants reproduce the legacy vw-based Figma transcriptions
// pixel-for-pixel. Each section wraps its figure elements (lattice/field,
// hairline, caption, card) in one "stage" whose left edge is
// max(pin, 100% − stage width): above 16:9 the right-anchored arm wins (the
// composition holds constant size, extra width becomes gutter); below 16:9
// landscape the pin wins — the composition stays put and the surplus clips
// off the viewport's right edge. Because all children share this unit, each
// stage is a rigid group that cannot shear apart at any aspect ratio.
//
// Pure module (no React) so tests/figure-geometry.test.ts can lock the numbers.

export const HF_UNIT = "1svh";

// 1u in design px: the Figma frames are 1920×1080, where 1svh = 10.8px.
export const PX_PER_U = 10.8;

/** Design px (in the 1920×1080 frame) → u, rounded to 3 decimals. */
export const pxToU = (px: number) => Math.round((px / PX_PER_U) * 1000) / 1000;

/** px value of 1u at viewport height h — JS mirror of HF_UNIT, for tests. */
export const uPx = (h: number) => h / 100;

/** CSS length of `n` units (the stage defines --hf-u). */
export const u = (n: number) => `calc(${n} * var(--hf-u))`;

// vw → u conversion is ×16/9 (Nvw = N×(16/9)svh at 16:9).
const VW = 16 / 9;

/* ── Hero ─────────────────────────────────────────────────────────────── */

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

/** px value of the hero stage's left edge at a given viewport — for tests. */
export const stageLeftPx = (w: number, h: number) =>
  Math.max((STAGE_MIN_LEFT_PCT / 100) * w, w - STAGE_W_U * uPx(h));

// Lattice anchor (legacy: left 7% × top 20% of the 65vw wrapper). The vertical
// figure region at 1080p is 998px tall (1080 − 50 navbar − 32 footer); tops
// were %-of-that-height and convert via ×998/10.8 to units.
const MAIN_H_1080 = 1080 - 50 - 32;
export const LATTICE_LEFT_U = 0.07 * 65 * VW;
export const LATTICE_TOP_U = (0.2 * MAIN_H_1080) / PX_PER_U;

// Hairline (legacy left-[33%] of viewport = 2vw left of the stage edge) and
// caption (legacy left-[37%] top-[40%]).
export const HAIRLINE_LEFT_U = -2 * VW;
export const CAPTION_LEFT_U = 2 * VW;
export const CAPTION_TOP_U = (0.4 * MAIN_H_1080) / PX_PER_U;

/* ── Section field stages (WhatDoppoIs / Techniques / LearnMore) ─────────
   These figures were composed against the full 1920px frame, so their stage
   spans the whole frame width and pins at the section's left edge (0px). */

export const FRAME_W_U = 1920 / PX_PER_U; // 177.78u
export const FIELD_LEFT_CSS = `max(0px, calc(100% - ${u(FRAME_W_U)}))`;

/** px value of a field stage's left edge at a given viewport — for tests. */
export const fieldLeftPx = (w: number, h: number) =>
  Math.max(0, w - FRAME_W_U * uPx(h));

// Diagonal gutter hairlines (legacy: WhatDoppoIs left-[30%]; Techniques
// left-[calc(41%+100px)]; LearnMore left-[calc(44%+6vw)] — % of the frame).
export const SPHERE_HAIRLINE_LEFT_U = pxToU(0.3 * 1920);
export const TECH_HAIRLINE_LEFT_U = pxToU(0.41 * 1920 + 100);
export const LM_HAIRLINE_LEFT_U = pxToU((0.44 + 0.06) * 1920);

// Technique stack (legacy: left-[calc(41.7vw+45px)], w-[55vw], v-centered).
export const TECH_STACK_LEFT_U = pxToU(0.417 * 1920 + 45);
export const TECH_STACK_W_U = pxToU(0.55 * 1920);
// Blank-card stack nudge behind the bars (legacy -translate-x-[75px]).
export const TECH_CARD_NUDGE_U = pxToU(75);
// Bar label font (legacy clamp(13px,1.7vw,32px) — 1.7vw caps at 32px right at
// ~1882px width, so 32px-at-1080p ≙ 2.963u keeps 16:9 parity while scaling
// with the stage instead of splaying against a px cap).
export const BAR_FONT_CSS = `max(13px, calc(${pxToU(32)} * var(--hf-u)))`;

// Info cards (WhatDoppoIs / LearnMore): legacy w-[clamp(320px,32vw,620px)]
// centered in the right grid column (center x = 1440) with a -60px nudge →
// left edge 1440 − 60 − 614.4/2 = 1072.8px, vertically centered. Stage-
// positioning them keeps the fields' behind-the-card tuck rigid (the old
// 620px cap already sheared against the vw-scaled fields on tall viewports).
export const CARD_W_U = 32 * VW;
export const CARD_LEFT_U = pxToU(1440 - 60 - (0.32 * 1920) / 2);
