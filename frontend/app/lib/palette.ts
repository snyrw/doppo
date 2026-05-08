export type PaletteName = "warm-mono" | "rdbu" | "viridis" | "inferno";

type RGB = [number, number, number];

export const PALETTE_META: Record<PaletteName, { label: string; description: string; swatchCss: string }> = {
  "warm-mono": {
    label: "Warm Mono",
    description: "Amber fade, theme-aware",
    swatchCss: "linear-gradient(to right, transparent, rgba(175, 118, 32, 0.5), rgb(175, 118, 32))",
  },
  rdbu: {
    label: "RdBu",
    description: "Diverging blue–gray–red (ColorBrewer)",
    swatchCss: "linear-gradient(to right, #053061, #4393c3, #d1e5f0, #f7f7f7, #fddbc7, #f4a582, #67001f)",
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

export const PALETTE_ORDER: PaletteName[] = ["warm-mono", "rdbu", "viridis", "inferno"];

const GRADIENT_STOPS: Record<Exclude<PaletteName, "warm-mono">, RGB[]> = {
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
  if (palette === "warm-mono") {
    return `rgba(175, 118, 32, ${prob})`;
  }
  const [r, g, b] = lerpStops(GRADIENT_STOPS[palette], prob);
  return `rgb(${r},${g},${b})`;
}

export function getContrastColor(palette: PaletteName, prob: number): string {
  if (palette === "warm-mono") {
    return prob > 0.55 ? "#ecebe4" : "#1c1c1c";
  }
  const [r, g, b] = lerpStops(GRADIENT_STOPS[palette], prob);
  const lum = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
  return lum > 0.35 ? "#1c1c1c" : "#ecebe4";
}
