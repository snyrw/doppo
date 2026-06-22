"use client";

import React from "react";
import { interpolateColorDivergent } from "../lib/palette";
import type { SteeringComponent } from "./SteeringCard";
import { CardDragHandle, CardLoadingState, CardErrorState, CardLoadingHeader, TierBadge, useElapsedMs } from "./CardShell";
import { cn } from "../lib/cn";
import { HoverTooltip, type TooltipState } from "../lib/tooltip";

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
  loadingStage?: string;
};

type ActivationCardProps = {
  card: ActivationCardData;
  ref?: React.Ref<HTMLDivElement>;
  onStartDrag: (e: React.PointerEvent<HTMLDivElement>, cardId: string, pos: { x: number; y: number }) => void;
  onDragMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDragEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
  onRemove: (id: string) => void;
  onSteerComponents: (cardId: string, components: SteeringComponent[]) => void;
  tutorialMode?: boolean;
};

function getStageLabel(stage: string | undefined, elapsedMs: number): string {
  if (!stage) return elapsedMs > 30_000 ? "GPU container is starting…" : "Connecting to GPU…";
  if (stage.startsWith("patching_")) {
    const match = stage.match(/patching_(\d+)_of_(\d+)/);
    if (match) return `Verifying component ${match[1]} of ${match[2]}`;
  }
  const labels: Record<string, string> = {
    tokenizing: "Tokenizing…",
    preparing: "Caching clean activations",
    computing_effects: "Normalizing effects",
  };
  return labels[stage] ?? "Processing…";
}

function matchLabel(effect: number): { text: string; color: string; bg: string; border: string } {
  if (effect < 0) return { text: "Counter", color: "#9333ea", bg: "rgba(147,51,234,0.08)", border: "rgba(147,51,234,0.25)" };
  if (effect > 0.7) return { text: "High", color: "#16a34a", bg: "rgba(22,163,74,0.08)", border: "rgba(22,163,74,0.25)" };
  if (effect > 0.3) return { text: "Mid", color: "#d97706", bg: "rgba(217,119,6,0.08)", border: "rgba(217,119,6,0.25)" };
  return { text: "Low", color: "#dc2626", bg: "rgba(220,38,38,0.08)", border: "rgba(220,38,38,0.25)" };
}

function spearmanCorrelation(xs: number[], ys: number[]): number {
  if (xs.length < 2) return 0;
  const rank = (arr: number[]) => {
    const sorted = [...arr].map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
    const ranks = new Array(arr.length);
    sorted.forEach(({ i }, r) => { ranks[i] = r + 1; });
    return ranks;
  };
  const rx = rank(xs);
  const ry = rank(ys);
  const n = xs.length;
  const d2 = rx.reduce((s, r, i) => s + (r - ry[i]) ** 2, 0);
  return 1 - (6 * d2) / (n * (n * n - 1));
}

function ActivationCard({
  card,
  ref,
  onStartDrag,
  onDragMove,
  onDragEnd,
  onRemove,
  onSteerComponents,
  tutorialMode,
}: ActivationCardProps) {
  const elapsedMs = useElapsedMs(card.status, card.startedAt);
  const [headerHovered, setHeaderHovered] = React.useState(false);
  const [selectedComponents, setSelectedComponents] = React.useState<SteeringComponent[]>([]);
  const [tooltip, setTooltip] = React.useState<TooltipState>(null);

  const spearman = React.useMemo(() => {
    if (!card.data) return null;
    const { components } = card.data;
    if (components.length < 2) return null;
    return spearmanCorrelation(
      components.map(c => c.attribution_score),
      components.map(c => c.actual_effect)
    );
  }, [card.data]);

  const attrAbsMax = React.useMemo(() => {
    if (!card.data) return 1;
    return Math.max(1e-9, ...card.data.components.map(c => Math.abs(c.attribution_score)));
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
          <CardLoadingState stage={getStageLabel(card.loadingStage, elapsedMs)} />
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
            <span className="w-[52px] shrink-0 text-right text-[9px] font-semibold uppercase tracking-[0.06em] text-muted">Match</span>
          </div>

          {/* Rows */}
          <div className="overflow-y-auto overflow-x-hidden bg-card">
            {card.data.components.map((comp, i) => {
              const match = matchLabel(comp.actual_effect);
              const attrColor = interpolateColorDivergent("rdbu", comp.attribution_score, attrAbsMax);
              const attrFrac = Math.abs(comp.attribution_score) / attrAbsMax;
              const effectFrac = Math.min(1, Math.abs(comp.actual_effect));
              const effectColor = comp.actual_effect < 0 ? "#9333ea" : "#16a34a";
              const label = comp.component_type === "attn_head"
                ? `L${comp.layer}·H${comp.head}`
                : `L${comp.layer}·MLP`;
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

              const steeringComp: SteeringComponent = {
                layer: comp.layer,
                head: comp.component_type === "attn_head" ? comp.head : null,
                injectionType: comp.component_type === "attn_head" ? "attn_head" : "mlp",
              };
              const isSelected = selectedComponents.some(
                c => c.layer === steeringComp.layer && c.head === steeringComp.head && c.injectionType === steeringComp.injectionType
              );

              return (
                <div
                  key={i}
                  onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, content: tooltipContent })}
                  onMouseLeave={() => setTooltip(null)}
                  onPointerDown={e => e.stopPropagation()}
                  onClick={tutorialMode ? undefined : () => setSelectedComponents(prev =>
                    isSelected
                      ? prev.filter(c => !(c.layer === steeringComp.layer && c.head === steeringComp.head && c.injectionType === steeringComp.injectionType))
                      : [...prev, steeringComp]
                  )}
                  className={cn(
                    "flex cursor-pointer items-center gap-1.5 border-b border-l-[3px] border-surface-border px-2.5 py-[5px] transition-colors",
                    isSelected ? "border-l-accent" : "border-l-transparent",
                  )}
                >
                  {/* Component label */}
                  <span className="w-16 shrink-0 truncate font-mono text-[9px] font-semibold text-foreground">
                    {label}
                  </span>

                  {/* Attribution bar */}
                  <div className="h-2 flex-1 overflow-hidden rounded-sm bg-surface-border">
                    <div className="h-full rounded-sm" style={{ width: `${attrFrac * 100}%`, background: attrColor }} />
                  </div>

                  {/* Effect bar */}
                  <div className="h-2 flex-1 overflow-hidden rounded-sm bg-surface-border">
                    <div className="h-full rounded-sm" style={{ width: `${effectFrac * 100}%`, background: effectColor, opacity: 0.7 + effectFrac * 0.3 }} />
                  </div>

                  {/* Match badge */}
                  <span
                    className="w-[52px] shrink-0 rounded-[3px] border px-1 py-px text-center text-[8px] font-bold tracking-[0.04em]"
                    style={{ color: match.color, background: match.bg, borderColor: match.border }}
                  >
                    {match.text}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Footer: Spearman correlation + Steer button */}
          {(spearman !== null || selectedComponents.length > 0) && (
            <div className="flex items-center justify-between gap-1.5 border-t border-surface-border px-2.5 py-[7px]">
              <span className="flex-1 text-[9px] text-muted">
                {spearman !== null ? `Spearman ρ ${spearman >= 0 ? "+" : ""}${spearman.toFixed(2)}` : ""}
              </span>
              {selectedComponents.length > 0 && !tutorialMode && (
                <button
                  onPointerDown={e => e.stopPropagation()}
                  onClick={() => { onSteerComponents(card.id, selectedComponents); setSelectedComponents([]); }}
                  className="cursor-pointer whitespace-nowrap rounded border-none bg-accent px-[7px] py-0.5 text-[9px] font-semibold text-accent-fg"
                >
                  Steer {selectedComponents.length} →
                </button>
              )}
            </div>
          )}
        </>
      )}
      {tooltip && <HoverTooltip x={tooltip.x} y={tooltip.y}>{tooltip.content}</HoverTooltip>}
    </div>
  );
}

export default React.memo(ActivationCard);
