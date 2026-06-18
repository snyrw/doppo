"use client";

import React from "react";
import { TIER_LABELS } from "../lib/tiers";
import { ControlButton } from "./ui/ControlButton";

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
    <span className="rounded-[3px] border border-card-border bg-surface-border px-[5px] py-px text-[9px] font-semibold tracking-[0.06em] text-accent">
      {TIER_LABELS[tier] ?? tier}
    </span>
  );
}

/** Top row of a loading card body: GPU tier badge (left) + elapsed m:ss (right). */
export function CardLoadingHeader({ gpuTier, elapsedMs }: { gpuTier: string | undefined; elapsedMs: number }) {
  return (
    <div className="flex items-center justify-between">
      {gpuTier ? <TierBadge tier={gpuTier} /> : <span />}
      <span className="text-[10px] tabular-nums text-muted">
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
      className="shrink-0 opacity-30"
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
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <div className="h-5 w-5 animate-spinner rounded-full border-2 border-surface-border border-t-accent" />
        <p className="m-0 text-[11px] text-muted">
          {stage ?? "Connecting to GPU…"}
        </p>
      </div>
      {warmup && (
        <p className="m-0 text-center text-[10px] leading-normal text-muted">
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
  showVerifyCard,
}: {
  message: string | undefined;
  showBuyCredits?: boolean;
  showVerifyCard?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 px-3.5 py-3">
      <p className="m-0 text-[11px] text-red-600">
        ✗ {message ?? "Unknown error"}
      </p>
      {showBuyCredits && (
        <ControlButton
          onClick={() => window.dispatchEvent(new CustomEvent("open-buy-credits"))}
          className="self-start rounded-md bg-background px-2.5 py-1 text-[11px] text-foreground"
        >
          Add credits →
        </ControlButton>
      )}
      {showVerifyCard && (
        <ControlButton
          onClick={() => window.dispatchEvent(new CustomEvent("open-verify-card"))}
          className="self-start rounded-md bg-background px-2.5 py-1 text-[11px] text-foreground"
        >
          Add a card →
        </ControlButton>
      )}
    </div>
  );
}

export function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
