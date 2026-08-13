// frontend/app/components/configledger/ConfigLedger.tsx
"use client";

import React from "react";
import { TactileButton } from "../ui/TactileButton";
import { CloseButton } from "../ui/CloseButton";
import SectionStrip from "./SectionStrip";
import { cn } from "../../lib/cn";
import { PANEL_LABEL, PANEL_META } from "./panel-type";
import {
  LEDGER_W, LEDGER_RADIUS,
  INSET, BLOCK_GAP, TIGHT_GAP, FOOTER_PAD_Y,
  ACCENT_SIZE, ACCENT_RADIUS,
} from "./ledger-geometry";

export type LedgerSection = {
  id: string;
  label: string;
  body: React.ReactNode;
};

/**
 * Single-pane config shell shared by all five technique config panes. A
 * segmented strip selects the section; the body shows only the active one.
 */
export default function ConfigLedger({
  title,
  accent,
  sections,
  activeSection,
  onSectionChange,
  footerSummary,
  canRun,
  runLabel,
  onRun,
  onClose,
}: {
  title: string;
  /** Technique band colour — `TECHNIQUES[…].band`, never `face`. */
  accent: string;
  sections: LedgerSection[];
  activeSection: string;
  onSectionChange: (id: string) => void;
  footerSummary: string;
  canRun: boolean;
  runLabel: string;
  onRun: () => void;
  onClose: () => void;
}) {
  const active = sections.find(s => s.id === activeSection) ?? sections[0];

  return (
    <div
      data-config-panel
      className="absolute left-0 top-[calc(100%+6px)] z-30 flex animate-cfg-drop-in flex-col border border-card-border bg-card"
      style={{
        width: LEDGER_W,
        maxWidth: `min(${LEDGER_W}px, calc(100vw - 24px))`,
        borderRadius: LEDGER_RADIUS,
      }}
    >
      {/* Header and strip, one pinned block on the content column */}
      <div className="shrink-0" style={{ paddingInline: INSET, paddingTop: INSET }}>
        <div className="flex items-center" style={{ gap: TIGHT_GAP }}>
          <span className="text-[14px] leading-none text-foreground">{title}</span>
          <span className="flex-1" />
          <CloseButton onClick={onClose} label="Close" />
        </div>

        <div className="flex items-center" style={{ marginTop: BLOCK_GAP, gap: TIGHT_GAP }}>
          {/* Technique identity. Not a button here since it doesn't actually do anything. */}
          <span
            data-accent
            aria-hidden
            className="shrink-0"
            style={{
              width: ACCENT_SIZE,
              height: ACCENT_SIZE,
              borderRadius: ACCENT_RADIUS,
              backgroundColor: accent,
            }}
          />
          <SectionStrip sections={sections} activeId={active.id} onChange={onSectionChange} />
        </div>
      </div>

      {/* Rule. Inset-to-inset like CardRule, not a full-bleed border-b */}
      <div
        className="h-px shrink-0 bg-surface-border"
        style={{ marginInline: INSET, marginTop: BLOCK_GAP }}
      />

      {/* Body. Active section only */}
      <div className="min-w-0 flex-1" style={{ padding: INSET }}>
        {active.body}
      </div>

      {/* Footer. Shows all information */}
      <div
        className="flex shrink-0 items-center border-t border-surface-border"
        style={{ paddingInline: INSET, paddingBlock: FOOTER_PAD_Y, gap: BLOCK_GAP }}
      >
        <div className="min-w-0 flex-1">
          <span className={cn(PANEL_LABEL, "block")}>Summary</span>
          <span className={cn(PANEL_META, "mt-1 block truncate")}>
            {footerSummary}
          </span>
        </div>
        <TactileButton
          variant="primary"
          capsule
          onClick={onRun}
          disabled={!canRun}
          faceClassName="px-4 justify-center py-2 text-[11px] tracking-[0.02em] disabled:cursor-not-allowed"
        >
          {runLabel}
        </TactileButton>
      </div>
    </div>
  );
}
