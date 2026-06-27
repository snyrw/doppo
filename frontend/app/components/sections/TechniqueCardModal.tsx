"use client";

import { useEffect, useRef } from "react";
import TechniqueCard from "./TechniqueCard";

// Centered modal wrapper for the technique cards. Modeled on the house Modal
// primitive (overlay + click-to-close + fade-in) but the card supplies its own
// chrome, so this sets no panel padding/border of its own (the primitive's
// `p-6 rounded-xl bg-card` would double the card's chrome and break the flush
// header rule; the project has no tailwind-merge to safely override it). Adds
// Escape-to-close and restores focus to the triggering bar on unmount.
export default function TechniqueCardModal({ index, onClose }: { index: number; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prevFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    // Capture phase so we close before the deck's window-level key handler reacts.
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      prevFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-fit max-w-[min(760px,92vw)] max-h-[88vh] overflow-y-auto outline-none"
      >
        <TechniqueCard index={index} />
      </div>
    </div>
  );
}
