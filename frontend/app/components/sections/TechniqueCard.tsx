"use client";

import { CardHeader, CardRule, CARD_RADIUS } from "../CardShell";
import { TECHNIQUES } from "../../lib/techniques";
import { TECHNIQUE_CARDS } from "./techniqueCardData";
import { TECHNIQUE_FIGURES } from "./TechniqueFigures";

// One of the five technique cards shown as a modal from the Techniques
// section, reusing the real card header chrome (CardHeader + CardRule) so it
// reads as a genuine Doppo card. Body is a single column: a decorative figure
// on top, a rule, then the explainer prose. `index` is parallel to
// TECHNIQUES / TECHNIQUE_CARDS / TECHNIQUE_FIGURES.
export default function TechniqueCard({ index }: { index: number }) {
  const card = TECHNIQUE_CARDS[index];
  const Figure = TECHNIQUE_FIGURES[index];

  return (
    <div
      className="flex flex-col overflow-hidden border border-card-border bg-card shadow-[0_8px_32px_rgba(0,0,0,0.18)]"
      style={{ borderRadius: CARD_RADIUS }}
    >
      <CardHeader eyebrow="Home / Doppo" prompt={card.title} accent={TECHNIQUES[index].band} />
      <CardRule />

      <div className="flex justify-center p-[clamp(16px,2.2vw,36px)] pb-[clamp(10px,1.4vw,20px)]">
        {/* Uses `zoom`, not `transform: scale`, so the figure's layout box
            shrinks too. A transform would leave the original box reserved
            and pad the card with dead space around the smaller figure. */}
        <div style={{ zoom: 0.7 }}>
          <Figure />
        </div>
      </div>

      <CardRule />

      <p className="m-0 mx-auto max-w-[62ch] px-[clamp(16px,2.2vw,36px)] py-[clamp(14px,1.8vw,28px)] text-[clamp(12px,1.05vw,16px)] leading-[1.6] text-muted">
        {card.copy}
      </p>
    </div>
  );
}
