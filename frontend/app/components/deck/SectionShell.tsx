"use client";

import { useEffect, useRef } from "react";
import { cn } from "../../lib/cn";
import { SectionEntranceContext, type Phase } from "./DeckContext";
import type { SectionDef } from "./sections";
import { EXIT_MS } from "./deck-logic";

interface SectionShellProps {
  section: SectionDef;
  index: number;
  active: number;
  phase: Phase;
  onExited: () => void;
}

export default function SectionShell({ section, index, active, phase, onExited }: SectionShellProps) {
  const ref = useRef<HTMLElement>(null);
  const isCurrent = index === active;
  const visualState: "active" | "leaving" | "hidden" =
    phase === "exiting" && isCurrent ? "leaving" : isCurrent ? "active" : "hidden";
  const Component = section.Component;

  // While leaving: advance the deck when the fade-out ends (guarded) — with a
  // fallback timer so reduced-motion (0s) / interrupted animations can't deadlock.
  useEffect(() => {
    if (visualState !== "leaving") return;
    const el = ref.current;
    if (!el) return;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onExited();
    };
    const onEnd = (e: AnimationEvent) => {
      if (e.target === el && e.animationName === "deckFadeOut") finish();
    };
    el.addEventListener("animationend", onEnd);
    const timer = window.setTimeout(finish, EXIT_MS + 80);
    return () => {
      el.removeEventListener("animationend", onEnd);
      window.clearTimeout(timer);
    };
  }, [visualState, onExited]);

  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-label={section.label}
      hidden={visualState === "hidden"}
      className={cn("deck-section", visualState === "leaving" && "deck-section-leaving")}
    >
      <SectionEntranceContext.Provider value={visualState === "active"}>
        <Component label={section.label} />
      </SectionEntranceContext.Provider>
    </section>
  );
}
