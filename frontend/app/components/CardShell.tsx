"use client";

import React from "react";
import {
  BAND_GAP,
  CARD_BODY_PAD,
  CARD_INNER_RADIUS,
  CARD_INSET,
  CARD_MAX_H,
  CARD_MAX_W,
  CARD_MIN_W,
  CARD_RADIUS,
  STRIP_SEGMENT_RADIUS,
} from "./card-geometry";
import { cn } from "../lib/cn";
import { formatGb, phaseOf, stageText, type LoadingPhase, type LoadingStage } from "../lib/loading-stage";
import { BAND_INK } from "../lib/techniques";
import { TIER_LABELS } from "../lib/tiers";
import { CloseButton } from "./ui/CloseButton";
import { ControlButton } from "./ui/ControlButton";
import { CLOSE_HIT, CLOSE_GUTTER } from "./ui/control-metrics";

/* Card chrome, shared by every card type.

   Only what all six cards share lives here. The lens mode switcher, attention
   pager, patching side-nav and DLA bar table are in their respective files. */

/* The frame's numbers live in card-geometry.ts.. Re-exported here because every card component
   already imports card geometry from CardShell and there is no reason to make
   them learn a second module. */
export { CARD_BODY_PAD, CARD_INSET, CARD_MAX_H, CARD_MAX_W, CARD_MIN_W, STRIP_SEGMENT_RADIUS };

/**
 * Positioned card shell — shape, border, stacking order, nothing else. Each
 * card type composes its own body inside. Cards sit flat on the canvas: no
 * shadow, so the border alone carries the edge.
 *
 * `width` is for cards that size to their data; omit to sit at CARD_MIN_W.
 * `elevated` lifts a card whose popover or side panel must clear its neighbors.
 * `uncappedHeight` opts out of CARD_MAX_H, for a card that must never scroll.
 */
export function CardFrame({
  cardId,
  position,
  width,
  elevated,
  uncappedHeight,
  ref,
  className,
  children,
}: {
  cardId: string;
  position: { x: number; y: number };
  width?: number;
  elevated?: boolean;
  uncappedHeight?: boolean;
  ref?: React.Ref<HTMLDivElement>;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={ref}
      data-card-id={cardId}
      className={cn(
        "absolute flex flex-col border border-card-border bg-card",
        elevated ? "z-20" : "z-10",
        className,
      )}
      style={{
        left: position.x,
        top: position.y,
        borderRadius: CARD_RADIUS,
        width: width ?? CARD_MIN_W,
        maxHeight: uncappedHeight ? undefined : CARD_MAX_H,
      }}
    >
      {children}
    </div>
  );
}

export function CardScrollArea({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      onWheel={e => {
        const el = e.currentTarget;
        if (el.scrollHeight > el.clientHeight) e.stopPropagation();
      }}
      className={cn("min-h-0 flex-1 overflow-y-auto overflow-x-hidden", className)}
      style={{
        borderBottomLeftRadius: CARD_INNER_RADIUS,
        borderBottomRightRadius: CARD_INNER_RADIUS,
      }}
    >
      {children}
    </div>
  );
}

const MODEL_LINE_CENTRE_Y = 23;

export function CardCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <div
      className="absolute z-10"
      style={{ right: CARD_INSET, top: MODEL_LINE_CENTRE_Y - CLOSE_HIT / 2 }}
    >
      <CloseButton onClick={onClick} label="Remove card" stopPointerDown />
    </div>
  );
}

export function CardHeader({
  modelName,
  prompt,
  subPrompt,
}: {
  modelName: string;
  prompt: string;
  subPrompt?: string;
}) {
  return (
    <div className="flex min-w-0 shrink-0 pt-4" style={{ paddingInline: CARD_INSET }}>
      <div className="min-w-0 flex-1" style={{ paddingRight: CLOSE_GUTTER }}>
        <p className="m-0 truncate text-[11px] leading-[14px] text-muted">
          Model: {modelName}
        </p>
        <p className="m-0 mt-0.5 truncate text-[14px] leading-[18px] text-foreground">
          {prompt}
        </p>
        {subPrompt && (
          /* The counterfactual is attribution's defining input, so it stays
             visible at rest rather than moving to a tooltip. `∼` marks it as the
             corrupted twin of the line above. */
          <p className="m-0 truncate text-[11px] leading-[14px] text-muted" title={subPrompt}>
            <span className="opacity-60">∼ </span>{subPrompt}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Fixed-height row under the header, which differ by card a bit.
 */
export function CardBand({
  info,
  children,
  className,
}: {
  info?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("mt-1 flex h-[18px] shrink-0 items-stretch", className)}
      style={{ paddingInline: CARD_INSET, gap: BAND_GAP }}
    >
      {info}
      {children}
    </div>
  );
}

/**
 * One chip in a CardBand.
 */
export function BandChip({
  fill,
  className,
  children,
}: {
  fill?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center justify-center px-2 text-[10px] leading-none",
        !fill && "bg-surface-border text-foreground",
        className,
      )}
      style={fill ? { backgroundColor: fill, color: BAND_INK } : undefined}
    >
      {children}
    </div>
  );
}

/**
 * Lens's mode strip, sized to its content instead of filling the band.
 */
export function ViewStrip<T extends string>({
  views, labels, view, onChange,
}: {
  views: readonly T[];
  labels: Record<T, string>;
  view: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex h-full shrink-0 items-stretch bg-surface-border">
      {views.map(v => {
        const isActive = v === view;
        return (
          <button
            key={v}
            onPointerDown={e => e.stopPropagation()}
            onClick={() => onChange(v)}
            className={cn(
              "cursor-pointer border-none px-2 text-[10px] leading-none transition-colors",
              isActive ? "bg-background text-foreground" : "bg-transparent text-muted",
            )}
            style={{ borderRadius: STRIP_SEGMENT_RADIUS }}
          >
            {labels[v]}
          </button>
        );
      })}
    </div>
  );
}

/** Rule closing off the chrome, above the card body. */
export function CardRule() {
  return <div className="mt-1.5 h-px shrink-0 bg-card-border" style={{ marginInline: CARD_INSET }} />;
}

/**
 * Data area below the rule, for a card that shows all of its data at once.
 */
export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("shrink-0", className)} style={{ padding: CARD_BODY_PAD }}>
      {children}
    </div>
  );
}

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
    <span className="rounded-[var(--ctl-radius-xs)] border border-card-border bg-surface-border px-[5px] py-px text-[9px] font-semibold tracking-[0.06em] text-accent">
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
          className="self-start bg-background px-2.5 py-1 text-[11px] text-foreground"
        >
          Add balance →
        </ControlButton>
      )}
      {showVerifyCard && (
        <ControlButton
          onClick={() => window.dispatchEvent(new CustomEvent("open-verify-card"))}
          className="self-start bg-background px-2.5 py-1 text-[11px] text-foreground"
        >
          Add a card →
        </ControlButton>
      )}
    </div>
  );
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
