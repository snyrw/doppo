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
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        left: 0,
        width,
        maxWidth: `min(${width}px, calc(100vw - 24px))`,
        maxHeight: "calc(100vh - 100px)",
        zIndex: 30,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--color-card)",
        border: "1px solid var(--color-card-border)",
        borderRadius: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
        animation: "cfgDropIn 140ms ease-out",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px 12px",
          borderBottom: "1px solid var(--color-surface-border)",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)", letterSpacing: "0.01em" }}>
          {title}
        </span>
        <button
          onClick={onClose}
          style={{
            width: 24,
            height: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 4,
            border: "none",
            background: "transparent",
            color: "var(--color-text-muted)",
            cursor: "pointer",
            fontSize: 16,
            lineHeight: 1,
            transition: "background 120ms, color 120ms",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--color-surface-border)"; e.currentTarget.style.color = "var(--color-text)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--color-text-muted)"; }}
        >
          ×
        </button>
      </div>

      {/* Form body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {children}
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--color-surface-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {footerExtra}
          <button
            onClick={onRun}
            disabled={!canRun}
            style={{
              flex: 1,
              padding: "10px 0",
              borderRadius: 6,
              border: "none",
              background: !canRun ? "var(--color-surface-border)" : "var(--color-accent)",
              color: !canRun ? "var(--color-text-muted)" : "var(--color-accent-fg)",
              fontSize: 13,
              fontWeight: 600,
              cursor: !canRun ? "not-allowed" : "pointer",
              letterSpacing: "0.02em",
              transition: "background 150ms",
            }}
            onMouseEnter={e => { if (canRun) e.currentTarget.style.background = "var(--color-accent-hover)"; }}
            onMouseLeave={e => { if (canRun) e.currentTarget.style.background = "var(--color-accent)"; }}
          >
            {runLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
