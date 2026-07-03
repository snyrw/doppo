"use client";

import React from "react";
import { cn } from "../lib/cn";
import { formatGb, phaseOf, stageText, type LoadingPhase, type LoadingStage } from "../lib/loading-stage";
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
      <span className="font-mono text-[10px] tabular-nums text-muted">
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

const PHASE_TITLES = ["GPU requested", "Loading model", "Computing"] as const;

const EMPTY_STAGE: LoadingStage = { stage: null, stageAgeS: null, progress: null };

/**
 * Standard card loading state: three-phase timeline (GPU requested → Loading
 * model → Computing), driven by the raw backend stage key.
 *
 * - `stage`  — the card's LoadingStage from CARD_STAGE polling
 * - `labels` — per-card copy overrides by raw stage key (see stageText)
 *
 * The GPU tier badge and elapsed-time counter are intentionally NOT included —
 * they appear above the timeline and differ in position/context per card.
 */
export function CardLoadingState({
  stage,
  labels,
}: {
  stage: LoadingStage | undefined;
  labels?: Record<string, string>;
}) {
  const ls = stage ?? EMPTY_STAGE;
  const phase = phaseOf(ls.stage);
  return (
    <>
      <div className="flex flex-1 flex-col justify-center gap-1.5 px-4 py-2">
        {PHASE_TITLES.map((title, i) => {
          const n = (i + 1) as LoadingPhase;
          const state = n < phase ? "done" : n === phase ? "active" : "pending";
          return (
            <div key={title} className="flex flex-col gap-0.5">
              <div
                className={cn(
                  "flex items-center gap-2 text-[11px]",
                  state === "active" ? "text-foreground" : "text-muted",
                  state === "pending" && "opacity-40"
                )}
              >
                {state === "done" ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
                    <path d="M3 7.5L6 10.5L11 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : state === "active" ? (
                  <div className="h-3.5 w-3.5 shrink-0 animate-spinner rounded-full border-2 border-surface-border border-t-accent" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
                    <circle cx="7" cy="7" r="2.5" fill="currentColor" opacity="0.35" />
                  </svg>
                )}
                <span>{title}</span>
                {state === "active" && n === 2 && ls.progress && (
                  <span className="ml-auto font-mono text-[10px] tabular-nums text-muted">
                    {formatGb(ls.progress.doneBytes)}
                    {ls.progress.totalBytes !== null && ` / ${formatGb(ls.progress.totalBytes)}`} GB
                  </span>
                )}
              </div>
              {state === "active" && (
                <p className="m-0 pl-[22px] text-[10px] leading-normal text-muted">
                  {stageText(ls, labels)}
                </p>
              )}
            </div>
          );
        })}
      </div>
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
