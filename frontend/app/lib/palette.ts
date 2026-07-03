export type SequentialPaletteName = "mono" | "viridis" | "inferno";
export type DivergingPaletteName = "rdbu" | "puor";
export type PaletteName = SequentialPaletteName | DivergingPaletteName;

type RGB = [number, number, number];

export const PALETTE_META: Record<PaletteName, { label: string; description: string; swatchCss: string }> = {
  mono: {
    label: "Mono",
    description: "Theme-aware grayscale fade",
    swatchCss: "linear-gradient(to right, transparent, rgba(var(--heatmap-rgb), 1))",
  },
  rdbu: {
    label: "RdBu",
    description: "Diverging blue–gray–red (ColorBrewer)",
    swatchCss: "linear-gradient(to right, #053061, #4393c3, #d1e5f0, #f7f7f7, #fddbc7, #f4a582, #67001f)",
  },
  puor: {
    label: "PuOr",
    description: "Diverging orange–gray–purple (ColorBrewer, colorblind-safe)",
    swatchCss: "linear-gradient(to right, #7f3b08, #b35806, #e08214, #fdb863, #fee0b6, #f7f7f7, #d8daeb, #b2abd2, #8073ac, #542788, #2d004b)",
  },
  viridis: {
    label: "Viridis",
    description: "Perceptually uniform, colorblind-safe",
    swatchCss: "linear-gradient(to right, #440154, #31688e, #21918c, #5ec962, #fde725)",
  },
  inferno: {
    label: "Inferno",
    description: "High contrast dark-to-bright",
    swatchCss: "linear-gradient(to right, #000004, #57106e, #bc3754, #f98009, #fcffa4)",
  },
};

export const SEQUENTIAL_PALETTE_ORDER: SequentialPaletteName[] = ["mono", "viridis", "inferno"];
export const DIVERGING_PALETTE_ORDER: DivergingPaletteName[] = ["rdbu", "puor"];

const GRADIENT_STOPS: Record<Exclude<PaletteName, "mono">, RGB[]> = {
  // ColorBrewer RdBu 11-class, reversed so blue=0, red=1
  rdbu: [
    [5, 48, 97],
    [33, 102, 172],
    [67, 147, 195],
    [146, 197, 222],
    [209, 229, 240],
    [247, 247, 247],
    [253, 219, 199],
    [244, 165, 130],
    [214, 96, 77],
    [178, 24, 43],
    [103, 0, 31],
  ],
  // ColorBrewer PuOr 11-class, reversed so orange=0 (negative), purple=1 (positive).
  puor: [
    [127, 59, 8],
    [179, 88, 6],
    [224, 130, 20],
    [253, 184, 99],
    [254, 224, 182],
    [247, 247, 247],
    [216, 218, 235],
    [178, 171, 210],
    [128, 115, 172],
    [84, 39, 136],
    [45, 0, 75],
  ],
  viridis: [
    [68, 1, 84],
    [59, 82, 139],
    [33, 145, 140],
    [94, 201, 98],
    [253, 231, 37],
  ],
  inferno: [
    [0, 0, 4],
    [87, 16, 110],
    [188, 55, 84],
    [249, 142, 9],
    [252, 255, 164],
  ],
};

function lerpStops(stops: RGB[], t: number): RGB {
  const n = stops.length - 1;
  const scaled = Math.max(0, Math.min(1, t)) * n;
  const lo = Math.floor(scaled);
  const hi = Math.min(n, lo + 1);
  const f = scaled - lo;
  const [r1, g1, b1] = stops[lo];
  const [r2, g2, b2] = stops[hi];
  return [
    Math.round(r1 + (r2 - r1) * f),
    Math.round(g1 + (g2 - g1) * f),
    Math.round(b1 + (b2 - b1) * f),
  ];
}

export function interpolateColor(palette: PaletteName, prob: number): string {
  if (palette === "mono") {
    return `rgba(var(--heatmap-rgb), ${prob})`;
  }
  const [r, g, b] = lerpStops(GRADIENT_STOPS[palette], prob);
  return `rgb(${r},${g},${b})`;
}

// For signed DLA values: maps value ∈ [-absMax, +absMax] to [0,1] anchored at 0.5 (neutral).
// Negative → blue end of rdbu / orange end of puor. Positive → red end of rdbu / purple end of puor.
export function interpolateColorDivergent(palette: PaletteName, value: number, absMax: number): string {
  const t = absMax === 0 ? 0.5 : Math.max(0, Math.min(1, (value + absMax) / (2 * absMax)));
  return interpolateColor(palette, t);
}

export function getContrastColor(palette: PaletteName, prob: number): string {
  if (palette === "mono") {
    return prob > 0.55 ? "var(--bg)" : "var(--text)";
  }
  const [r, g, b] = lerpStops(GRADIENT_STOPS[palette], prob);
  const lum = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
  return lum > 0.35 ? "#1c1c1c" : "#ecebe4";
}

export function getHeadColor(headIdx: number, nHeads: number, weight: number): string {
  const hue = (headIdx * 360) / Math.max(nHeads, 1);
  const saturation = weight * 80;
  const lightness = 95 - weight * 70;
  return `hsl(${hue.toFixed(1)}, ${saturation.toFixed(1)}%, ${lightness.toFixed(1)}%)`;
}
