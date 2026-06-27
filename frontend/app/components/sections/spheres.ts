// Pure geometry for the WhatDoppoIs background sphere field. Figma node 20:579
// places 9 flat-fill circles in a 1920px-wide frame: four face/twin pairs (light
// face + darker twin offset down-right) plus one large solo sphere. We anchor the
// field to the section's top-right and express every circle in cqi (container
// inline units, against the 1920px design frame), so the cluster pins to the
// right edge — bleeding off right and bottom exactly as drawn — and scales with
// the container width. `fill` resolves to theme-flipping CSS vars at render time
// (see SphereField).

export const DESIGN_W = 1920;

/** Design px (in the 1920px frame) → cqi (container inline units, against the 1920px design frame), rounded to 3 decimals. */
export function pxToCqi(px: number): number {
  return Math.round((px / DESIGN_W) * 100_000) / 1000;
}

export type SphereFill = "face" | "twin";

interface SphereSource {
  node: string; // Figma node id (provenance)
  left: number; // top-left x, design px
  top: number;  // top-left y, design px
  size: number; // diameter, design px
  fill: SphereFill;
  group: number; // 1 = largest … 5 = smallest; drives fade order
}

// Twin listed before its face within a pair → twin paints behind (later siblings
// paint on top). Ordered group 1 → 5.
const SOURCE: readonly SphereSource[] = [
  { node: "80:4",  left: 879,  top: 760, size: 800, fill: "face", group: 1 }, // solo, largest
  { node: "80:24", left: 1684, top: 542, size: 394, fill: "twin", group: 2 },
  { node: "80:5",  left: 1645, top: 503, size: 394, fill: "face", group: 2 },
  { node: "80:26", left: 1536, top: 137, size: 250, fill: "twin", group: 3 },
  { node: "80:7",  left: 1520, top: 113, size: 250, fill: "face", group: 3 },
  { node: "80:28", left: 1155, top: 103, size: 150, fill: "twin", group: 4 },
  { node: "80:9",  left: 1147, top: 88,  size: 150, fill: "face", group: 4 },
  { node: "80:30", left: 848,  top: 262, size: 75,  fill: "twin", group: 5 },
  { node: "80:11", left: 841,  top: 253, size: 75,  fill: "face", group: 5 }, // smallest
] as const;

// Entrance fade — mirrors HeroFigure (ROW_BASE_DELAY 540ms + 130ms/step), stepped
// by size group so spheres appear largest → smallest.
export const SPHERE_BASE_DELAY_MS = 540;
export const SPHERE_GROUP_STAGGER_MS = 130;

export interface Sphere {
  node: string;
  rightCqi: number; // offset from the field's right edge, in cqi (container inline units, against the 1920px design frame)
  topCqi: number;
  sizeCqi: number;
  fill: SphereFill;
  delayMs: number;
}

// Note: rightCqi is negative for faces whose right edge bleeds past the 1920px frame (left+size > 1920); valid CSS, clipped by SphereField's overflow-hidden.
export const SPHERES: readonly Sphere[] = SOURCE.map((s) => ({
  node: s.node,
  rightCqi: pxToCqi(DESIGN_W - (s.left + s.size)),
  topCqi: pxToCqi(s.top),
  sizeCqi: pxToCqi(s.size),
  fill: s.fill,
  delayMs: SPHERE_BASE_DELAY_MS + (s.group - 1) * SPHERE_GROUP_STAGGER_MS,
}));
