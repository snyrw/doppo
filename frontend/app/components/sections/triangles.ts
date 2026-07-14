// Pure geometry for the LearnMore background triangle field, transcribed from Figma node
// 20:603. 20 flat LEFT-POINTING triangles (each a light face + a darker shadow twin offset
// down-right) tile across the 1920px frame in a band that sweeps up-right: a left-side run,
// a dense center-right run that sits BEHIND the right-hand card (only its slivers poke past
// the card edges), and a right run whose last triangle bleeds off the frame. Positions are
// expressed in vw against the 1920px design width so the field pins to the frame, bleeds off
// the edges as drawn (clipped by TriangleField's overflow-hidden), and scales with viewport
// width. The triangle analog of the WhatDoppoIs sphere field (see spheres.ts). `fill`
// resolves to theme-flipping CSS vars at render time.
//
// Lengths are emitted in --hf-u units (see figure-geometry.ts) against the
// 1920×1080 design frame, so the field scales rigidly with its stage and never
// shrinks with width.
//
// COORDS DERIVED FROM THE NODE METADATA (not Figma's per-node code export, which drops the
// polygons' 90° rotation and exports up-pointing SVGs at 2× the size — wrong). Each visible
// triangle is a `regular-polygon` face node plus a shadow twin offset (+18, +33); its
// rendered AABB is a left-pointing equilateral 196 × 226 design px (base 226 vertical on the
// right, apex pointing left; 196/226 = √3/2), with AABB origin at (node.x − 85, node.y + 69)
// relative to the Figma node origin (verified to ~1px). The `x`/`y` below are that AABB
// origin for each FACE (= face_node.x − 85, face_node.y + 69); the `node` id is the face
// node, kept only for provenance.

import { pxToU } from "../figure-geometry";

// Left-pointing equilateral triangle filling its bounding box: apex at left-middle,
// vertical base on the right.
export const LEFT_CLIP = "polygon(0 50%, 100% 0, 100% 100%)";

const TRI_W = 196; // rendered triangle width (altitude), design px
const TRI_H = 226; // rendered triangle height (base), design px — 196/226 = √3/2

const SHADOW_DX = 18; // shadow twin offset, design px (down-right) — exact from node pairs
const SHADOW_DY = 33;

// Whole-field nudge, design px. The measured coords sit slightly down-left of where the card
// lands in our responsive (vw-centred) layout, so the band is pushed right (and a touch up)
// to tuck behind the card as in the mock. LearnMore's diagonal gutter line carries a similar,
// independently-tuned rightward shift (~4.7vw).
const FIELD_NUDGE_X = 100; // → right
const FIELD_NUDGE_Y = -25; // → up

interface TriangleSource {
  node: string; // Figma face node id (provenance only)
  x: number; //   rendered triangle bounding-box left (apex x), design px in the 1920 frame
  y: number; //   rendered triangle bounding-box top, design px
}

// Ordered left → right (drives the entrance cascade). The center-right run (x ≈ 1237–1464)
// sits behind the card; only the slivers poking past its edges show. The last one (x ≈ 1921)
// bleeds off the right edge.
const SOURCE: readonly TriangleSource[] = [
  // left band
  { node: "142:45", x: 550.9, y: 671 },
  { node: "142:36", x: 774.9, y: 827 },
  { node: "124:356", x: 775.4, y: 245.5 },
  { node: "124:358", x: 775.9, y: 558 },
  // center
  { node: "124:345", x: 998.9, y: 415 },
  { node: "124:357", x: 1001.9, y: 125 },
  { node: "142:19", x: 1002.9, y: 692 },
  // behind the card
  { node: "124:367", x: 1236.9, y: 15.5 },
  { node: "124:376", x: 1236.9, y: 552.5 },
  { node: "124:365", x: 1237.4, y: 281 },
  { node: "124:374", x: 1237.4, y: 818 },
  { node: "124:361", x: 1459.4, y: -98 },
  { node: "124:370", x: 1459.4, y: 439 },
  { node: "124:366", x: 1463.9, y: 160.5 },
  { node: "124:375", x: 1463.9, y: 697.5 },
  // right of the card (last bleeds off-frame)
  { node: "142:41", x: 1693.9, y: 55 },
  { node: "124:383", x: 1693.9, y: 321 },
  { node: "124:381", x: 1694.4, y: 586.5 },
  { node: "142:53", x: 1694.9, y: 848 },
  { node: "124:382", x: 1920.9, y: 466 },
];

// Entrance fade — mirrors SphereField (fade in, stepped) so the field cascades
// left → right and settles (last starts ~1060ms) just before the card lands (~1200ms).
// 40ms × 19 steps keeps the settle point matched to the card delay even at 20 triangles.
const TRIANGLE_BASE_DELAY_MS = 300;
const TRIANGLE_STAGGER_MS = 40;

type TriangleFill = "face" | "shadow";

export interface TrianglePart {
  key: string;
  leftU: number;
  topU: number;
  wU: number;
  hU: number;
  fill: TriangleFill;
  delayMs: number;
}

function part(t: TriangleSource, i: number, fill: TriangleFill): TrianglePart {
  const shadow = fill === "shadow";
  return {
    key: `${t.node}-${fill}`,
    leftU: pxToU(t.x + (shadow ? SHADOW_DX : 0) + FIELD_NUDGE_X),
    topU: pxToU(t.y + (shadow ? SHADOW_DY : 0) + FIELD_NUDGE_Y),
    wU: pxToU(TRI_W),
    hU: pxToU(TRI_H),
    fill,
    delayMs: TRIANGLE_BASE_DELAY_MS + i * TRIANGLE_STAGGER_MS,
  };
}

// Paint order: ALL shadow twins first (behind), then ALL faces on top — so a face is
// never covered by a neighbouring triangle's shadow; each shadow only shows as the
// down-right sliver peeking out from under its face (the tactile depth cue).
export const TRIANGLES: readonly TrianglePart[] = [
  ...SOURCE.map((t, i) => part(t, i, "shadow")),
  ...SOURCE.map((t, i) => part(t, i, "face")),
];
