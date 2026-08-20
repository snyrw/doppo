"use client";

import type { CSSProperties } from "react";
import { cn } from "../../lib/cn";
import { CardHeader, CardRule, CARD_RADIUS } from "../CardShell";
import { BAND_NEUTRAL } from "../../lib/techniques";
import { useDeck } from "../deck/DeckContext";

// Underlined inline link/emphasis; theme-agnostic hover via opacity.
const LINK = "underline decoration-from-font underline-offset-2 transition-opacity hover:opacity-70";

// Static showcase card for WhatDoppoIs. Reuses the real card header chrome
// (CardHeader + CardRule) so it reads as a genuine Doppo card, but is
// non-interactive. `className`/`style` let the caller set width and the
// entrance animation on the outer frame.
export default function DoppoInfoCard({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  const { go, sections } = useDeck();
  const goLearnMore = () => {
    const i = sections.findIndex((s) => s.id === "learnmore");
    if (i >= 0) go(i);
  };

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden border border-card-border bg-card shadow-[0_2px_8px_rgba(0,0,0,0.08)]",
        className,
      )}
      style={{ borderRadius: CARD_RADIUS, ...style }}
    >
      <CardHeader eyebrow="Home / Doppo" prompt="What is Doppo?" accent={BAND_NEUTRAL} />
      <CardRule />
      <div className="flex flex-col gap-[0.7em] px-[clamp(16px,1.6vw,28px)] py-[clamp(14px,1.4vw,22px)] text-[clamp(12px,1vw,15px)] leading-[1.5] text-foreground">
        <p className="m-0">
          Doppo is a mechanistic interpretability tool that aims to
          deliver basic techniques the field has developed in an easy and organized no-code
          environment. That is, we currently handle all compute, code set-up, and visualization,
          which allows for quick work.
        </p>
        <p className="m-0">
          Under the hood, we use TransformerLens, which was chosen for its wide-ranging support
          of thousands of transformer models.
        </p>
        <p className="m-0">
          As part of a goal to make interpretability accessible, we also provide services at a price that mirrors
          general inference costs. Users currently are allotted a free $1/month
          priced against our service provider{" "} <a href="https://modal.com" target="_blank" rel="noopener
          noreferrer" className={LINK}>Modal</a> to use on smaller tasks. Additional usage balance is available for
          purchase with no further markup beyond a Stripe fee for sustainability.
        </p>
        <p className="m-0">
          More about our technical specifics can be found{" "}
          <button
            type="button"
            onClick={goLearnMore} // needs to change to a static page here
            className={cn(LINK, "cursor-pointer bg-transparent p-0 text-inherit")}
          >
            here
          </button>
          .
        </p>
      </div>
    </div>
  );
}
