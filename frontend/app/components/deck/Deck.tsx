"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DeckContext, type DeckContextValue, type Phase } from "./DeckContext";
import { SECTIONS } from "./sections";
import SectionShell from "./SectionShell";
import {
  ENTER_LOCK_MS, clampIndex, idToIndex, prefersReducedMotion,
} from "./deck-logic";

export default function Deck() {
  const [active, setActive] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [liveMsg, setLiveMsg] = useState("");

  const rootRef = useRef<HTMLElement>(null);
  const phaseRef = useRef<Phase>("idle");
  const activeRef = useRef(0);
  const pendingRef = useRef<number | null>(null);
  const didInit = useRef(false);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { activeRef.current = active; }, [active]);

  // Announce + move focus + sync hash on every settled change (skip first mount).
  useEffect(() => {
    if (!didInit.current) { didInit.current = true; return; }
    // Announces the settled section to screen readers; there is no non-effect trigger for this.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLiveMsg(`${SECTIONS[active].label}, section ${active + 1} of ${SECTIONS.length}`);
    const el = rootRef.current?.querySelector<HTMLElement>(".deck-section:not([hidden])");
    el?.focus({ preventScroll: true });
    window.history.replaceState(null, "", `#${SECTIONS[active].id}`);
  }, [active]);

  const go = useCallback((target: number) => {
    if (phaseRef.current !== "idle") return;
    const t = clampIndex(target, SECTIONS.length);
    if (t === activeRef.current) return;
    if (prefersReducedMotion()) {
      activeRef.current = t;
      setActive(t); // focus/announce/hash handled by the [active] effect
      return;
    }
    pendingRef.current = t;
    phaseRef.current = "exiting";
    setPhase("exiting");
  }, []);

  const handleExited = useCallback(() => {
    const t = pendingRef.current;
    if (t == null) return;
    pendingRef.current = null;
    activeRef.current = t;
    setActive(t);
    phaseRef.current = "entering";
    setPhase("entering");
    window.setTimeout(() => {
      phaseRef.current = "idle";
      setPhase("idle");
    }, ENTER_LOCK_MS);
  }, []);

  // Initial hash → section (after hydration; the server can't see the hash).
  useEffect(() => {
    const idx = idToIndex(window.location.hash, SECTIONS);
    // Reads the location hash after hydration; the server can't see it during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (idx > 0) { activeRef.current = idx; setActive(idx); }
    const onPop = () => {
      const i = idToIndex(window.location.hash, SECTIONS);
      go(i < 0 ? 0 : i);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [go]);

  const ctx: DeckContextValue = { active, phase, sections: SECTIONS, go };

  return (
    <DeckContext.Provider value={ctx}>
      <main ref={rootRef} className="relative flex-1 overflow-hidden">
        {SECTIONS.map((section, i) => (
          <SectionShell
            key={section.id}
            section={section}
            index={i}
            active={active}
            phase={phase}
            onExited={handleExited}
          />
        ))}
        <div aria-live="polite" className="sr-only">{liveMsg}</div>
      </main>
    </DeckContext.Provider>
  );
}
