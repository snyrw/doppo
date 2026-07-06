"use client";

import { type CSSProperties } from "react";
import { cn } from "../../lib/cn";
import { useSectionEntrance } from "../deck/DeckContext";
import { FIELD_LEFT_CSS, FRAME_W_U, HF_UNIT, LM_HAIRLINE_LEFT_U, u } from "../figure-geometry";
import { LEFT_CLIP, TRIANGLES } from "./triangles";

// Decorative background for LearnMore — the section's figure, mirroring SphereField.
// 17 flat left-pointing triangles transcribed from the Figma node 20:603 render (see
// triangles.ts), each a light face over a darker down-right shadow twin, tiled in five
// clusters that frame the card, plus the diagonal gutter hairline. All children of one
// full-frame stage in --hf-u units (see figure-geometry.ts): right-anchored on
// ultrawide, pinned left and clipped off the right below 16:9, never shrinking or
// shearing (clipped here by overflow-hidden). Entrance fades the triangles in
// left → right, gated by useSectionEntrance() so it replays on activation (matches
// the hero page).
export default function TriangleField() {
  const entering = useSectionEntrance();
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-y-0"
        style={{ "--hf-u": HF_UNIT, left: FIELD_LEFT_CSS, width: u(FRAME_W_U) } as CSSProperties}
      >
        {TRIANGLES.map((t) => (
          <div
            key={t.key}
            className={cn("absolute", entering && "animate-hero-row")}
            style={{
              left: u(t.leftU),
              top: u(t.topU),
              width: u(t.wU),
              height: u(t.hU),
              clipPath: LEFT_CLIP,
              background: t.fill === "face" ? "var(--sphere-face)" : "var(--sphere-back)",
              animationDelay: `${t.delayMs}ms`,
            }}
          />
        ))}
        {/* Diagonal gutter hairline. Positive rotation about the top-left origin
            sends the bottom down-LEFT, matching the mock's lean (top ≈44+6% →
            bottom-left). Same shade as every other hairline; fades in late, like
            Hero's caption rule. */}
        <div
          className={cn("absolute top-0 h-[150%] w-px bg-surface-border", entering && "animate-hero-row")}
          style={{ left: u(LM_HAIRLINE_LEFT_U), transformOrigin: "top left", transform: "rotate(23deg)", animationDelay: "1080ms" }}
        />
      </div>
    </div>
  );
}
