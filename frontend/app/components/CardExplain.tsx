"use client";

import React from "react";
import { BAND_ACCENT_W } from "./card-geometry";
import { PANEL_W, sidePanelPosition } from "./card-info-geometry";
import type { InfoSection } from "./card-info-content";
import { InfoTriggerButton, InfoPanelFrame, InfoSectionView, useDismissablePanel } from "./InfoPanelShell";

/**
 * The band's explanation trigger. Same panel chrome as CardInfo (built on
 * the same InfoPanelShell primitives), but anchored to the card's own left
 * or right edge instead of below the button, and showing the technique's
 * explanation instead of technical params. Rendered in tutorialMode,
 * alongside CardInfo, never instead of it.
 */
const BUTTON_SIZE = BAND_ACCENT_W;

export function CardExplain({
  accent,
  accentLabel,
  sections,
}: {
  accent: string;
  accentLabel: string;
  sections: InfoSection[];
}) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<{ left: number; top: number } | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) { setPos(null); return; }
    // The card's own frame carries `data-card-id` (see CardShell's CardFrame).
    // Walking up to it is how this measures "the card", not just the button.
    const cardEl = buttonRef.current?.closest<HTMLElement>("[data-card-id]");
    const cardRect = cardEl?.getBoundingClientRect();
    if (!cardRect) return;
    setPos(sidePanelPosition(
      { left: cardRect.left, right: cardRect.right, top: cardRect.top },
      { width: window.innerWidth, height: window.innerHeight },
      panelRef.current?.offsetHeight ?? 0,
    ));
  }, [open, sections]);

  const close = React.useCallback(() => setOpen(false), []);
  useDismissablePanel(open, close, { panelRef, triggerRef: buttonRef });

  return (
    <>
      <InfoTriggerButton
        ref={buttonRef}
        size={BUTTON_SIZE}
        accent={accent}
        glyph="?"
        ariaLabel={`${accentLabel} explanation`}
        open={open}
        onClick={() => setOpen(o => !o)}
      />

      {open && (
        <InfoPanelFrame panelRef={panelRef} width={PANEL_W} pos={pos}>
          <div className="text-[11px] font-semibold text-foreground">{accentLabel}</div>
          {sections.map((s, i) => <InfoSectionView key={i} section={s} />)}
        </InfoPanelFrame>
      )}
    </>
  );
}
