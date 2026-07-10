"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { cn } from "../../lib/cn";
import { CardDragHandle } from "../CardShell";

// Underlined inline link/emphasis; theme-agnostic hover via opacity (matches DoppoInfoCard).
const LINK = "underline decoration-from-font underline-offset-2 transition-opacity hover:opacity-70";

// Static showcase card for the LearnMore section (Figma node 20:603). Reuses the real
// in-app card chrome (frame + CardDragHandle + header rule) so it reads as a genuine
// Doppo card, but is non-interactive (no drag, no remove). Copy stays close to the
// Figma wording; the "docs" line points at the interim static page rather than a
// not-yet-existent docs site. `className`/`style` let the caller set width + the
// entrance animation on the outer frame — same signature as DoppoInfoCard.
export default function LearnMoreCard({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-card-border bg-card shadow-[0_4px_40px_rgba(0,0,0,0.18)]",
        className,
      )}
      style={style}
    >
      <header className="flex shrink-0 items-center gap-1.5 border-b border-surface-border px-2.5 py-[7px]">
        <CardDragHandle />
        <span className="shrink-0 text-[11px] font-semibold text-foreground">Home / Doppo</span>
        <span className="min-w-0 flex-1 truncate text-[10px] text-muted">
          Interested in learning more?
        </span>
      </header>
      <div className="flex flex-col gap-[0.7em] px-[clamp(16px,1.6vw,28px)] py-[clamp(14px,1.4vw,22px)] text-[clamp(12px,1vw,15px)] leading-[1.5] text-foreground">
        <p className="m-0">
          It&apos;s hard to boil down a lot of what this site holds into just a few marketing pages, so
          we host several resources for learning more specifics about Doppo and the techniques we house.
        </p>
        <p className="m-0">
          If you&apos;re new to mechanistic interpretability, the{" "}
          <Link href="/tutorial" className={LINK}>tutorial</Link> walks through some canonical works that
          can aid in understanding what we do.
        </p>
        <p className="m-0">
          Things like deeper specifics on exactly how we price, how we implement our techniques, and
          so on may eventually live in dedicated docs, but we have a{" "}
          <Link href="/docs" className={LINK}>static page</Link> where you can access most related
          information in the meantime.
        </p>
        <p className="m-0">
          We hope you enjoy Doppo! If you have issues with this site or just don&apos;t like what we do,
          feel free to reach out to{" "}
          <a href="mailto:help@doppo.tools" className={LINK}>help@doppo.tools</a>.
        </p>
      </div>
    </div>
  );
}
