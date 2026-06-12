"use client";

import React from "react";
import { TIER_LABELS } from "../lib/tiers";

/** Ticks once per second while `status` is "loading"; returns elapsed ms since `startedAt`. */
export function useElapsedMs(status: "loading" | "result" | "error", startedAt: number | undefined): number {
  const [elapsedMs, setElapsedMs] = React.useState(0);
  React.useEffect(() => {
    if (status !== "loading") return;
    const start = startedAt ?? Date.now();
    setElapsedMs(Date.now() - start);
    const id = setInterval(() => setElapsedMs(Date.now() - start), 1000);
    return () => clearInterval(id);
  }, [status, startedAt]);
  return elapsedMs;
}

/** Maps a backend loadingStage to display text, with the shared cold-start fallback. */
export function stageLabel(stage: string | undefined, elapsedMs: number, labels: Record<string, string>): string {
  if (stage !== undefined && labels[stage]) return labels[stage];
  return elapsedMs > 30_000 ? "GPU container is starting…" : "Connecting to GPU…";
}

/** Small GPU-tier pill (e.g. "L4"); renders nothing without a tier. */
export function TierBadge({ tier }: { tier: string | undefined }) {
  if (!tier) return null;
  return (
    <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", color: "var(--color-accent)", background: "var(--color-surface-border)", border: "1px solid var(--color-card-border)", borderRadius: 3, padding: "1px 5px" }}>
      {TIER_LABELS[tier] ?? tier}
    </span>
  );
}

/** Top row of a loading card body: GPU tier badge (left) + elapsed m:ss (right). */
export function CardLoadingHeader({ gpuTier, elapsedMs }: { gpuTier: string | undefined; elapsedMs: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      {gpuTier ? <TierBadge tier={gpuTier} /> : <span />}
      <span style={{ fontSize: 10, color: "var(--color-text-muted)", fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontVariantNumeric: "tabular-nums" }}>
        {formatElapsed(elapsedMs)}
      </span>
    </div>
  );
}

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
