// Decorative logit-lens lattice — an exact transcription of the Figma hero figure
// (node 8:389). A grid of tiles, rotated and bled off the panel edges, where each
// tile is a light "face" with a darker same-hue twin peeking out behind it
// (down-right). The layout is an irregular, heatmap-like arrangement of four
// viridis levels, not a gradient. Colors are theme-flipped CSS vars defined in
// globals.css (--hero-l{0..3}-{face,back}): light = the verbatim Figma pastels;
// dark = a deeper viridis band so the tiles recede against ink instead of glowing.

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

// Sizes are in vw so the figure keeps the Figma proportions (tile = 275px in a
// 1920px frame) at any width — fixed px overpower a panel far narrower than the
// 1920 design frame.
const CELL_W = 14.3; // vw (275 / 1920)
const CELL_H = 8.75; // vw (168 / 1920)
const GAP = 2.4; // vw (46 / 1920)

// Darker backing tile, offset down-right by ≈(56,34)px-in-1920 in *screen* space,
// expressed in the grid's pre-rotation space (= screen offset rotated +18°) and in
// vw so it scales with the tiles.
const SHADOW = `2.2vw 2.6vw 0 0`;

// Row-by-row entrance: the first row lands after the headline words have settled
// (see Hero.tsx choreography), then each subsequent row follows. All tiles in a
// row share one delay, so the row paints as a unit. Applied per-tile via
// animation-delay (the grid is flat, not wrapped per row).
const ROW_BASE_DELAY = 540; // ms
const ROW_STAGGER = 130; // ms per row

export default function HeroFigure() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Anchored to the panel's top-left, not centered: with transform-origin
          top-left + the -18° rotation both grid axes run rightward from the origin,
          so no tile ever sits left of it. The field's left boundary is therefore the
          rotated column edge (parallel to the hairline), and nothing spills left to
          be clipped into the hard vertical edge the centered version produced. It
          bleeds off the top, right, and bottom — exactly as the Figma field does. */}
      <div
        className="absolute grid"
        style={{
          left: "7%",
          top: "20%",
          transformOrigin: "top left",
          transform: "rotate(-18deg)",
          gridTemplateColumns: `repeat(${MATRIX[0].length}, ${CELL_W}vw)`,
          gridAutoRows: `${CELL_H}vw`,
          gap: `${GAP}vw`,
        }}
      >
        {MATRIX.flatMap((row, r) =>
          row.map((level, c) => (
            <div
              key={`${r}-${c}`}
              className="animate-hero-row"
              style={{
                background: LEVELS[level].face,
                boxShadow: `${SHADOW} ${LEVELS[level].back}`,
                animationDelay: `${ROW_BASE_DELAY + r * ROW_STAGGER}ms`,
              }}
            />
          )),
        )}
      </div>
    </div>
  );
}
