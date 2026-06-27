"use client";

import { cn } from "../../lib/cn";
import { useSectionEntrance } from "../deck/DeckContext";
import { LEFT_CLIP, TRIANGLES } from "./triangles";

// Decorative background for LearnMore — the section's figure, mirroring SphereField.
// 17 flat left-pointing triangles transcribed from the Figma node 20:603 render (see
// triangles.ts), each a light face over a darker down-right shadow twin, tiled in five
// clusters that frame the centered card. Positions are cqi against the 1920px design
// frame, so the field pins to the frame and bleeds off the edges exactly as drawn
// (clipped here by overflow-hidden). Entrance fades the triangles in left → right, gated
// by useSectionEntrance() so it replays on activation (matches the hero page).
export default function TriangleField() {
  const entering = useSectionEntrance();
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {TRIANGLES.map((t) => (
        <div
          key={t.key}
          className={cn("absolute", entering && "animate-hero-row")}
          style={{
            left: `${t.leftCqi}cqi`,
            top: `${t.topCqi}cqi`,
            width: `${t.wCqi}cqi`,
            height: `${t.hCqi}cqi`,
            clipPath: LEFT_CLIP,
            background: t.fill === "face" ? "var(--sphere-face)" : "var(--sphere-back)",
            animationDelay: `${t.delayMs}ms`,
          }}
        />
      ))}
    </div>
  );
}
