"use client";

import { Fragment } from "react";
import { cn } from "../../lib/cn";
import EyebrowNav from "../EyebrowNav";
import { useSectionEntrance } from "../deck/DeckContext";
import SphereField from "./SphereField";
import DoppoInfoCard from "./DoppoInfoCard";

// "What Doppo is" deck section (Figma node 20:579). Left column = eyebrow nav,
// registration corner + heading, subtitle, hairline. Right column = the real-
// chrome info card. Behind both, a decorative sphere field. Entrance mirrors the
// hero page: left side uses Hero's word/row timings; the spheres fade in
// largest → smallest; the card fades in last, on top. Everything is gated by
// useSectionEntrance() so it replays whenever the section becomes active.
const HEADING = "What Doppo is";
const WORD_STAGGER = 60;    // matches Hero
const CONTROLS_DELAY = 380; // matches Hero (hr/subtitle settle)
const CARD_DELAY = 1200;    // card lands after the last sphere (~1060ms)

export default function WhatDoppoIs() {
  const entering = useSectionEntrance();
  return (
    // Edge-anchored row: copy capped + pinned left, figure stage capped + pinned
    // right; the center gap (md:justify-between + md:gap) absorbs extra width on
    // ultrawide so content stops scaling instead of splaying. Below md the section
    // flows as a normal column (copy then card) so the page scrolls.
    <div className="relative flex h-full flex-col justify-center gap-[clamp(24px,4vw,48px)] px-[clamp(28px,6vw,96px)] py-[clamp(48px,8vw,0px)] md:flex-row md:items-center md:justify-between md:gap-[clamp(32px,6vw,160px)] md:py-0">
      {/* ── Left: copy (capped + pinned left) ── */}
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
          <h2 className="m-0 font-display text-[clamp(34px,5vw,58px)] font-normal leading-[1.08] tracking-[-0.01em] text-accent">
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
            "mt-[clamp(16px,2vw,28px)] max-w-[34ch] text-[clamp(15px,1.8vw,24px)] leading-[1.4] text-muted",
            entering && "animate-hero-row",
          )}
          style={{ animationDelay: `${CONTROLS_DELAY - 60}ms` }}
        >
          a brief overview of what we are <br /> and technical basics
        </p>

        <hr
          className={cn(
            "mt-[clamp(24px,3vw,34px)] w-[calc(100%-160px)] border-0 border-t border-muted",
          )}
          style={{ animationDelay: `${CONTROLS_DELAY}ms` }}
        />
      </div>

      {/* ── Right: figure stage (capped + pinned right) ──
          container-type: inline-size (.figure-stage) so the sphere field's cqi
          geometry scales to THIS column, not the viewport; the column's max-width
          therefore bounds the figure. Anchoring is structural now (no translateX). */}
      <div className="figure-stage relative z-10 flex w-full max-w-[720px] items-center justify-center md:flex-1">
        {/* Background sphere field — desktop only (self-clips via SphereField). */}
        <div className="absolute inset-0 hidden overflow-hidden md:block">
          <SphereField />
        </div>
        <DoppoInfoCard
          className={cn("relative w-full max-w-[620px]", entering && "animate-hero-row")}
          style={{ animationDelay: `${CARD_DELAY}ms` }}
        />
      </div>
    </div>
  );
}
