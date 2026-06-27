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
