"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useIsDesktop } from "../../hooks/useIsDesktop";
import { DeckContext, type DeckContextValue, type Phase } from "./DeckContext";
import { SECTIONS } from "./sections";
import SectionShell from "./SectionShell";
import {
  ENTER_LOCK_MS, TOUCH_MIN_DELTA, clampIndex, idToIndex, intentToIndex,
  isTypingTarget, keyToIntent, nextIndex, prefersReducedMotion,
  shouldStepFromScroll, wheelDecision, type StepDir, type WheelState,
} from "./deck-logic";

export default function Deck() {
  const isDesktop = useIsDesktop();
  const [active, setActive] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [liveMsg, setLiveMsg] = useState("");

  const rootRef = useRef<HTMLElement>(null);
  const phaseRef = useRef<Phase>("idle");
  const activeRef = useRef(0);
  const pendingRef = useRef<number | null>(null);
  const didInit = useRef(false);
  const wheelRef = useRef<WheelState>({ lastNonQuietAt: Number.NEGATIVE_INFINITY });
  const touchStartY = useRef<number | null>(null);

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

  // Native listeners: JSX onWheel/onTouchMove are passive, so preventDefault()
  // would no-op. We attach wheel/touchmove non-passively and cancel selectively.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !isDesktop) return; // mobile: no snap navigation

    const step = (dir: StepDir) => go(nextIndex(activeRef.current, dir, SECTIONS.length));
    const activeSection = () => root.querySelector<HTMLElement>(".deck-section:not([hidden])");

    const onWheel = (e: WheelEvent) => {
      if (phaseRef.current !== "idle") { e.preventDefault(); return; }
      const dir: StepDir = e.deltaY > 0 ? 1 : -1;
      const el = activeSection();
      if (el && !shouldStepFromScroll(el, dir)) return; // let inner content scroll
      e.preventDefault();
      const { step: s, state } = wheelDecision(wheelRef.current, e.deltaY, performance.now());
      wheelRef.current = state;
      if (s !== 0) step(s);
    };

    const onTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (phaseRef.current !== "idle") { e.preventDefault(); return; }
      const startY = touchStartY.current;
      const y = e.touches[0]?.clientY;
      if (startY == null || y == null) return;
      const dy = startY - y; // swipe up (dy > 0) → next section
      const dir: StepDir = dy > 0 ? 1 : -1;
      const el = activeSection();
      if (el && !shouldStepFromScroll(el, dir)) return; // inner scroll wins
      if (Math.abs(dy) < TOUCH_MIN_DELTA) return;
      e.preventDefault();
      touchStartY.current = null;
      step(dir);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(document.activeElement as { tagName?: string; isContentEditable?: boolean } | null)) return;
      const intent = keyToIntent(e.key);
      if (!intent) return;
      e.preventDefault();
      go(intentToIndex(intent, activeRef.current, SECTIONS.length));
    };

    root.addEventListener("wheel", onWheel, { passive: false });
    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      root.removeEventListener("wheel", onWheel);
      root.removeEventListener("touchstart", onTouchStart);
      root.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [go, isDesktop]);

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
            isDesktop={isDesktop}
            onExited={handleExited}
          />
        ))}
        <div aria-live="polite" className="sr-only">{liveMsg}</div>
      </main>
    </DeckContext.Provider>
  );
}
