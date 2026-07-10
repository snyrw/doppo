// frontend/app/components/configledger/ConfigLedger.tsx
"use client";

import React from "react";
import { TactileButton } from "../ui/TactileButton";
import { cn } from "../../lib/cn";

export type LedgerSection = {
  id: string;
  label: string;
  /** Live value summary shown under the section name in the rail. */
  summary: string;
  body: React.ReactNode;
};

/**
 * Two-pane "section ledger" shell shared by all five technique config panes.
 * Left rail lists every section with its current value always readable; the
 * body shows only the active section. Panes supply `sections`, own their state,
 * validation, and submit logic, and decide visibility before rendering the shell.
 */
export default function ConfigLedger({
  title,
  width = 660,
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
  width?: number;
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
      className="absolute left-0 top-[calc(100%+6px)] z-30 flex max-h-[min(584px,calc(100vh-100px))] animate-cfg-drop-in flex-col overflow-hidden rounded-[10px] border border-card-border bg-card shadow-[0_8px_32px_rgba(0,0,0,0.18)]"
      style={{ width, maxWidth: `min(${width}px, calc(100vw - 24px))` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-border px-4 py-3.5">
        <span className="flex items-center gap-2">
          {/* registration corner mark */}
          <span className="h-2 w-2 border-l border-t border-accent" aria-hidden />
          <span className="text-[13px] font-semibold tracking-[0.01em] text-foreground">{title}</span>
        </span>
        <button
          onClick={onClose}
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded border-none bg-transparent text-base leading-none text-muted transition-colors hover:bg-surface-border hover:text-foreground"
        >
          ×
        </button>
      </div>

      {/* Rail + body */}
      <div className="flex min-h-0 flex-1">
        {/* Section rail */}
        <div className="w-[228px] shrink-0 overflow-y-auto border-r border-surface-border">
          {sections.map((s, i) => {
            const isActive = s.id === active.id;
            return (
              <button
                key={s.id}
                onClick={() => onSectionChange(s.id)}
                className={cn(
                  "flex w-full flex-col gap-1 border-x-0 border-t-0 border-b border-l-2 border-surface-border px-3 py-[11px] text-left transition-colors",
                  isActive ? "border-l-accent bg-background" : "border-l-transparent bg-card hover:bg-surface-border/40",
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0",
                      isActive ? "bg-accent" : "border border-card-border",
                    )}
                    aria-hidden
                  />
                  <span className="flex-1 text-[11.5px] font-semibold text-foreground">{s.label}</span>
                  <span className="font-mono text-[9px] text-muted">{String(i + 1).padStart(2, "0")}</span>
                </span>
                <span className="ml-[14px] truncate font-mono text-[10px] text-muted">{s.summary}</span>
              </button>
            );
          })}
        </div>

        {/* Body — active section only */}
        <div className="min-w-0 flex-1 overflow-y-auto px-[18px] py-4">
          {active.body}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 border-t border-surface-border px-4 py-2.5">
        <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted">{footerSummary}</span>
        <TactileButton
          variant="primary"
          onClick={onRun}
          disabled={!canRun}
          faceClassName="px-4 justify-center py-2 text-[13px] tracking-[0.02em] disabled:cursor-not-allowed"
        >
          {runLabel}
        </TactileButton>
      </div>
    </div>
  );
}
