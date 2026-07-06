"use client";

import { Fragment, type CSSProperties } from "react";
import { cn } from "../../lib/cn";
import EyebrowNav from "../EyebrowNav";
import { useSectionEntrance } from "../deck/DeckContext";
import { CARD_LEFT_U, CARD_W_U, FIELD_LEFT_CSS, FRAME_W_U, HF_UNIT, u } from "../figure-geometry";
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
    <div className="relative grid h-full grid-cols-1 md:grid-cols-[1fr_1fr]">
      {/* Background sphere field — desktop only (self-clips via SphereField). */}
      <div className="absolute inset-0 hidden md:block">
        <SphereField />
      </div>

      {/* ── Left: copy ── */}
      <div className="relative z-10 flex flex-col justify-center px-[clamp(28px,6vw,96px)]">
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

      {/* ── Right: card (desktop) — stage-positioned in the same --hf-u frame as
          the sphere field so card and field stay rigid at every aspect ratio. ── */}
      <div
        className="pointer-events-none absolute inset-y-0 z-10 hidden md:block"
        style={{ "--hf-u": HF_UNIT, left: FIELD_LEFT_CSS, width: u(FRAME_W_U) } as CSSProperties}
      >
        <DoppoInfoCard
          className={cn("pointer-events-auto absolute top-1/2 -translate-y-1/2", entering && "animate-hero-row")}
          style={{ left: u(CARD_LEFT_U), width: u(CARD_W_U), animationDelay: `${CARD_DELAY}ms` }}
        />
      </div>

      {/* ── Right: card (mobile flow fallback) ── */}
      <div className="relative z-10 flex items-center justify-center px-[clamp(28px,4vw,72px)] pb-[clamp(24px,4vw,40px)] md:hidden">
        <DoppoInfoCard
          className={cn("w-[clamp(320px,32vw,620px)]", entering && "animate-hero-row")}
          style={{ animationDelay: `${CARD_DELAY}ms` }}
        />
      </div>
    </div>
  );
}
