"use client";

import React from "react";
import { BAND_ACCENT_W } from "./card-geometry";
import { PANEL_W, panelPosition } from "./card-info-geometry";
import type { InfoSection } from "./card-info-content";
import { InfoTriggerButton, InfoPanelFrame, InfoSectionView, useDismissablePanel } from "./InfoPanelShell";

/* The card info button and its panel. */

const BUTTON_SIZE = BAND_ACCENT_W;

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

  const close = React.useCallback(() => setOpen(false), []);
  useDismissablePanel(open, close, { panelRef, triggerRef: buttonRef });

  return (
    <>
      <InfoTriggerButton
        ref={buttonRef}
        size={BUTTON_SIZE}
        accent={accent}
        glyph="i"
        ariaLabel={`${accentLabel} details`}
        open={open}
        onClick={() => setOpen(o => !o)}
      />

      {open && (
        <InfoPanelFrame panelRef={panelRef} width={PANEL_W} pos={pos}>
          {sections.map((s, i) => <InfoSectionView key={i} section={s} />)}
          {controls && (
            <>
              <div className="h-px bg-card-border" />
              {typeof controls === "function" ? controls(() => setOpen(false)) : controls}
            </>
          )}
        </InfoPanelFrame>
      )}
    </>
  );
}
