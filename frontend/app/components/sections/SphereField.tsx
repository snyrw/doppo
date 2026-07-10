"use client";

import { type CSSProperties } from "react";
import { cn } from "../../lib/cn";
import { useSectionEntrance } from "../deck/DeckContext";
import { FIELD_LEFT_CSS, FRAME_W_U, HF_UNIT, SPHERE_HAIRLINE_LEFT_U, u } from "../figure-geometry";
import { SPHERES } from "./spheres";

// Decorative background for WhatDoppoIs — the section's HeroFigure equivalent.
// Nine flat circles transcribed from Figma node 20:579 (see spheres.ts), plus
// the diagonal gutter hairline, all children of one full-frame stage in --hf-u
// units (see figure-geometry.ts): right-anchored on ultrawide, pinned left and
// clipped off the right below 16:9, never shrinking or shearing. Faces sit in
// front of their darker twins. Entrance fades the spheres in largest →
// smallest, gated by useSectionEntrance() so it replays on activation (matches
// the hero page).
export default function SphereField() {
  const entering = useSectionEntrance();
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-y-0"
        style={{ "--hf-u": HF_UNIT, left: FIELD_LEFT_CSS, width: u(FRAME_W_U) } as CSSProperties}
      >
        {SPHERES.map((s) => (
          <div
            key={s.node}
            className={cn("absolute rounded-full", entering && "animate-hero-row")}
            style={{
              right: u(s.rightU),
              top: u(s.topU),
              width: u(s.sizeU),
              height: u(s.sizeU),
              background: s.fill === "face" ? "var(--sphere-face)" : "var(--sphere-back)",
              animationDelay: `${s.delayMs}ms`,
            }}
          />
        ))}
        {/* Single diagonal hairline crossing the field (decorative; matches the
            mock's long diagonal). Negative rotation about the top-left origin sends
            it down-RIGHT, so the visible span lands near the large sphere's left
            edge as in the Figma. Fades in late, like Hero's caption rule. */}
        <div
          className={cn("absolute top-0 h-[160%] w-px bg-surface-border", entering && "animate-hero-row")}
          style={{ left: u(SPHERE_HAIRLINE_LEFT_U), transformOrigin: "top left", transform: "rotate(-20deg)", animationDelay: "1080ms" }}
        />
      </div>
    </div>
  );
}
