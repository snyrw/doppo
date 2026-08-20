"use client";

import React from "react";
import { createPortal } from "react-dom";
import { bandShadow } from "../lib/techniques";
import { TierBadge } from "./CardShell";
import type { InfoSection } from "./card-info-content";
import { VIEWPORT_MARGIN } from "./card-info-geometry";

/**
 * Shared chrome for the card band's two popups: CardInfo's technical-params
 * panel and CardExplain's technique explanation. Both are a small square
 * trigger button plus a portaled panel with the same open/dismiss wiring.
 * Where the panel lands is each caller's own job (`panelPosition` vs
 * `sidePanelPosition` in card-info-geometry.ts).
 */

const LIP = 2;

export const InfoTriggerButton = React.forwardRef<
  HTMLButtonElement,
  { size: number; accent: string; glyph: string; ariaLabel: string; open: boolean; onClick: () => void }
>(function InfoTriggerButton({ size, accent, glyph, ariaLabel, open, onClick }, ref) {
  return (
    <button
      ref={ref}
      onPointerDown={e => e.stopPropagation()}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-expanded={open}
      className="group relative shrink-0 cursor-pointer border-none bg-transparent p-0"
      style={{ width: size, height: size }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{ backgroundColor: bandShadow(accent) }}
      />
      <span
        className="absolute left-0 top-0 flex w-full items-center justify-center font-mono text-white transition-transform group-hover:-translate-y-px group-active:translate-y-[2px]"
        style={{
          height: size - LIP,
          backgroundColor: accent,
          fontSize: 10,
          lineHeight: `${size - LIP}px`,
        }}
      >
        {glyph}
      </span>
    </button>
  );
});

/** Wires outside-click, Escape, and wheel dismissal for an open panel. */
export function useDismissablePanel(
  open: boolean,
  onClose: () => void,
  refs: { panelRef: React.RefObject<HTMLElement | null>; triggerRef: React.RefObject<HTMLElement | null> },
) {
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (refs.panelRef.current?.contains(t) || refs.triggerRef.current?.contains(t)) return;
      onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    // Scrolling inside the panel must not dismiss it: only a wheel event
    // outside the panel counts as "scrolled away from it".
    const onWheel = (e: WheelEvent) => {
      const t = e.target as Node;
      if (refs.panelRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("wheel", onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose]);
}

export function InfoPanelFrame({
  panelRef, width, pos, children,
}: {
  panelRef: React.RefObject<HTMLDivElement | null>;
  width: number;
  pos: { left: number; top: number } | null;
  children: React.ReactNode;
}) {
  return createPortal(
    <div
      ref={panelRef}
      onPointerDown={e => e.stopPropagation()}
      className="fixed z-[70] flex flex-col gap-2.5 overflow-y-auto rounded-md border border-card-border bg-background px-3 py-2.5"
      style={{
        width,
        left: pos?.left ?? 0,
        top: pos?.top ?? 0,
        // Bounded so long copy scrolls inside the panel instead of running
        // off the bottom of a `position: fixed` element, which page scroll
        // can never reveal.
        maxHeight: `calc(100vh - ${VIEWPORT_MARGIN * 2}px)`,
        // Hidden for the one frame between mount and measurement, so the
        // panel is never seen at 0,0.
        visibility: pos ? "visible" : "hidden",
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

export function InfoSectionView({ section }: { section: InfoSection }) {
  switch (section.kind) {
    case "identity":
      return (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] leading-[14px] text-foreground">{section.technique}</span>
          <TierBadge tier={section.tier ?? undefined} />
        </div>
      );
    case "text":
      return (
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-semibold text-muted">{section.label}</span>
          <p className="m-0 break-words text-[10px] leading-[1.5] text-foreground">{section.value}</p>
        </div>
      );
    case "params":
      return (
        <div className="flex flex-col gap-0.5">
          {section.rows.map(r => (
            <div key={r.label} className="flex items-baseline justify-between gap-2">
              <span className="shrink-0 text-[10px] leading-[15px] text-muted">{r.label}</span>
              <span className="min-w-0 truncate text-right font-mono text-[10px] leading-[15px] text-foreground">
                {r.value}
              </span>
            </div>
          ))}
        </div>
      );
    case "warning":
      return <p className="m-0 text-[10px] leading-[1.5] text-amber-600">{section.text}</p>;
    case "prose":
      return <p className="m-0 text-[10px] leading-[1.6] text-foreground">{section.text}</p>;
    case "links":
      return (
        <div className="flex flex-col gap-1">
          {section.links.map(l => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-foreground underline decoration-surface-border underline-offset-2"
            >
              {l.label}
            </a>
          ))}
        </div>
      );
  }
}
