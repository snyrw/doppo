"use client";

import { Fragment, type CSSProperties } from "react";
import { cn } from "../../lib/cn";
import EyebrowNav from "../EyebrowNav";
import { useSectionEntrance } from "../deck/DeckContext";
import { CARD_LEFT_U, CARD_W_U, FIELD_LEFT_CSS, FRAME_W_U, HF_UNIT, u } from "../figure-geometry";
import TriangleField from "./TriangleField";
import LearnMoreCard from "./LearnMoreCard";

// "learn more" deck section (Figma node 20:603). Two-column layout mirroring the
// sibling sections "what doppo is" and "techniques": left column = eyebrow nav,
// registration corner + heading, subtitle, hairline; right column = the real-chrome
// card. Behind both, the decorative left-pointing triangle field, and a single
// diagonal hairline runs down the gutter between the columns (as in the mock).
// Entrance reuses the hero word/row timings — left copy rises, the triangles fade in
// left → right, the gutter line fades in late, and the card lands last. Everything is
// gated by useSectionEntrance() so it replays whenever the section becomes active.
const HEADING = "Want to learn more?";
const WORD_STAGGER = 60; // matches Hero
const CONTROLS_DELAY = 380; // matches Hero (hr/subtitle settle)
const CARD_DELAY = 1200; // card lands after the triangle field settles (~1060ms)

export default function LearnMore() {
  const entering = useSectionEntrance();
  return (
    <div className="deck-two-col relative grid h-full grid-cols-1 overflow-hidden">
      {/* Background triangle field + gutter hairline — deck only (self-clips
          via TriangleField's stage). */}
      <div className="deck-only absolute inset-0">
        <TriangleField />
      </div>

      {/* ── Left: copy ── */}
      <div className="deck-col-pad relative z-10 flex flex-col justify-center">
        <div className={cn("deck-only mb-[clamp(30px,min(4.5vw,8svh),58px)]", entering && "animate-hero-row")}>
          <EyebrowNav />
        </div>

        <div className="relative">
          <span
            aria-hidden
            className={cn(
              "deck-only pointer-events-none absolute -left-[26px] -top-6 h-[clamp(56px,min(7vw,12.444svh),96px)] w-[clamp(56px,min(7vw,12.444svh),96px)] border-l border-t border-muted",
              entering && "animate-hero-row",
            )}
          />
          <h2 className="m-0 max-w-[8em] font-display text-[clamp(34px,min(5vw,8.889svh),58px)] font-normal leading-[1.08] tracking-[-0.01em] text-accent">
            {HEADING.split(" ").map((word, i) => (
              <Fragment key={i}>
                <span
                  className={cn("inline-block", entering && "animate-hero-word")}
                  style={{ animationDelay: `${i * WORD_STAGGER}ms` }}
                >
                  {word}
                </span>{" "}
              </Fragment>
            ))}
          </h2>
        </div>

        <p
          className={cn(
            "mt-[clamp(16px,min(2vw,3.556svh),28px)] max-w-[26ch] text-[clamp(15px,min(1.8vw,3.2svh),24px)] leading-[1.4] text-muted",
            entering && "animate-hero-row",
          )}
          style={{ animationDelay: `${CONTROLS_DELAY - 60}ms` }}
        >
          deeper specifics for those who are interested
        </p>

        <hr
          className={cn(
            "deck-hr-inset mt-[clamp(24px,min(3vw,5.333svh),34px)] w-full border-0 border-t border-muted",
            entering && "animate-hero-row",
          )}
          style={{ animationDelay: `${CONTROLS_DELAY}ms` }}
        />
      </div>

      {/* ── Right: card (desktop) — stage-positioned in the same --hf-u frame as
          the triangle field, so the field's behind-the-card tuck stays rigid at
          every aspect ratio (the old %-centered + px-capped card sheared against
          the vw-scaled field on tall viewports). ── */}
      <div
        className="deck-only pointer-events-none absolute inset-y-0 z-10"
        style={{ "--hf-u": HF_UNIT, left: FIELD_LEFT_CSS, width: u(FRAME_W_U) } as CSSProperties}
      >
        <LearnMoreCard
          className={cn("pointer-events-auto absolute top-1/2 -translate-y-1/2", entering && "animate-hero-row")}
          style={{ left: u(CARD_LEFT_U), width: u(CARD_W_U), animationDelay: `${CARD_DELAY}ms` }}
        />
      </div>

      {/* ── Right: card (flow fallback) — the shared gutter supplies horizontal
          padding, so this only centers + spaces below the copy. ── */}
      <div className="flow-only relative z-10 mt-[clamp(28px,7vw,44px)] flex items-center justify-center">
        <LearnMoreCard
          className={cn("w-full max-w-[560px]", entering && "animate-hero-row")}
          style={{ animationDelay: `${CARD_DELAY}ms` }}
        />
      </div>
    </div>
  );
}
