"use client";

import { cn } from "../../lib/cn";
import { STRIP_H, STRIP_RADIUS, SEGMENT_PAD_X } from "./ledger-geometry";

/**
 * Segmented control replacing the ledger's 228px section rail.
 *
 * `self-start` rather than full width: two segments stretched across 410px reads
 * as a bar with nothing in it, and content-sizing is also what lets steering's
 * four segments grow without a separate rule. The mock draws it at 43% of the
 * panel, which is what content-sizing lands on for two segments anyway.
 *
 * The active segment is a flush, flat fill on the button itself.
 */
export default function SectionStrip({
  sections,
  activeId,
  onChange,
}: {
  sections: { id: string; label: string }[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const buttons = Array.from(container.querySelectorAll('button'));
    const currentButton = buttons.find(btn => btn === document.activeElement);
    if (!currentButton) return;

    const currentIndex = buttons.indexOf(currentButton);
    let nextIndex: number | null = null;

    if (e.key === 'ArrowLeft') {
      nextIndex = currentIndex === 0 ? buttons.length - 1 : currentIndex - 1;
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      nextIndex = currentIndex === buttons.length - 1 ? 0 : currentIndex + 1;
      e.preventDefault();
    } else if (e.key === 'Home') {
      nextIndex = 0;
      e.preventDefault();
    } else if (e.key === 'End') {
      nextIndex = buttons.length - 1;
      e.preventDefault();
    }

    if (nextIndex !== null) {
      onChange(sections[nextIndex].id);
      setTimeout(() => {
        const updatedButtons = Array.from(container.querySelectorAll('button'));
        updatedButtons[nextIndex]?.focus();
      }, 0);
    }
  };

  return (
    <div
      data-section-strip
      role="tablist"
      aria-label="Configuration sections"
      onKeyDown={handleKeyDown}
      className="flex w-fit shrink-0 self-start bg-surface-border"
      style={{ height: STRIP_H, borderRadius: STRIP_RADIUS }}
    >
      {sections.map(s => {
        const isActive = s.id === activeId;
        return (
          <button
            key={s.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(s.id)}
            className={cn(
              "cursor-pointer whitespace-nowrap border-none text-[12px] leading-none transition-colors",
              isActive
                ? "bg-background text-foreground"
                : "bg-transparent text-muted hover:text-foreground",
            )}
            style={{ height: STRIP_H, borderRadius: STRIP_RADIUS, paddingInline: SEGMENT_PAD_X }}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
