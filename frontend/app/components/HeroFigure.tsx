import { cn } from "../lib/cn";
import { useSectionEntrance } from "./deck/DeckContext";
import {
  CELL_W_U, CELL_H_U, GAP_U, SHADOW_X_U, SHADOW_Y_U,
  LATTICE_LEFT_U, LATTICE_TOP_U, u,
} from "./figure-geometry";

// Decorative logit-lens lattice — an exact transcription of the Figma hero figure
// (node 8:389). A grid of tiles, rotated and bled off the panel edges, where each
// tile is a light "face" with a darker same-hue twin peeking out behind it
// (down-right). The layout is an irregular, heatmap-like arrangement of four
// viridis levels, not a gradient. Colors are theme-flipped CSS vars defined in
// globals.css (--hero-l{0..3}-{face,back}): light = the verbatim Figma pastels;
// dark = a deeper viridis band so the tiles recede against ink instead of glowing.
//
// All lengths come from figure-geometry.ts in --hf-u units, defined by the stage
// wrapper in Hero.tsx that positions this lattice alongside its hairline and
// caption — the whole group scales rigidly with the unit.

// Four viridis levels: { face = top tile, back = darker twin behind it }.
const LEVELS = [
  { face: "var(--hero-l0-face)", back: "var(--hero-l0-back)" }, // mauve
  { face: "var(--hero-l1-face)", back: "var(--hero-l1-back)" }, // periwinkle
  { face: "var(--hero-l2-face)", back: "var(--hero-l2-back)" }, // teal
  { face: "var(--hero-l3-face)", back: "var(--hero-l3-back)" }, // green
] as const;

// Exact tile→level layout from the Figma. Rows run down-right, columns up-right
// (the grid is rotated -18°). Left column is a clean ramp; the rest is deliberately
// noisy, evoking a real logit-lens heatmap.
const MATRIX = [
  [0, 0, 0, 0],
  [1, 1, 0, 0],
  [2, 0, 0, 1],
  [3, 2, 0, 3],
];

// Row-by-row entrance: the first row lands after the headline words have settled
// (see Hero.tsx choreography), then each subsequent row follows. All tiles in a
// row share one delay, so the row paints as a unit. Applied per-tile via
// animation-delay (the grid is flat, not wrapped per row).
const ROW_BASE_DELAY = 540; // ms
const ROW_STAGGER = 130; // ms per row

export default function HeroFigure() {
  const entering = useSectionEntrance();
  return (
    // Anchored to the stage's top-left, not centered: with transform-origin
    // top-left + the -18° rotation both grid axes run rightward from the origin,
    // so no tile ever sits left of it. The field's left boundary is therefore the
    // rotated column edge (parallel to the hairline). It bleeds off the top,
    // right, and bottom — clipped by the section root, exactly as the Figma
    // field does.
    <div
      className="absolute grid"
      style={{
        left: u(LATTICE_LEFT_U),
        top: u(LATTICE_TOP_U),
        transformOrigin: "top left",
        transform: "rotate(-18deg)",
        gridTemplateColumns: `repeat(${MATRIX[0].length}, ${u(CELL_W_U)})`,
        gridAutoRows: u(CELL_H_U),
        gap: u(GAP_U),
      }}
    >
      {MATRIX.flatMap((row, r) =>
        row.map((level, c) => (
          <div
            key={`${r}-${c}`}
            className={cn(entering && "animate-hero-row")}
            style={{
              background: LEVELS[level].face,
              boxShadow: `${u(SHADOW_X_U)} ${u(SHADOW_Y_U)} 0 0 ${LEVELS[level].back}`,
              animationDelay: `${ROW_BASE_DELAY + r * ROW_STAGGER}ms`,
            }}
          />
        )),
      )}
    </div>
  );
}
