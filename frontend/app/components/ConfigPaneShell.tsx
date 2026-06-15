"use client";

import React from "react";

/**
 * Shared chrome for the five technique config panes: the positioned dropdown
 * container, title header with close button, scrollable form body, and footer
 * Run button. Panes supply their form fields as children and keep their own
 * state, validation, and submit logic.
 *
 * The pane decides visibility (`if (!isOpen) return null`) before rendering
 * the shell, so the shell itself is always "open".
 */
export default function ConfigPaneShell({
  title,
  width = 380,
  canRun,
  runLabel,
  onRun,
  onClose,
  footerExtra,
  children,
}: {
  title: string;
  width?: number;
  canRun: boolean;
  runLabel: string;
  onRun: () => void;
  onClose: () => void;
  /** Optional content rendered to the left of the Run button (e.g. the lens top-k stepper). */
  footerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="absolute left-0 top-[calc(100%+6px)] z-30 flex max-h-[calc(100vh-100px)] animate-cfg-drop-in flex-col overflow-hidden rounded-lg border border-card-border bg-card shadow-[0_4px_16px_rgba(0,0,0,0.10)]"
      style={{ width, maxWidth: `min(${width}px, calc(100vw - 24px))` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-border px-4 pb-3 pt-3.5">
        <span className="text-[13px] font-semibold tracking-[0.01em] text-foreground">
          {title}
        </span>
        <button
          onClick={onClose}
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded border-none bg-transparent text-base leading-none text-muted transition-colors hover:bg-surface-border hover:text-foreground"
        >
          ×
        </button>
      </div>

      {/* Form body */}
      <div className="flex-1 overflow-y-auto p-4">
        {children}
      </div>

      {/* Footer */}
      <div className="border-t border-surface-border px-4 py-3">
        <div className="flex items-center gap-2">
          {footerExtra}
          <button
            onClick={onRun}
            disabled={!canRun}
            className="flex-1 cursor-pointer rounded-md border-none bg-accent py-2.5 text-[13px] font-semibold tracking-[0.02em] text-accent-fg transition-colors hover:enabled:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-border disabled:text-muted"
          >
            {runLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
