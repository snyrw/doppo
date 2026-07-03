"use client";

import React from "react";
import { CardDragHandle, CardLoadingState, CardErrorState, CardLoadingHeader, TierBadge, useElapsedMs } from "./CardShell";
import { DivergingBar } from "./DivergingBar";
import { useDivergingPalette } from "../hooks/usePalette";
import { HoverTooltip, type TooltipState } from "../lib/tooltip";
import type { LoadingStage } from "../lib/loading-stage";

export type VerifiedComponent = {
  layer: number;
  head: number;
  component_type: string;
  attribution_score: number;
  actual_effect: number;
};

export type ActivationPatchResult = {
  total_diff: number;
  components: VerifiedComponent[];
};

export type ActivationCardData = {
  id: string;
  cardType: "activation";
  status: "loading" | "result" | "error";
  modelName: string;
  cleanPrompt: string;
  k: number;
  parentAttributionId: string;
  data: ActivationPatchResult | null;
  error: string | null;
  showBuyCredits?: boolean;
  showVerifyCard?: boolean;
  position: { x: number; y: number };
  gpuTier?: string;
  startedAt?: number;
  loadingStage?: LoadingStage;
};

type ActivationCardProps = {
  card: ActivationCardData;
  ref?: React.Ref<HTMLDivElement>;
  onStartDrag: (e: React.PointerEvent<HTMLDivElement>, cardId: string, pos: { x: number; y: number }) => void;
  onDragMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDragEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
  onRemove: (id: string) => void;
  tutorialMode?: boolean;
};

const STAGE_LABELS: Record<string, string> = {
  preparing: "Caching clean activations…",
  computing_effects: "Normalizing effects…",
  patching: "Verifying component {i} of {n}…",
};

function componentLabel(comp: VerifiedComponent): string {
  return comp.component_type === "attn_head" ? `L${comp.layer}·H${comp.head}` : `L${comp.layer}·MLP`;
}

/** Components where predicted (attribution_score) and verified (actual_effect) agree
 * on sign — the only agreement claim that holds up at k≈10 with possible near-zero
 * ties; a correlation coefficient over this few points is not a meaningful statistic. */
function signAgreement(components: VerifiedComponent[]): { agree: number; total: number } {
  let agree = 0;
  for (const c of components) {
    if (Math.sign(c.attribution_score) === Math.sign(c.actual_effect)) agree++;
  }
  return { agree, total: components.length };
}

function ActivationCard({
  card,
  ref,
  onStartDrag,
  onDragMove,
  onDragEnd,
  onRemove,
  tutorialMode,
}: ActivationCardProps) {
  const elapsedMs = useElapsedMs(card.status, card.startedAt);
  const [headerHovered, setHeaderHovered] = React.useState(false);
  const [tooltip, setTooltip] = React.useState<TooltipState>(null);
  const palette = useDivergingPalette();

  const agreement = React.useMemo(() => {
    if (!card.data || card.data.components.length === 0) return null;
    return signAgreement(card.data.components);
  }, [card.data]);

  const attrAbsMax = React.useMemo(() => {
    if (!card.data) return 1;
    return Math.max(1e-9, ...card.data.components.map(c => Math.abs(c.attribution_score)));
  }, [card.data]);

  const effectAbsMax = React.useMemo(() => {
    if (!card.data) return 1;
    return Math.max(1e-9, ...card.data.components.map(c => Math.abs(c.actual_effect)));
  }, [card.data]);

  return (
    <div
      ref={ref}
      data-card-id={card.id}
      className="absolute z-10 flex w-80 flex-col rounded-lg border border-card-border bg-card shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
      style={{ left: card.position.x, top: card.position.y }}
    >

      {/* Hover popup */}
      {headerHovered && (
        <div className="pointer-events-none absolute bottom-[calc(100%+6px)] left-0 z-[100] min-w-[200px] max-w-[300px] rounded-lg border border-card-border bg-card px-3 py-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
          <p className="m-0 break-all text-[11px] font-semibold text-foreground">
            {card.modelName}
          </p>
          <p className="m-0 mt-[5px] break-words text-[10px] leading-[1.5] text-muted">
            {card.cleanPrompt}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {card.gpuTier && <TierBadge tier={card.gpuTier} />}
            <span className="rounded-[3px] border border-card-border bg-surface-border px-[5px] py-px text-[9px] font-semibold tracking-[0.06em] text-accent">
              Activation Patch
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
          Activation Patch
        </span>
        <span className="min-w-0 flex-1 truncate text-[10px] text-muted">
          top {card.k}
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

      {/* Loading */}
      {card.status === "loading" && (
        <div className="flex min-h-[110px] flex-col gap-2.5 px-3.5 py-3">
          <CardLoadingHeader gpuTier={card.gpuTier} elapsedMs={elapsedMs} />
          <CardLoadingState stage={card.loadingStage} labels={STAGE_LABELS} />
        </div>
      )}

      {/* Error */}
      {card.status === "error" && <CardErrorState message={card.error ?? undefined} showBuyCredits={card.showBuyCredits} showVerifyCard={card.showVerifyCard} />}

      {/* Result */}
      {card.status === "result" && card.data && (
        <>
          {/* Column headers */}
          {/* borderLeft matches the 3px selection border on rows so columns line up */}
          <div className="flex items-center gap-1.5 border-b border-l-[3px] border-surface-border border-l-transparent px-2.5 pb-1 pt-1.5">
            <span className="w-16 shrink-0 overflow-hidden whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.06em] text-muted">Component</span>
            <span className="flex-1 text-[9px] font-semibold uppercase tracking-[0.06em] text-muted">Attribution</span>
            <span className="flex-1 text-[9px] font-semibold uppercase tracking-[0.06em] text-muted">Effect</span>
          </div>

          {/* Rows */}
          <div className="overflow-y-auto overflow-x-hidden bg-card">
            {card.data.components.map((comp, i) => {
              const label = componentLabel(comp);
              const tooltipContent = (
                <>
                  <div className="mb-[3px] font-semibold">{label}</div>
                  <div className="flex flex-col gap-0.5 font-mono tabular-nums">
                    <div className="flex justify-between gap-3.5">
                      <span className="text-muted">attr</span>
                      <span>{comp.attribution_score >= 0 ? "+" : ""}{comp.attribution_score.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between gap-3.5">
                      <span className="text-muted">effect</span>
                      <span>{(comp.actual_effect * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </>
              );

              return (
                <div
                  key={i}
                  onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, content: tooltipContent })}
                  onMouseLeave={() => setTooltip(null)}
                  className="flex items-center gap-1.5 border-b border-l-[3px] border-surface-border border-l-transparent px-2.5 py-[5px]"
                >
                  {/* Component label */}
                  <span className="w-16 shrink-0 truncate font-mono text-[9px] font-semibold text-foreground">
                    {label}
                  </span>

                  {/* Attribution bar */}
                  <div className="min-w-0 flex-1">
                    <DivergingBar val={comp.attribution_score} absMax={attrAbsMax} palette={palette} width="100%" height={8} />
                  </div>

                  {/* Effect: bar + signed number */}
                  <div className="flex min-w-0 flex-1 items-center gap-1">
                    <div className="min-w-0 flex-1">
                      <DivergingBar val={comp.actual_effect} absMax={effectAbsMax} palette={palette} width="100%" height={8} />
                    </div>
                    <span className="w-11 shrink-0 text-right font-mono text-[9px] tabular-nums text-foreground">
                      {comp.actual_effect >= 0 ? "+" : "−"}{(Math.abs(comp.actual_effect) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer: sign agreement between predicted attribution and verified effect */}
          {agreement !== null && (
            <div className="border-t border-surface-border px-2.5 py-[7px]">
              <span className="text-[9px] text-muted">
                sign agreement: {agreement.agree}/{agreement.total} components
              </span>
            </div>
          )}
        </>
      )}
      {tooltip && <HoverTooltip x={tooltip.x} y={tooltip.y}>{tooltip.content}</HoverTooltip>}
    </div>
  );
}

export default React.memo(ActivationCard);
