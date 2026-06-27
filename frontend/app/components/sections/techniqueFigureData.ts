// frontend/app/components/sections/techniqueFigureData.ts
//
// Data for the five technique modal figures (rendered by TechniqueFigures.tsx).
// Kept separate from the JSX so the invariants below are unit-testable, mirroring
// the spheres.ts / spheres.test.ts pattern. Figures are schematic illustrations on
// the shared toy prompt `<bos> Hello , world .` — never a logged model run.

// ── Depth ─────────────────────────────────────────────────────────────────────
// Each mark sits on a darker bottom "lip" ≈ 20% of its own height, expressed as a
// clamp() that tracks the mark's size clamp so the lip scales with the modal — the
// same raised read as the page's tactile technique bars (--depth: 20%).
export const CELL_LIP = "clamp(3px,0.36vw,6px)"; // heatmap cell  h: clamp(16,1.8vw,28)
export const ATTN_CELL_LIP = "clamp(5px,0.55vw,8px)"; // attention cell w: clamp(24,2.9vw,42)
export const BAR_LIP = "clamp(3px,0.4vw,6px)"; // DLA / patch bar h: clamp(15,1.8vw,30)

// ── Logit Lens ────────────────────────────────────────────────────────────────
// rows = layers (top→bottom, deepening), cols = positions; each cell is the
// predicted *next* token at that position/layer. Honors the real signature: dim
// (low-confidence, generic) until the deepest layer, where it resolves to the
// actual continuation. `level` 0 = palest/least confident … 3 = brightest. Tokens
// + levels are illustrative and tunable.
export interface LensCell {
  token: string;
  level: 0 | 1 | 2 | 3;
}
export const LENS_COLS = ["Hello", ",", "world", "."];
export const LENS_ROWS = [0, 4, 9, 13, 18, 22, 27, 31]; // layer labels (32-layer model)

const c = (token: string, level: 0 | 1 | 2 | 3): LensCell => ({ token, level });
export const LENS_GRID: LensCell[][] = [
  [c("the", 0), c("the", 0), c("the", 0), c("the", 0)], // L0
  [c("the", 0), c(",", 0), c("the", 0), c(".", 0)], //     L4
  [c(",", 0), c("a", 0), c("is", 0), c(".", 0)], //        L9
  [c(",", 1), c("the", 1), c("world", 1), c(".", 1)], //   L13
  [c(",", 1), c("the", 1), c("world", 1), c(".", 1)], //   L18
  [c(",", 1), c("world", 1), c(".", 1), c("the", 1)], //   L22
  [c(",", 2), c("world", 2), c(".", 2), c("<eos>", 2)], // L27
  [c(",", 3), c("world", 3), c(".", 3), c("<eos>", 3)], // L31 — resolves
];

// ── Attention ─────────────────────────────────────────────────────────────────
// Lower-triangular query(row)×key(col) grid over `<bos> Hello , world .`. Encodes
// the attested Gemma-2-9B-it behavior: comma attends to Hello, period attends to
// world (strong); light cells = attention-sink-to-<bos> / self. "" = upper
// triangle (not a real query→key cell). Illustrative, not a logged run.
export type AttnStrength = "" | "weak" | "strong";
export const ATTN_TOKENS = ["<bos>", "Hello", ",", "world", "."];
export const ATTN_GRID: AttnStrength[][] = [
  ["weak", "", "", "", ""], //                        <bos>
  ["weak", "weak", "", "", ""], //                    Hello
  ["weak", "strong", "weak", "", ""], //              ,      → Hello
  ["weak", "weak", "weak", "weak", ""], //            world
  ["weak", "weak", "weak", "strong", "weak"], //      .      → world
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
