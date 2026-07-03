"use client";

import type { CSSProperties } from "react";
import { cn } from "../../lib/cn";
import { CardDragHandle } from "../CardShell";
import { useDeck } from "../deck/DeckContext";

// Underlined inline link/emphasis; theme-agnostic hover via opacity.
const LINK = "underline decoration-from-font underline-offset-2 transition-opacity hover:opacity-70";

// Static showcase card for WhatDoppoIs. Reuses the real in-app card chrome (frame
// + CardDragHandle + header rule) so it reads as a genuine Doppo card, but is
// non-interactive (no drag, no remove). Content + breadcrumb transcribed from
// Figma node 20:579 (typos corrected). `className`/`style` let the caller set
// width + the entrance animation on the outer frame.
export default function DoppoInfoCard({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  const { go, sections } = useDeck();
  const goSelfHosting = () => {
    const i = sections.findIndex((s) => s.id === "self-hosting");
    if (i >= 0) go(i);
  };

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-card-border bg-card shadow-[0_2px_8px_rgba(0,0,0,0.08)]",
        className,
      )}
      style={style}
    >
      <header className="flex shrink-0 items-center gap-1.5 border-b border-surface-border px-2.5 py-[7px]">
        <CardDragHandle />
        <span className="shrink-0 text-[11px] font-semibold text-foreground">Home / Doppo</span>
        <span className="min-w-0 flex-1 truncate text-[10px] text-muted">What is Doppo?</span>
      </header>
      <div className="flex flex-col gap-[0.7em] px-[clamp(16px,1.6vw,28px)] py-[clamp(14px,1.4vw,22px)] text-[clamp(12px,1vw,15px)] leading-[1.5] text-foreground">
        <p className="m-0">
          Doppo is a mechanistic interpretability tool that aims to
          deliver basic techniques the field has developed in an easy and organized no-code
          environment. That is, we currently handle all compute, code set-up, and visualization,
          which allows for quick work.
        </p>
        <p className="m-0">
          Under the hood, we use TransformerLens, which was chosen for its wide-ranging support
          of thousands of transformer models. Some aspects of this library are being actively
          developed, so we cannot ensure that every model you&apos;ll try with Doppo will work perfectly.
        </p>
        <p className="m-0">
          As part of a goal to make interpretability broadly accessible, we also provide services at a price that mirrors 
          general inference costs with the eventual goal of decreasing what users pay. Users currently are allotted a free $1/month 
          priced against our service provider{" "} <a href="https://modal.com" target="_blank" rel="noopener 
          noreferrer" className={LINK}>Modal</a> to use on smaller tasks. Additional credits are available for 
          purchase with no further markup beyond a Stripe fee for sustainability.
        </p>
        <p className="m-0">
          More about our technical specifics can be found{" "}
          <button
            type="button"
            onClick={goSelfHosting} // needs to change to a static page here
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
