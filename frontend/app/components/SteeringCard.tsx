"use client";

import React from "react";
import { CardDragHandle, CardErrorState, CardLoadingHeader, TierBadge, useElapsedMs } from "./CardShell";
import { cn } from "../lib/cn";

export type SteeringComponent = {
  layer: number;
  head: number | null;
  injectionType: "attn_head" | "mlp" | "residual";
};

export type SteeringResult = {
  steered_text: string;
  baseline_text: string;
  top_k_steered: Array<{ token: string; prob: number }>;
  top_k_baseline: Array<{ token: string; prob: number }>;
  logit_diff: number;
};

export type SteeringCardData = {
  id: string;
  cardType: "steering";
  status: "loading" | "result" | "error";
  modelName: string;
  cleanPrompt: string;
  corruptedPrompt: string;
  generationPrompt?: string;
  targetPosition: number | "last";
  targetToken: string | null;
  components: SteeringComponent[];
  alpha: number;
  temperature: number;
  repetitionPenalty: number;
  nTokens: number;
  nPairs: number;
  extraPairs?: Array<{ clean: string; corrupted: string }>;
  parentCardId: string;
  data: SteeringResult | null;
  error: string | null;
  showBuyCredits?: boolean;
  showVerifyCard?: boolean;
  position: { x: number; y: number };
  gpuTier?: string;
  startedAt?: number;
  loadingStage?: string;
};

type SteeringCardProps = {
  card: SteeringCardData;
  ref?: React.Ref<HTMLDivElement>;
  onStartDrag: (e: React.PointerEvent<HTMLDivElement>, cardId: string, pos: { x: number; y: number }) => void;
  onDragMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDragEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
  onRemove: (id: string) => void;
  onRerun: (cardId: string, newAlpha: number) => void;
  tutorialMode?: boolean;
};

function componentLabel(c: SteeringComponent): string {
  if (c.injectionType === "attn_head" && c.head !== null) return `L${c.layer}·H${c.head}`;
  if (c.injectionType === "mlp") return `L${c.layer}·MLP`;
  return `L${c.layer}·residual`;
}

function SteeringCard({
  card,
  ref,
  onStartDrag,
  onDragMove,
  onDragEnd,
  onRemove,
  onRerun,
  tutorialMode,
}: SteeringCardProps) {
  const elapsedMs = useElapsedMs(card.status, card.startedAt);
  const [headerHovered, setHeaderHovered] = React.useState(false);
  const [localAlpha, setLocalAlpha] = React.useState(card.alpha);

  // Sync local alpha if the card is re-run externally (alpha stored in card updates).
  React.useEffect(() => { setLocalAlpha(card.alpha); }, [card.alpha]);

  const logitDiffStr = card.data
    ? (card.data.logit_diff >= 0 ? "+" : "") + card.data.logit_diff.toFixed(2)
    : null;

  return (
    <div
      ref={ref}
      data-card-id={card.id}
      className="absolute z-10 flex w-90 flex-col rounded-lg border border-card-border bg-card shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
      style={{ left: card.position.x, top: card.position.y }}
    >

      {/* Hover popup */}
      {headerHovered && (
        <div className="pointer-events-none absolute bottom-[calc(100%+6px)] left-0 z-[100] min-w-[200px] max-w-[320px] rounded-lg border border-card-border bg-card px-3 py-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
          <p className="m-0 break-all text-[11px] font-semibold text-foreground">
            {card.modelName}
          </p>
          <p className="mb-[3px] mt-2 text-[9px] font-semibold uppercase tracking-[0.06em] text-muted">
            DIM pair
          </p>
          <p className="m-0 break-words text-[10px] leading-[1.5] text-muted">
            clean: {card.cleanPrompt}
          </p>
          <p className="m-0 mt-[3px] break-words text-[10px] leading-[1.5] text-muted">
            corrupted: {card.corruptedPrompt}
          </p>
          <p className="mb-[3px] mt-2 text-[9px] font-semibold uppercase tracking-[0.06em] text-muted">
            generation prompt
          </p>
          <p className="m-0 break-words text-[10px] leading-[1.5] text-foreground">
            {card.generationPrompt && card.generationPrompt.trim() !== "" ? card.generationPrompt : <span className="italic text-muted">↳ defaults to clean prompt</span>}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {card.gpuTier && <TierBadge tier={card.gpuTier} />}
            <span className="rounded-[3px] border border-card-border bg-surface-border px-[5px] py-px text-[9px] font-semibold tracking-[0.06em] text-accent">
              Steering
            </span>
            <span className="rounded-[3px] border border-card-border bg-surface-border px-[5px] py-px text-[9px] text-muted">
              T={card.temperature.toFixed(1)}  rep={card.repetitionPenalty.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <div
        onPointerDown={e => onStartDrag(e, card.id, card.position)}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onMouseEnter={() => setHeaderHovered(true)}
        onMouseLeave={() => setHeaderHovered(false)}
        className="flex shrink-0 cursor-grab select-none items-center gap-1.5 rounded-t-lg border-b border-surface-border px-2.5 py-[7px]"
      >
        <CardDragHandle />
        <span className="shrink-0 text-[11px] font-semibold text-foreground">
          Steering
        </span>
        {card.nPairs > 1 && (
          <span className="shrink-0 rounded-[3px] border border-card-border bg-surface-border px-[5px] py-px text-[9px] font-semibold tracking-[0.05em] text-accent">
            {card.nPairs}p
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-[10px] text-muted">
          {card.components.map(componentLabel).join(" + ") || "residual"}
        </span>
        {!tutorialMode && (
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={() => onRemove(card.id)}
            className="shrink-0 cursor-pointer border-none bg-transparent px-0.5 text-xs leading-none text-muted"
          >
            ×
          </button>
        )}
      </div>

      {/* Injection info + alpha slider row */}
      <div
        onPointerDown={e => e.stopPropagation()}
        className="flex flex-wrap items-center gap-1.5 border-b border-surface-border px-2.5 py-[5px]"
      >
        {card.components.map((c, i) => (
          <span
            key={i}
            className="shrink-0 rounded-[3px] border border-card-border bg-surface-border px-[5px] py-px text-[9px] font-semibold text-accent"
          >
            {componentLabel(c)}
          </span>
        ))}
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <span className="w-9 text-right text-[9px] text-muted">
            α={localAlpha >= 0 ? localAlpha.toFixed(2) : localAlpha.toFixed(2)}
          </span>
          <input
            type="range"
            min={-50} max={50} step={1}
            value={localAlpha}
            disabled={tutorialMode}
            onChange={e => setLocalAlpha(parseFloat(e.target.value))}
            className="w-20 cursor-pointer accent-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
          />
          {!tutorialMode && card.status !== "loading" && localAlpha !== card.alpha && (
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={() => onRerun(card.id, localAlpha)}
              className="cursor-pointer whitespace-nowrap chamfer [--c:3px] border-none bg-accent px-[7px] py-0.5 text-[9px] font-semibold text-accent-fg transition-transform active:translate-y-px"
            >
              Re-run →
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {card.status === "loading" && (
        <div className="flex flex-col gap-2 px-3 py-2.5">
          <CardLoadingHeader gpuTier={card.gpuTier} elapsedMs={elapsedMs} />
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 shrink-0 animate-spinner rounded-full border-2 border-surface-border border-t-accent" />
            <p className="m-0 text-[11px] text-muted">
              {card.loadingStage === "computing" ? "Computing DIM vectors…" : "Generating…"}
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {card.status === "error" && <CardErrorState message={card.error ?? undefined} showBuyCredits={card.showBuyCredits} showVerifyCard={card.showVerifyCard} />}

      {/* Result */}
      {card.status === "result" && card.data && (
        <div onPointerDown={e => e.stopPropagation()} className="flex flex-col">
          {/* Steered text */}
          <div className="px-2.5 pb-1 pt-2">
            <p className="m-0 mb-1 text-[9px] font-semibold uppercase tracking-[0.06em] text-muted">
              Steered
            </p>
            <div className="max-h-[100px] overflow-y-auto whitespace-pre-wrap break-words rounded border border-surface-border bg-card px-2 py-1.5 text-[11px] leading-[1.6] text-foreground">
              {card.data.steered_text}
            </div>
          </div>

          {/* Baseline text */}
          <div className="px-2.5 pb-2 pt-1">
            <p className="m-0 mb-1 text-[9px] font-semibold uppercase tracking-[0.06em] text-muted">
              Baseline
            </p>
            <div className="max-h-[100px] overflow-y-auto whitespace-pre-wrap break-words rounded border border-surface-border bg-card px-2 py-1.5 text-[11px] leading-[1.6] text-muted">
              {card.data.baseline_text}
            </div>
          </div>

          <div className="border-t border-surface-border" />

          {/* Next-token comparison */}
          <div className="px-2.5 py-2">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="m-0 text-[9px] font-semibold uppercase tracking-[0.06em] text-muted">
                Next token
              </p>
              <span
                className={cn(
                  "rounded-[3px] border px-[5px] py-px text-[9px] font-semibold",
                  card.data.logit_diff >= 0
                    ? "border-[rgba(22,163,74,0.25)] bg-[rgba(22,163,74,0.08)] text-green-600"
                    : "border-[rgba(220,38,38,0.25)] bg-[rgba(220,38,38,0.08)] text-red-600",
                )}
              >
                Δ logit {logitDiffStr}
              </span>
            </div>

            {/* Two-column token table */}
            <div className="grid grid-cols-2 gap-2">
              {/* Steered column */}
              <div>
                <p className="m-0 mb-1 text-[8px] font-semibold uppercase tracking-[0.06em] text-muted">
                  Steered
                </p>
                {card.data.top_k_steered.map((t, i) => (
                  <div key={i} className="mb-[3px] flex items-center gap-1">
                    <span className="w-[60px] shrink-0 truncate text-[9px] text-foreground">
                      {JSON.stringify(t.token)}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-surface-border">
                      <div className="h-full rounded-sm bg-accent opacity-80" style={{ width: `${t.prob * 100}%` }} />
                    </div>
                    <span className="w-[26px] shrink-0 text-right text-[8px] text-muted">
                      {(t.prob * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>

              {/* Baseline column */}
              <div>
                <p className="m-0 mb-1 text-[8px] font-semibold uppercase tracking-[0.06em] text-muted">
                  Baseline
                </p>
                {card.data.top_k_baseline.map((t, i) => (
                  <div key={i} className="mb-[3px] flex items-center gap-1">
                    <span className="w-[60px] shrink-0 truncate text-[9px] text-muted">
                      {JSON.stringify(t.token)}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-surface-border">
                      <div className="h-full rounded-sm bg-muted opacity-50" style={{ width: `${t.prob * 100}%` }} />
                    </div>
                    <span className="w-[26px] shrink-0 text-right text-[8px] text-muted">
                      {(t.prob * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(SteeringCard);
