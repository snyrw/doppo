"use client";

import React from "react";

/** 6-dot grip SVG used as drag handle in every card header. */
export function CardDragHandle() {
  return (
    <svg
      width="8"
      height="12"
      viewBox="0 0 8 12"
      fill="none"
      style={{ opacity: 0.3, flexShrink: 0 }}
    >
      <circle cx="2" cy="2" r="1.2" fill="currentColor" />
      <circle cx="6" cy="2" r="1.2" fill="currentColor" />
      <circle cx="2" cy="6" r="1.2" fill="currentColor" />
      <circle cx="6" cy="6" r="1.2" fill="currentColor" />
      <circle cx="2" cy="10" r="1.2" fill="currentColor" />
      <circle cx="6" cy="10" r="1.2" fill="currentColor" />
    </svg>
  );
}

/**
 * Standard card loading state: spinner + stage text.
 *
 * - `stage`  — human-readable loading stage string to display
 * - `warmup` — when true, show the "First run warms the GPU container…" hint
 *
 * The GPU tier badge and elapsed-time counter are intentionally NOT included —
 * they appear above the spinner row and differ in position/context per card.
 */
export function CardLoadingState({
  stage,
  warmup,
}: {
  stage: string | undefined;
  warmup?: boolean;
}) {
  return (
    <>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            border: "2px solid var(--color-surface-border)",
            borderTopColor: "var(--color-accent)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: 0 }}>
          {stage ?? "Connecting to GPU…"}
        </p>
      </div>
      {warmup && (
        <p
          style={{
            fontSize: 10,
            color: "var(--color-text-muted)",
            margin: 0,
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          First run warms the GPU container — large models can take up to 2 min.
        </p>
      )}
    </>
  );
}

/** Red error message block shown when a card enters the "error" status. */
export function CardErrorState({
  message,
  showBuyCredits,
}: {
  message: string | undefined;
  showBuyCredits?: boolean;
}) {
  return (
    <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ fontSize: 11, color: "#dc2626", margin: 0 }}>
        ✗ {message ?? "Unknown error"}
      </p>
      {showBuyCredits && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => window.dispatchEvent(new CustomEvent("open-buy-credits"))}
          style={{
            alignSelf: "flex-start",
            fontSize: 11,
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid var(--color-card-border)",
            background: "var(--color-bg)",
            color: "var(--color-text)",
            cursor: "pointer",
            fontFamily: "var(--font-ibm-plex-sans), sans-serif",
          }}
        >
          Add credits →
        </button>
      )}
    </div>
  );
}

export function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
