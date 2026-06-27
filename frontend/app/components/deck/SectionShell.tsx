"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import { SectionEntranceContext, type Phase } from "./DeckContext";
import type { SectionDef } from "./sections";
import { EXIT_MS } from "./deck-logic";

interface SectionShellProps {
  section: SectionDef;
  index: number;
  active: number;
  phase: Phase;
  isDesktop: boolean;
  onExited: () => void;
}

export default function SectionShell({ section, index, active, phase, isDesktop, onExited }: SectionShellProps) {
  const ref = useRef<HTMLElement>(null);
  const isCurrent = index === active;
  const visualState: "active" | "leaving" | "hidden" =
    phase === "exiting" && isCurrent ? "leaving" : isCurrent ? "active" : "hidden";
  const Component = section.Component;

  // Mobile: replay entrance when the section scrolls into view.
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (isDesktop) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [isDesktop]);

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

  const entered = isDesktop ? visualState === "active" : inView;

  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-label={section.label}
      hidden={isDesktop && visualState === "hidden"}
      className={cn(
        isDesktop ? "deck-section" : "deck-section-flow",
        isDesktop && visualState === "leaving" && "deck-section-leaving",
      )}
    >
      <SectionEntranceContext.Provider value={entered}>
        <Component label={section.label} />
      </SectionEntranceContext.Provider>
    </section>
  );
}
