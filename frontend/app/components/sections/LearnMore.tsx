"use client";

import { Fragment } from "react";
import { cn } from "../../lib/cn";
import EyebrowNav from "../EyebrowNav";
import { useSectionEntrance } from "../deck/DeckContext";
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
    <div className="relative h-full overflow-hidden">
      {/* Diagonal gutter hairline — self-clipping so it never adds scroll. Positive
          rotation about the top-left origin sends the bottom down-LEFT, matching the
          mock's lean (top ≈44% → bottom-left). Same shade as every other hairline. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden overflow-hidden md:block">
        <div
          className={cn("absolute left-[calc(44%+6vw)] top-0 h-[150%] w-px bg-surface-border", entering && "animate-hero-row")}
          style={{ transformOrigin: "top left", transform: "rotate(23deg)", animationDelay: "1080ms" }}
        />
      </div>

      {/* Edge-anchored row: copy capped + pinned left, card stage capped + pinned
          right; the center gap grows on ultrawide. Below md the card drops under the
          copy and the section flows (continuous scroll). */}
      <div className="relative flex h-full flex-col justify-center gap-[clamp(24px,4vw,48px)] px-[clamp(28px,6vw,96px)] py-[clamp(48px,8vw,0px)] md:flex-row md:items-center md:justify-between md:gap-[clamp(32px,6vw,160px)] md:py-0">
      {/* ── Left: copy ── */}
      <div className="relative z-10 flex max-w-[600px] flex-col md:flex-1">
        <div className={cn("mb-[clamp(30px,4.5vw,58px)]", entering && "animate-hero-row")}>
          <EyebrowNav />
        </div>

        <div className="relative">
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute -left-[26px] -top-6 h-[clamp(56px,7vw,96px)] w-[clamp(56px,7vw,96px)] border-l border-t border-muted",
              entering && "animate-hero-row",
            )}
          />
          <h2 className="m-0 max-w-[8em] font-display text-[clamp(34px,5vw,58px)] font-normal leading-[1.08] tracking-[-0.01em] text-accent">
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
            "mt-[clamp(16px,2vw,28px)] max-w-[26ch] text-[clamp(15px,1.8vw,24px)] leading-[1.4] text-muted",
            entering && "animate-hero-row",
          )}
          style={{ animationDelay: `${CONTROLS_DELAY - 60}ms` }}
        >
          deeper specifics for those who are interested
        </p>

        <hr
          className={cn(
            "mt-[clamp(24px,3vw,34px)] w-[calc(100%-160px)] border-0 border-t border-muted",
            entering && "animate-hero-row",
          )}
          style={{ animationDelay: `${CONTROLS_DELAY}ms` }}
        />
      </div>

        {/* ── Right: card stage (capped + pinned right) ──
            container-type: inline-size (.figure-stage) so the triangle field's cqi
            geometry scales to THIS column, not the viewport; the column's max-width
            therefore bounds the figure. Anchoring is structural now (no translateX). */}
        <div className="figure-stage relative z-10 flex w-full max-w-[720px] items-center justify-center md:flex-1">
          {/* Background triangle field — desktop only (self-clips via TriangleField). */}
          <div className="absolute inset-0 hidden overflow-hidden md:block">
            <TriangleField />
          </div>
          <LearnMoreCard
            className={cn("relative w-full max-w-[620px]", entering && "animate-hero-row")}
            style={{ animationDelay: `${CARD_DELAY}ms` }}
          />
        </div>
      </div>
    </div>
  );
}
