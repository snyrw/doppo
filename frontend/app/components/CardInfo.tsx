"use client";

import React from "react";
import { createPortal } from "react-dom";
import { bandShadow } from "../lib/techniques";
import { BAND_ACCENT_W } from "./card-geometry";
import { PANEL_W, panelPosition } from "./card-info-geometry";
import type { InfoSection } from "./card-info-content";
import { TierBadge } from "./CardShell";

/* The card info button and its panel. */

/**
 * The band's leading slot.
 */
const BUTTON_SIZE = BAND_ACCENT_W;

/**
 * Depth of the tactile side the face sinks onto.
 */
const LIP = 2;

export function CardInfo({
  accent,
  accentLabel,
  sections,
  controls,
}: {
  accent: string;
  accentLabel: string;
  sections: InfoSection[];
  controls?: React.ReactNode | ((close: () => void) => React.ReactNode);
}) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<{ left: number; top: number } | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) { setPos(null); return; }
    const btn = buttonRef.current?.getBoundingClientRect();
    if (!btn) return;
    setPos(panelPosition(
      { left: btn.left, top: btn.top, bottom: btn.bottom },
      { width: window.innerWidth, height: window.innerHeight },
      panelRef.current?.offsetHeight ?? 0,
    ));
  }, [open, sections, controls]);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || buttonRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onWheel = () => setOpen(false);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("wheel", onWheel);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        onPointerDown={e => e.stopPropagation()}
        onClick={() => setOpen(o => !o)}
        aria-label={`${accentLabel} details`}
        aria-expanded={open}
        className="group relative shrink-0 cursor-pointer border-none bg-transparent p-0"
        style={{ width: BUTTON_SIZE, height: BUTTON_SIZE }}
      >
        <span
          aria-hidden="true"
          className="absolute inset-0"
          style={{ backgroundColor: bandShadow(accent) }}
        />
        <span
          className="absolute left-0 top-0 flex w-full items-center justify-center font-mono text-white transition-transform group-hover:-translate-y-px group-active:translate-y-[2px]"
          style={{
            height: BUTTON_SIZE - LIP,
            backgroundColor: accent,
            fontSize: 10,
            lineHeight: `${BUTTON_SIZE - LIP}px`,
          }}
        >
          i
        </span>
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          onPointerDown={e => e.stopPropagation()}
          className="fixed z-[70] flex flex-col gap-2.5 rounded-md border border-card-border bg-background px-3 py-2.5"
          style={{
            width: PANEL_W,
            left: pos?.left ?? 0,
            top: pos?.top ?? 0,
            // Hidden for the one frame between mount and measurement, so the
            // panel is never seen at 0,0.
            visibility: pos ? "visible" : "hidden",
          }}
        >
          {sections.map((s, i) => <InfoSectionView key={i} section={s} />)}
          {controls && (
            <>
              <div className="h-px bg-card-border" />
              {typeof controls === "function" ? controls(() => setOpen(false)) : controls}
            </>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

function InfoSectionView({ section }: { section: InfoSection }) {
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
  }
}
