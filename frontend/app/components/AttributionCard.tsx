"use client";

import React from "react";
import { interpolateColorDivergent } from "../lib/palette";
import type { SteeringComponent } from "./SteeringCard";
import { CardDragHandle, CardLoadingState, CardErrorState, CardLoadingHeader, TierBadge, useElapsedMs, stageLabel } from "./CardShell";
import { cn } from "../lib/cn";
import { HoverTooltip, type TooltipState } from "../lib/tooltip";

export type TopKComponent = {
  layer: number;
  head: number;
  component_type: "attn_head" | "mlp";
  attribution_score: number;
};

export type AttributionData = {
  target_token: string;
  target_token_idx: number;
  contrastive_token: string | null;
  contrastive_token_idx: number | null;
  target_position: number;
  y_labels: string[];
  x_labels: string[];
  layer_attribution: number[];
  head_attribution: number[][];
  top_k_components: TopKComponent[];
};

export type AttributionCardData = {
  id: string;
  cardType: "attribution";
  status: "loading" | "result" | "error";
  modelName: string;
  cleanPrompt: string;
  corruptedPrompt: string;
  data: AttributionData | null;
  error: string | null;
  showBuyCredits?: boolean;
  showVerifyCard?: boolean;
  position: { x: number; y: number };
  gpuTier?: string;
  startedAt?: number;
  loadingStage?: string;
  targetPosition: number | "last";
  targetToken: string | null;
  contrastiveToken: string | null;
  verifyStatus?: "idle" | "loading" | "done";
};

type AttributionCardProps = {
  card: AttributionCardData;
  ref?: React.Ref<HTMLDivElement>;
  onStartDrag: (e: React.PointerEvent<HTMLDivElement>, cardId: string, pos: { x: number; y: number }) => void;
  onDragMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDragEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
  onRemove: (id: string) => void;
  onVerifyTopK: (cardId: string, k: number) => void;
  onSteerComponents: (cardId: string, components: SteeringComponent[]) => void;
  tutorialMode?: boolean;
};

const COL_GAP = 2;
const Y_LABEL_W = 28;
const LAYER_CELL_H = 14;
const HEAD_CELL_SIZE = 14;
const LAYER_BAR_W = 160;
const K_OPTIONS = [5, 10, 20] as const;

const STAGE_LABELS: Record<string, string> = {
  tokenizing:                 "Tokenizing…",
  clean_forward_pass:         "Running reference forward pass",
  corrupted_forward_backward: "Running counterfactual pass + backward",
  computing_attribution:      "Computing attributions",
};

function AttributionCard({
  card,
  ref,
  onStartDrag,
  onDragMove,
  onDragEnd,
  onRemove,
  onVerifyTopK,
  onSteerComponents,
  tutorialMode,
}: AttributionCardProps) {
  const [view, setView] = React.useState<"layer" | "head">("head");
  const [selectedK, setSelectedK] = React.useState<5 | 10 | 20>(10);
  const elapsedMs = useElapsedMs(card.status, card.startedAt);
  const [headerHovered, setHeaderHovered] = React.useState(false);
  const [selectedComponents, setSelectedComponents] = React.useState<SteeringComponent[]>([]);

  const canToggle = card.status === "result" && card.data != null;

  const absMax = React.useMemo(() => {
    if (!card.data) return 1;
    if (view === "layer") {
      return Math.max(1e-9, ...card.data.layer_attribution.map(Math.abs));
    }
    return Math.max(1e-9, ...card.data.head_attribution.flatMap(row => row.map(Math.abs)));
  }, [card.data, view]);

  const cardWidth = React.useMemo(() => {
    if (!card.data || card.status !== "result") return 280;
    if (view === "layer") return Y_LABEL_W + LAYER_BAR_W + 48 + 12;
    return Y_LABEL_W + (HEAD_CELL_SIZE + COL_GAP) * card.data.x_labels.length + 12;
  }, [card.data, card.status, view]);

  const topLayer = React.useMemo(() => {
    if (!card.data) return 0;
    return card.data.layer_attribution.reduce(
      (best, v, i, arr) => (Math.abs(v) > Math.abs(arr[best]) ? i : best),
      0
    );
  }, [card.data]);

  function toggleComponent(comp: SteeringComponent) {
    setSelectedComponents(prev => {
      const exists = prev.some(c => c.layer === comp.layer && c.head === comp.head);
      return exists
        ? prev.filter(c => !(c.layer === comp.layer && c.head === comp.head))
        : [...prev, comp];
    });
  }

  const isVerifying = card.verifyStatus === "loading";
  const isVerified = card.verifyStatus === "done";

  return (
    <div
      ref={ref}
      data-card-id={card.id}
      className={cn(
        "absolute z-10 flex flex-col rounded-lg border border-card-border bg-card shadow-[0_2px_8px_rgba(0,0,0,0.08)]",
        card.status === "loading" && "h-[200px] w-[280px]",
        card.status === "error" && "w-[280px]",
      )}
      style={{ left: card.position.x, top: card.position.y, ...(card.status === "result" ? { width: cardWidth } : {}) }}
    >
      {/* Hover popup */}
      {headerHovered && (
        <div className="pointer-events-none absolute bottom-[calc(100%+6px)] left-0 z-[100] min-w-[220px] max-w-[340px] animate-fade-up rounded-lg border border-card-border bg-card px-3 py-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
          <p className="m-0 break-all text-[11px] font-semibold text-foreground">
            {card.modelName}
          </p>
          <p className="m-0 mb-0.5 mt-[5px] break-words text-[10px] leading-[1.5] text-muted">
            <span className="opacity-60">ref: </span>{card.cleanPrompt}
          </p>
          <p className="m-0 break-words text-[10px] leading-[1.5] text-muted">
            <span className="opacity-60">∼: </span>{card.corruptedPrompt}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {card.gpuTier && <TierBadge tier={card.gpuTier} />}
            <span className="rounded-[3px] border border-card-border bg-surface-border px-[5px] py-px text-[9px] font-semibold tracking-[0.06em] text-accent">
              Attribution
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
        className="flex shrink-0 cursor-grab select-none flex-col rounded-t-lg border-b border-surface-border"
      >
        {/* Row 1: drag strip */}
        <div className="flex min-w-0 items-center gap-1.5 overflow-hidden px-2.5 py-[7px]">
          <CardDragHandle />
          <span className="shrink-0 truncate text-[11px] font-semibold text-foreground">
            {card.modelName}
          </span>
          <span className="min-w-0 flex-1 truncate text-[10px] text-muted">
            {card.cleanPrompt}
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

        {/* Row 2: token badge + view toggle (result only) */}
        {canToggle && (
          <div
            onPointerDown={e => e.stopPropagation()}
            className="flex items-center gap-1.5 border-t border-surface-border px-2.5 py-1"
          >
            {card.data?.target_token && (
              <span className="whitespace-nowrap rounded-[3px] border border-card-border bg-surface-border px-[5px] py-px text-[9px] font-semibold text-accent">
                {card.data.contrastive_token
                  ? `${JSON.stringify(card.data.target_token)} vs ${JSON.stringify(card.data.contrastive_token)}`
                  : `→ ${JSON.stringify(card.data.target_token)}`}
              </span>
            )}
            <div className="flex-1" />
            <div className="flex overflow-hidden rounded border border-card-border">
              {(["layer", "head"] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    "cursor-pointer border-none px-1.5 py-0.5 text-[9px] capitalize leading-[1.4]",
                    view === v ? "bg-accent text-accent-fg" : "bg-transparent text-muted",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Row 3: verify controls (result only) */}
        {canToggle && (
          <div
            onPointerDown={e => e.stopPropagation()}
            className="flex items-center gap-1.5 border-t border-surface-border px-2.5 py-1"
          >
            <span className="whitespace-nowrap text-[9px] text-muted">
              Verify top-K
            </span>
            <div className="flex-1" />
            {isVerified ? (
              <span className="whitespace-nowrap rounded-[3px] border border-[rgba(22,163,74,0.25)] bg-[rgba(22,163,74,0.08)] px-1.5 py-0.5 text-[9px] font-semibold text-green-600">
                ✓ Verified
              </span>
            ) : (
              <>
                <div className="flex overflow-hidden rounded border border-card-border">
                  {K_OPTIONS.map(k => (
                    <button
                      key={k}
                      onClick={() => setSelectedK(k)}
                      className={cn(
                        "cursor-pointer border-none px-[5px] py-0.5 text-[9px] leading-[1.4]",
                        selectedK === k ? "bg-surface-border text-foreground" : "bg-transparent text-muted",
                      )}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => onVerifyTopK(card.id, selectedK)}
                  disabled={isVerifying}
                  className="flex cursor-pointer items-center gap-1 whitespace-nowrap chamfer [--c:3px] border-none bg-accent px-[7px] py-0.5 text-[9px] font-semibold text-accent-fg transition-colors disabled:cursor-not-allowed disabled:bg-surface-border disabled:text-muted"
                >
                  {isVerifying ? (
                    <>
                      <div className="h-2 w-2 animate-spinner rounded-full border-[1.5px] border-current border-t-transparent" />
                      Verifying…
                    </>
                  ) : (
                    `Verify →`
                  )}
                </button>
              </>
            )}
            {/* Steer buttons */}
            {!tutorialMode && (
              <>
                <button
                  onPointerDown={e => e.stopPropagation()}
                  onClick={() => onSteerComponents(card.id, [{ layer: topLayer, head: null, injectionType: "residual" }])}
                  className="cursor-pointer whitespace-nowrap chamfer [--c:3px] border-none bg-accent px-[7px] py-0.5 text-[9px] font-semibold text-accent-fg transition-transform active:translate-y-px"
                >
                  Steer →
                </button>
                {view === "head" && selectedComponents.length > 0 && (
                  <button
                    onPointerDown={e => e.stopPropagation()}
                    onClick={() => { onSteerComponents(card.id, selectedComponents); setSelectedComponents([]); }}
                    className="cursor-pointer whitespace-nowrap chamfer [--c:3px] border-none bg-accent px-[7px] py-0.5 text-[9px] font-semibold text-accent-fg transition-transform active:translate-y-px"
                  >
                    Steer {selectedComponents.length} →
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Loading */}
      {card.status === "loading" && (
        <div className="flex min-h-[110px] flex-col gap-2.5 px-3.5 py-3">
          <CardLoadingHeader gpuTier={card.gpuTier} elapsedMs={elapsedMs} />
          <CardLoadingState
            stage={stageLabel(card.loadingStage, elapsedMs, STAGE_LABELS)}
            warmup={!card.loadingStage && elapsedMs > 30_000}
          />
        </div>
      )}

      {/* Error */}
      {card.status === "error" && <CardErrorState message={card.error ?? undefined} showBuyCredits={card.showBuyCredits} showVerifyCard={card.showVerifyCard} />}

      {/* Result */}
      {card.status === "result" && card.data && (
        <div className="overflow-y-auto overflow-x-hidden bg-card p-1.5">
          {view === "layer" ? (
            <LayerView data={card.data} absMax={absMax} />
          ) : (
            <HeadView data={card.data} absMax={absMax} selectedComponents={selectedComponents} onToggleComponent={toggleComponent} tutorialMode={tutorialMode} />
          )}
        </div>
      )}
    </div>
  );
}

function LayerView({ data, absMax }: { data: AttributionData; absMax: number }) {
  const [tooltip, setTooltip] = React.useState<TooltipState>(null);
  return (
    <>
    <div className="inline-flex flex-col" style={{ gap: COL_GAP }}>
      {data.y_labels.map((label, i) => {
        const val = data.layer_attribution[i];
        const color = interpolateColorDivergent("rdbu", val, absMax);
        const barFrac = Math.abs(val) / absMax;
        const isPositive = val >= 0;

        return (
          <div key={label} className="flex items-center" style={{ gap: COL_GAP }}>
            <div className="shrink-0 pr-1 text-right text-[9px] text-muted" style={{ width: Y_LABEL_W }}>
              {label}
            </div>
            <div
              onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, content: <><span className="font-semibold">{label}</span>{" "}<span className="tabular-nums">{val >= 0 ? "+" : ""}{val.toFixed(3)}</span></> })}
              onMouseLeave={() => setTooltip(null)}
              className="relative flex shrink-0 items-stretch overflow-hidden rounded-sm bg-surface-border"
              style={{ width: LAYER_BAR_W, height: LAYER_CELL_H }}
            >
              <div className="absolute bottom-0 left-1/2 top-0 z-[1] w-px bg-card-border" />
              {isPositive ? (
                <>
                  <div className="w-1/2" />
                  <div className="rounded-r-sm" style={{ width: `${barFrac * 50}%`, background: color }} />
                </>
              ) : (
                <>
                  <div className="flex-1" />
                  <div className="self-stretch rounded-l-sm" style={{ width: `${barFrac * 50}%`, background: color }} />
                  <div className="w-1/2" />
                </>
              )}
            </div>
            <span className="w-11 shrink-0 text-right text-[9px] tabular-nums text-muted">
              {val >= 0 ? "+" : ""}{val.toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
    {tooltip && <HoverTooltip x={tooltip.x} y={tooltip.y}>{tooltip.content}</HoverTooltip>}
    </>
  );
}

function HeadView({
  data, absMax, selectedComponents, onToggleComponent, tutorialMode,
}: {
  data: AttributionData;
  absMax: number;
  selectedComponents: SteeringComponent[];
  onToggleComponent: (comp: SteeringComponent) => void;
  tutorialMode?: boolean;
}) {
  const [tooltip, setTooltip] = React.useState<TooltipState>(null);
  return (
    <>
    <div className="inline-flex flex-col" style={{ gap: COL_GAP }}>
      <div className="flex" style={{ gap: COL_GAP }}>
        <div className="shrink-0" style={{ width: Y_LABEL_W }} />
        {data.x_labels.map((h, i) => (
          <div
            key={i}
            className="shrink-0 truncate pb-0.5 text-center text-[7px] text-muted"
            style={{ width: HEAD_CELL_SIZE }}
          >
            {h}
          </div>
        ))}
      </div>
      {data.y_labels.map((label, li) => (
        <div key={label} className="flex items-center" style={{ gap: COL_GAP }}>
          <div className="shrink-0 pr-1 text-right text-[9px] text-muted" style={{ width: Y_LABEL_W }}>
            {label}
          </div>
          {data.head_attribution[li].map((val, hi) => {
            const color = interpolateColorDivergent("rdbu", val, absMax);
            const isSelected = selectedComponents.some(c => c.layer === li && c.head === hi);
            return (
              <div
                key={hi}
                onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, content: <><span className="font-semibold">{label}</span>{" H"}{hi}<br /><span className="tabular-nums">{val >= 0 ? "+" : ""}{val.toFixed(3)}</span></> })}
                onMouseLeave={() => setTooltip(null)}
                onPointerDown={e => e.stopPropagation()}
                onClick={tutorialMode ? undefined : () => onToggleComponent({ layer: li, head: hi, injectionType: "attn_head" })}
                className="box-border shrink-0 cursor-pointer rounded-sm"
                style={{
                  width: HEAD_CELL_SIZE, height: HEAD_CELL_SIZE,
                  backgroundColor: color,
                  border: isSelected ? "1.5px solid var(--text)" : "0.5px solid var(--surface-border)",
                  outline: isSelected ? "1px solid var(--accent)" : "none",
                  outlineOffset: 1,
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
    {tooltip && <HoverTooltip x={tooltip.x} y={tooltip.y}>{tooltip.content}</HoverTooltip>}
    </>
  );
}

export default React.memo(AttributionCard);
