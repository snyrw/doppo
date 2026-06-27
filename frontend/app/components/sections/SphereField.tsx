"use client";

import { cn } from "../../lib/cn";
import { useSectionEntrance } from "../deck/DeckContext";
import { SPHERES } from "./spheres";

// Decorative background for WhatDoppoIs — the section's HeroFigure equivalent.
// Nine flat circles transcribed from Figma node 20:579 (see spheres.ts), anchored
// to the field's top-right so the cluster bleeds off the right/bottom exactly as
// drawn. Faces sit in front of their darker twins. A single diagonal hairline
// crosses the field. Entrance fades the spheres in largest → smallest, gated by
// useSectionEntrance() so it replays on activation (matches the hero page).
export default function SphereField() {
  const entering = useSectionEntrance();
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {SPHERES.map((s) => (
        <div
          key={s.node}
          className={cn("absolute rounded-full", entering && "animate-hero-row")}
          style={{
            right: `${s.rightCqi}cqi`,
            top: `${s.topCqi}cqi`,
            width: `${s.sizeCqi}cqi`,
            height: `${s.sizeCqi}cqi`,
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
        className={cn("absolute left-[30%] top-0 h-[160%] w-px bg-surface-border", entering && "animate-hero-row")}
        style={{ transformOrigin: "top left", transform: "rotate(-20deg)", animationDelay: "1080ms" }}
      />
    </div>
  );
}
