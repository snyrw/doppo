"use client";

import { CardDragHandle } from "../CardShell";
import { TECHNIQUE_CARDS } from "./techniqueCardData";
import { TECHNIQUE_FIGURES } from "./TechniqueFigures";

// One of the five technique cards shown as a modal from the Techniques section
// (Figma nodes 134-2/3/5/6/7). Reuses the real in-app card chrome (frame +
// CardDragHandle + header rule), like DoppoInfoCard, so it reads as a genuine
// Doppo card. Body is two columns — a decorative figure (left) and a monospace
// explainer (right) split by a vertical hairline. `index` is parallel to
// TECHNIQUES / TECHNIQUE_CARDS / TECHNIQUE_FIGURES.
export default function TechniqueCard({ index }: { index: number }) {
  const card = TECHNIQUE_CARDS[index];
  const Figure = TECHNIQUE_FIGURES[index];

  return (
    <div className="flex flex-col overflow-hidden rounded-[15px] border border-card-border bg-card shadow-[0_8px_32px_rgba(0,0,0,0.18)]">
      <header className="flex shrink-0 items-center gap-1.5 border-b border-surface-border px-3 py-[9px]">
        <CardDragHandle />
        <span className="shrink-0 text-[clamp(12px,1vw,15px)] font-semibold text-foreground">Home / Doppo</span>
        <span className="min-w-0 flex-1 truncate font-mono text-[clamp(10px,0.9vw,13px)] text-muted">
          {card.title}
        </span>
      </header>

      <div className="flex flex-col gap-[clamp(16px,2.2vw,36px)] p-[clamp(16px,2.2vw,36px)] md:flex-row md:items-stretch">
        {/* left: decorative figure (snug box, centered in its column) */}
        <div className="flex shrink-0 items-center justify-center">
          <Figure />
        </div>

        {/* vertical hairline divider (horizontal when stacked) */}
        <div className="h-px w-full shrink-0 bg-surface-border md:h-auto md:w-px" />

        {/* right: explainer copy (narrow column so it wraps tall, like the mock) */}
        <div className="flex flex-1 items-center">
          <p className="m-0 max-w-[34ch] font-mono text-[clamp(12px,1.05vw,18px)] leading-[1.55] text-muted">
            {card.copy}
          </p>
        </div>
      </div>
    </div>
  );
}
