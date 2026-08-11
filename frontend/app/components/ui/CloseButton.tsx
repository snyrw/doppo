"use client";

import { CLOSE_GLYPH, CLOSE_HIT } from "./control-metrics";

/**
 * Shared close glyph used by both the card frame and the config panel.
 * Positioning is left to the caller because the two surfaces place it
 * differently: the card sets it absolutely, the panel seats it in a flex row.
 */
export function CloseButton({
  onClick,
  label,
  stopPointerDown,
}: {
  onClick: () => void;
  /** Accessible name. "Remove card" on a card, "Close" on the panel. */
  label: string;
  /** Cards need this so closing does not start a canvas drag. */
  stopPointerDown?: boolean;
}) {
  return (
    <button
      onPointerDown={stopPointerDown ? e => e.stopPropagation() : undefined}
      onClick={onClick}
      aria-label={label}
      className="flex shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-muted transition-colors hover:text-foreground"
      style={{ width: CLOSE_HIT, height: CLOSE_HIT }}
    >
      <svg
        width={CLOSE_GLYPH}
        height={CLOSE_GLYPH}
        viewBox="0 0 14 14"
        fill="none"
        aria-hidden="true"
      >
        <path d="M1.5 1.5L12.5 12.5M12.5 1.5L1.5 12.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      </svg>
    </button>
  );
}
