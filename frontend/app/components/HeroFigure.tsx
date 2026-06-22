import { fadedColor } from "../lib/palette";

// Decorative logit-lens lattice: a viridis gradient swept across a grid that is
// rotated and bled off the panel edges. All geometry/color is computed, so it
// lives in inline style; the fade is theme-aware via color-mix(... var(--bg)).
const ROWS = 7;
const COLS = 8;
const CELL_W = 200; // px
const CELL_H = 124; // px (≈ CELL_W / 1.61, matching the Figma cell ratio)
const GAP = 26; // px
const FADE = 0.45; // muted toward bg, tuned to the Figma tone
const T_MIN = 0.18; // viridis sample floor (deep-ish purple)
const T_MAX = 0.68; // viridis sample ceiling (green, short of yellow)
const SHADOW = "-26px -16px 0 0 var(--surface-border)"; // up-left backing block

export default function HeroFigure() {
  const cells = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const d = (r + c) / (ROWS - 1 + COLS - 1); // diagonal sweep 0..1
      const t = T_MIN + d * (T_MAX - T_MIN);
      cells.push(
        <div
          key={`${r}-${c}`}
          style={{ background: fadedColor("viridis", t, FADE), boxShadow: SHADOW }}
        />,
      );
    }
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden animate-fade-in"
    >
      <div
        className="absolute left-1/2 top-1/2 grid"
        style={{
          transform: "translate(-50%, -50%) rotate(-18deg)",
          gridTemplateColumns: `repeat(${COLS}, ${CELL_W}px)`,
          gridAutoRows: `${CELL_H}px`,
          gap: `${GAP}px`,
        }}
      >
        {cells}
      </div>
    </div>
  );
}
