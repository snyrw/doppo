"use client";

import { DeckContext, type DeckContextValue } from "../deck/DeckContext";
import { SECTIONS } from "../deck/sections";
import { prefersReducedMotion } from "../deck/deck-logic";
import FlowHero from "./FlowHero";

// Flow-mode landing: the deck's sections in a normal scrolling document with
// one shared gutter. The sections call useDeck() (via EyebrowNav), which
// throws without a provider, so we supply a stub context whose go() is a
// plain anchor scroll. active: -1 means no section reads as "current" and
// SectionEntranceContext stays at its false default (no entrance animations).
const flowCtx: DeckContextValue = {
  active: -1,
  phase: "idle",
  sections: SECTIONS,
  go: (i) => {
    const id = SECTIONS[i]?.id;
    if (!id) return;
    document.getElementById(id)?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  },
};

export default function LandingFlow() {
  return (
    <DeckContext.Provider value={flowCtx}>
      <main className="mx-auto w-full max-w-[720px] px-5">
        <section id="intro">
          <FlowHero />
        </section>
        {SECTIONS.slice(1).map(({ id, label, Component }) => (
          <section key={id} id={id} className="scroll-mt-4 py-14">
            <Component label={label} />
          </section>
        ))}
      </main>
    </DeckContext.Provider>
  );
}
