"use client";

import { type CSSProperties } from "react";
import { cn } from "../../lib/cn";
import { useSectionEntrance } from "../deck/DeckContext";
import { BAR_FONT_CSS, TECH_CARD_NUDGE_U, u } from "../figure-geometry";
import { TECHNIQUES } from "../../lib/techniques";

// Decorative figure: a tilted card stack behind a column of technique bars.
// Sized with aspect-ratio and percentages, not px, so it scales cleanly at
// any viewport width.
const STAGE_ASPECT = "1142 / 872";
const CARD_W = "74%";
const CARD_CX = "60.2%";
const ROT = 13; // degrees, clockwise
const SHADOW_OFFSET = "translate(3.5%, 4.5%)"; // offsets the back card to read as its drop shadow

const CARD_DELAY = 200; // ms — stack settles just before the bars rise
const BAR_STAGGER = 90; // ms between bars (top → bottom)
// Shared press-depth for every bar. Must stay smaller than the gap between
// bars, or the sink animation overlaps the next one.
const BAR_DEPTH = "20%";

function BlankCard({ fill, shadow, entering }: { fill: string; shadow?: boolean; entering: boolean }) {
  return (
    <div
      className={cn("absolute top-1/2 h-full rounded-[12px]", entering && "animate-hero-row")}
      style={{
        left: CARD_CX,
        width: CARD_W,
        background: fill,
        // Outermost (global) shadow offset, then centre, then tilt.
        transform: `${shadow ? `${SHADOW_OFFSET} ` : ""}translate(-50%, -50%) rotate(${ROT}deg)`,
        animationDelay: `${CARD_DELAY}ms`,
      }}
    />
  );
}

export default function TechniqueStack({
  className,
  onSelect,
}: {
  className?: string;
  onSelect?: (index: number) => void;
}) {
  const entering = useSectionEntrance();

  return (
    <div className={cn("relative", className)} style={{ aspectRatio: STAGE_ASPECT }}>
      {/* Nudged left with the shared --hf-u unit so it scales with the stage. */}
      <div aria-hidden className="absolute inset-0 z-0" style={{ transform: `translateX(${u(-TECH_CARD_NUDGE_U)})` }}>
        <BlankCard fill="var(--sphere-back)" shadow entering={entering} />
        <BlankCard fill="var(--sphere-face)" entering={entering} />
      </div>

      {/* w-full and mb-0 override .tactile's default sizing/margin so bars fill
          this column evenly. Radius is set locally, not from the control radius
          scale, because these are figures, not controls. */}
      <div className="absolute left-[12.8%] top-[18.3%] z-10 flex h-[64.5%] w-[71.2%] flex-col justify-between">
        {TECHNIQUES.map((t, i) => (
          <button
            key={t.name}
            type="button"
            onClick={() => onSelect?.(i)}
            aria-label={`Learn about ${t.name}`}
            className={cn("tactile mb-0 h-[11.9%] w-full", entering && "animate-hero-row")}
            style={
              {
                "--depth": BAR_DEPTH,
                "--tactile-side": t.shadow,
                animationDelay: `${CARD_DELAY + 120 + i * BAR_STAGGER}ms`,
              } as CSSProperties
            }
          >
            <span className="tactile__base rounded-[4px]" aria-hidden="true" />
            <span
              className="tactile__face h-full w-full justify-start rounded-[4px] pl-[1.8%]"
              style={{ background: t.face }}
            >
              <span
                className="font-sans font-normal leading-none text-white"
                style={{ fontSize: BAR_FONT_CSS }}
              >
                {t.name}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
