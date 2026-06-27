"use client";

import { type CSSProperties } from "react";
import { cn } from "../../lib/cn";
import { useSectionEntrance } from "../deck/DeckContext";
import { TECHNIQUES } from "./techniqueBars";

// Right-side figure of the "techniques" section (Figma node 15:483): five level,
// tactile technique bars laid over a tilted stack of two blank cards.
//
// The whole thing is a fixed-aspect "stage" whose width is driven in vw, so every
// child keeps its 1:1 mock proportions at any viewport (no px caps that splay the
// card on wide screens). All percentages below are read straight off the mock's
// 1142×872 card+bars bounding box:
//   bars region  x 12.8%→84%   y 18.3%→82.8%   (bar 11.9% tall, gaps even)
//   blank card   79.5% × 100%, centred at 60.2%/50%, tilted clockwise
const STAGE_ASPECT = "1142 / 872";
const CARD_W = "74%";
const CARD_CX = "60.2%";
const ROT = 13; // deg, clockwise tilt — top-left corner rides highest, as drawn
const SHADOW_OFFSET = "translate(3.5%, 4.5%)"; // back card's down-right drop shadow

const CARD_DELAY = 200; // ms — stack settles just before the bars rise
const BAR_STAGGER = 90; // ms between bars (top → bottom)
// Shared tactile sink depth for every bar, as a % of bar height (translateY % is
// relative to the bar's own height) so it scales with the vw-driven stage. Stays
// well under the inter-bar gap (~10% of the bars region vs a ~2.4% lip here), so the
// base lip shows fully and identically on every bar (incl. the last) with no overlap.
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
      {/* ── Tilted blank-card stack (decorative, behind the bars) ── */}
      <div aria-hidden className="absolute inset-0 z-0 -translate-x-[75px]">
        <BlankCard fill="var(--sphere-back)" shadow entering={entering} />
        <BlankCard fill="var(--sphere-face)" entering={entering} />
      </div>

      {/* ── Technique bars (the content) ──
          A flex column pinned to the mock's bars region; justify-between gives the
          even bar/gap rhythm. Each bar reuses the house tactile system (.tactile /
          __base / __face): a colored face sitting squarely over a darker base that
          peeks out the bottom, with the house hover-lift + sink-on-press. One shared
          --depth (BAR_DEPTH) keeps the lip and press travel identical on every bar,
          incl. the last. w-full overrides .tactile's inline-flex; mb-0 drops its
          margin reserve so the justify-between rhythm matches the mock. Kept on
          rounded-[4px] (not the chamfer) — soft corners are part of this page's look. */}
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
            {/* darker base, peeking out the bottom */}
            <span className="tactile__base rounded-[4px]" aria-hidden="true" />
            {/* colored face + white label */}
            <span
              className="tactile__face h-full w-full justify-start rounded-[4px] pl-[1.8%]"
              style={{ background: t.face }}
            >
              <span
                className="font-sans font-normal leading-none text-white"
                style={{ fontSize: "clamp(13px, 1.7vw, 32px)" }}
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
