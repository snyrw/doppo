// frontend/app/components/sections/techniqueFigureData.ts
//
// Data for the five technique modal figures (rendered by TechniqueFigures.tsx).
// Kept separate from the JSX so the invariants below are unit-testable, mirroring
// the spheres.ts / spheres.test.ts pattern. Attention, DLA, Patching, and Steering
// are schematic illustrations on the shared toy prompt `<bos> Hello , world .`,
// never a logged model run. Logit Lens is the exception: real GPT-2 Small data,
// see its section below.

import type { Technique } from "../../lib/techniques";
import { TECHNIQUES, bandShadow } from "../../lib/techniques";

// ── Shared face/lip color ramps ──────────────────────────────────────────────
// Every figure's colors derive from the technique's own face/shadow instead
// of a one-off hex pair, so the five figures share one contrast system and
// low-confidence cells stay visible against the card. The richest step in
// each ramp is that technique's shadow color, already used by its landing bar.
type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
}
function rgbToHex([r, g, b]: RGB): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}
function lerpRgb(a: RGB, b: RGB, t: number): RGB {
  return [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t) as RGB;
}

// --card, light theme (frozen here rather than read from CSS: these ramps are
// hex literals by design, same rule as `lib/techniques.ts`'s face/shadow).
const SURFACE_RGB: RGB = [236, 235, 228];
const RAMP_MIN_T = 0.05; // palest step still this far from pure background
const RAMP_MID_T = 0.90; // fraction of the ramp spent in surface→face before face→shadow

/** `steps` face colors from pale-but-legible to the technique's `shadow`. */
export function faceRamp(technique: Technique, steps: number): string[] {
  const face = hexToRgb(technique.face);
  const shadow = hexToRgb(technique.shadow);
  return Array.from({ length: steps }, (_, i) => {
    const raw = steps === 1 ? 1 : i / (steps - 1);
    const t = RAMP_MIN_T + (1 - RAMP_MIN_T) * raw;
    return t <= RAMP_MID_T
      ? rgbToHex(lerpRgb(SURFACE_RGB, face, t / RAMP_MID_T))
      : rgbToHex(lerpRgb(face, shadow, (t - RAMP_MID_T) / (1 - RAMP_MID_T)));
  });
}

/** Paired face/lip ramp. Lip reuses bandShadow's existing darken of each face. */
export function shadeRamp(technique: Technique, steps: number): { face: string; lip: string }[] {
  return faceRamp(technique, steps).map((face) => ({ face, lip: bandShadow(face) }));
}

// ── Depth ─────────────────────────────────────────────────────────────────────
// Each mark sits on a darker bottom "lip" ≈ 20% of its own height, expressed as a
// clamp() that tracks the mark's size clamp so the lip scales with the modal — the
// same raised read as the page's tactile technique bars (--depth: 20%).
export const CELL_LIP = "clamp(3px,0.36vw,6px)"; // heatmap cell  h: clamp(16,1.8vw,28)
export const ATTN_CELL_LIP = "clamp(5px,0.55vw,8px)"; // attention cell w: clamp(24,2.9vw,42)
export const BAR_LIP = "clamp(3px,0.4vw,6px)"; // DLA / patch bar h: clamp(15,1.8vw,30)

// ── Logit Lens ────────────────────────────────────────────────────────────────
// Real top-1 token and probability from a local run of GPT-2 Small through the
// actual transformer_lens.model_bridge.TransformerBridge (transformer-lens
// 3.5.0, same pin as backend/config.py) on `<bos> Hello , world .`, the same
// toy prompt the other four figures use schematically. Mirrors
// backend/inference.py's run_logit_lens exactly: cache.accumulated_resid(
// layer=-1, incl_mid=False) → model.ln_final → model.unembed at each of the 8
// sampled layers. (An earlier pass reproduced this by hand against plain HF
// `transformers` instead of TransformerBridge — that version silently
// double-applied the final layer norm on the last row, since HF's
// `output_hidden_states` already runs `ln_f` into its last hidden-state entry;
// TransformerBridge's raw `resid_post` doesn't have that trap.)
// Columns are the prompt's 4 non-bos tokens; rows are 8 of GPT-2 Small's 12
// layers. Level buckets the real top-1 probability: <0.35, <0.55, <0.85, >=0.85.
export interface LensCell {
  token: string;
  level: 0 | 1 | 2 | 3;
}
export const LENS_COLS = ["Hello", ",", "world", "."];
export const LENS_ROWS = [0, 2, 4, 6, 8, 9, 10, 11]; // real GPT-2 Small layer indices (12-layer model)

const c = (token: string, level: 0 | 1 | 2 | 3): LensCell => ({ token, level });
export const LENS_GRID: LensCell[][] = [
  [c("Hello", 1), c("which", 0), c("world", 0), c("↵", 0)], //    L0
  [c("!", 0), c("please", 0), c("wide", 0), c("↵", 0)], //        L2
  [c("!", 1), c("thank", 3), c("wide", 0), c("We", 0)], //        L4
  [c("!", 1), c("dear", 0), c("wide", 1), c("You", 2)], //        L6
  [c("!", 1), c("dear", 2), c("!", 3), c("You", 2)], //           L8
  [c("folks", 0), c("dear", 1), c("!", 3), c("You", 0)], //       L9
  [c("everyone", 1), c("everyone", 0), c("!", 3), c("I", 1)], //  L10
  [c(",", 0), c("I", 0), c("!", 1), c("↵", 0)], //                L11 — never confidently resolves on this short prompt
];

// ── Attention ─────────────────────────────────────────────────────────────────
// Lower-triangular query(row)×key(col) grid over `<bos> Hello , world .`. Comma
// attends to Hello and period attends to world (strong); diagonal self-attention
// is its own weaker "medium" step, separate from attention-sink-to-<bos> ("weak").
// "" = upper triangle, not a real query→key cell. Illustrative, not a logged run.
export type AttnStrength = "" | "weak" | "medium" | "strong";
export const ATTN_TOKENS = ["<bos>", "Hello", ",", "world", "."];
export const ATTN_GRID: AttnStrength[][] = [
  ["weak", "", "", "", ""], //                        <bos>
  ["weak", "weak", "", "", ""], //                    Hello
  ["weak", "strong", "weak", "", ""], //               ,      → Hello
  ["weak", "weak", "weak", "weak", ""], //             world
  ["weak", "weak", "weak", "strong", "weak"], //       .      → world
];

// ── Direct Logit Attribution ──────────────────────────────────────────────────
// One divergent bar per layer at 8× stride. `signed` ∈ [-1,1]: sign = side
// (neg = left, pos = right), magnitude = bar length. Meanders early, strongest at
// the bottom (deepest layer contributes most directly to the logits). Illustrative.
export interface DlaBar {
  label: string;
  signed: number;
}
export const DLA_BARS: DlaBar[] = [
  { label: "L0", signed: 0.18 },
  { label: "L8", signed: 0.25 },
  { label: "L16", signed: -0.3 },
  { label: "L24", signed: 0.22 },
  { label: "L31", signed: 0.95 },
];

/** Label of the bar with the largest magnitude. Drives the figure's
 *  "deepest layer dominates" callout so it can't drift from DLA_BARS. */
export function dlaStrongestLabel(bars: DlaBar[]): string {
  return bars.reduce((max, b) => (Math.abs(b.signed) > Math.abs(max.signed) ? b : max)).label;
}

// ── Activation Patching ───────────────────────────────────────────────────────
// One row per component: predict bar (what attribution estimates) over actual bar
// (what patching it in really does). Predict > actual in every pair — attribution
// tends to over-estimate the patched effect. Component labels are illustrative.
export interface PatchPair {
  label: string;
  predict: number; // bar length 0..1
  actual: number; // bar length 0..1, < predict
}
export const PATCH_PAIRS: PatchPair[] = [
  { label: "L31·MLP", predict: 0.92, actual: 0.3 },
  { label: "L30·H15", predict: 0.66, actual: 0.42 },
  { label: "L24·H21", predict: 0.5, actual: 0.2 },
  { label: "L19·MLP", predict: 0.4, actual: 0.28 },
];

/** True when predict exceeds actual in every pair. Gates the figure's
 *  "predict always overshoots actual" callout so it can't claim something
 *  the data no longer shows. */
export function patchAlwaysOverestimates(pairs: PatchPair[]): boolean {
  return pairs.every((p) => p.predict > p.actual);
}

// ── Attention color band ──────────────────────────────────────────────────────
// Unlike the other three figures' shadeRamp (surface → face → shadow), attention's
// darkest step stops at `face` — the same yellow as the landing page's own
// "attention head analysis" technique bar — instead of continuing into the
// muddier `shadow`. The two lighter steps sit at uneven points in the
// surface→face band (not an even split) so the grid reads as scattered
// weight rather than a precise gradient.
function attnStep(t: number): { face: string; lip: string } {
  const face = rgbToHex(lerpRgb(SURFACE_RGB, hexToRgb(TECHNIQUES[1].face), t));
  return { face, lip: bandShadow(face) };
}
export const ATTN_LEVELS: { face: string; lip: string }[] = [
  attnStep(0.22), // weak
  attnStep(0.58), // medium
  { face: TECHNIQUES[1].face, lip: bandShadow(TECHNIQUES[1].face) }, // strong
];

// ── Shared generated ramps (see faceRamp/shadeRamp above) ────────────────────
export const LENS_LEVELS = shadeRamp(TECHNIQUES[0], 4);
export const DLA_LEVELS = shadeRamp(TECHNIQUES[2], 4);
export const PATCH_LEVELS = shadeRamp(TECHNIQUES[3], 4);
