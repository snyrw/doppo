"use client";

import React from "react";
import { usePalette } from "../hooks/usePalette";
import { interpolateColor, getContrastColor } from "../lib/palette";
import { TIER_LABELS } from "../lib/tiers";
import { CardDragHandle, CardLoadingState, CardErrorState, CardLoadingHeader, useElapsedMs, stageLabel } from "./CardShell";
import { HoverTooltip, type TooltipState } from "../lib/tooltip";
import { cn } from "../lib/cn";

const stepperBtnCls = "flex h-4 w-[18px] shrink-0 cursor-pointer items-center justify-center rounded-[3px] border border-card-border bg-surface-border p-0 text-[10px] leading-none text-muted";

export type HeatmapData = {
  x_labels: string[];
  y_labels: string[];
  heatmap_data: number[][];
  topk_tokens?: string[][][];
  topk_probs?: number[][][];
  kl_data?: number[][];
  rank_data?: number[][];
  entropy_data?: number[][];
};

export type LensCardData = {
  id: string;
  cardType: "logit-lens";
  status: "loading" | "result" | "error";
  modelName: string;
  prompt: string;
  topK?: number;
  data: HeatmapData | null;
  error: string | null;
  showBuyCredits?: boolean;
  showVerifyCard?: boolean;
  position: { x: number; y: number };
  gpuTier?: string;
  startedAt?: number;
  loadingStage?: string;
};

type LensCardProps = {
  card: LensCardData;
  ref?: React.Ref<HTMLDivElement>;
  onStartDrag: (e: React.PointerEvent<HTMLDivElement>, cardId: string, pos: { x: number; y: number }) => void;
  onDragMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDragEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
  onRemove: (id: string) => void;
  onSpawnEntropy?: () => void;
  entropyCardExists?: boolean;
  tutorialMode?: boolean;
};

type DisplayMode = "prob" | "tokens" | "kl" | "rank" | "entropy";

const CHAR_W = 4.5;
const CELL_PAD = 6;
const MIN_CELL_W = 20;
const MAX_CELL_W = 48;
const Y_LABEL_W = 28;
const COL_GAP = 2;
const LOG_RANK_BASE = 100000;

function computeCellWidth(xLabels: string[]): number {
  const maxLen = Math.max(...xLabels.map(t => t.length));
  return Math.max(MIN_CELL_W, Math.min(MAX_CELL_W, Math.ceil(maxLen * CHAR_W) + CELL_PAD));
}

const STAGE_LABELS: Record<string, string> = {
  tokenizing:   "Tokenizing…",
  forward_pass: "Running forward pass",
  computing:    "Computing logit lens",
};

function normRank(rank: number, maxRank: number): number {
  const base = Math.max(maxRank, 100);
  return Math.max(0, 1 - Math.log(rank) / Math.log(base));
}

function computeCellColorValue(
  inRankMode: boolean, rank: number | null, maxRankInData: number,
  inEntropyMode: boolean, entropy: number | null, maxEntropyInData: number,
  inKlMode: boolean, klVal: number | null, klMax: number,
  topProb: number
): number {
  if (inRankMode && rank !== null) return normRank(rank, maxRankInData);
  if (inEntropyMode && entropy !== null) return entropy / maxEntropyInData;
  if (inKlMode && klVal !== null) return Math.min(klVal / klMax, 1);
  return topProb;
}


function LensCard({
  card,
  ref,
  onStartDrag,
  onDragMove,
  onDragEnd,
  onRemove,
  onSpawnEntropy,
  entropyCardExists,
  tutorialMode,
}: LensCardProps) {
  const palette = usePalette();
  const [mode, setMode] = React.useState<DisplayMode>("prob");
  const elapsedMs = useElapsedMs(card.status, card.startedAt);
  const [pinnedCol, setPinnedCol] = React.useState<number | null>(null);
  const [activeLayer, setActiveLayer] = React.useState(0);
  const [headerHovered, setHeaderHovered] = React.useState(false);
  const [tooltip, setTooltip] = React.useState<TooltipState>(null);

  // Layer stride/range state — null range means use all layers
  const [stride, setStride] = React.useState(1);
  const [layerRange, setLayerRange] = React.useState<[number, number] | null>(null);
  const [strideOpen, setStrideOpen] = React.useState(false);

  React.useEffect(() => {
    if (card.data) {
      setActiveLayer(card.data.y_labels.length - 1);
      setLayerRange(null);
      setStride(1);
    }
  }, [card.data]);

  const nLayers = card.data?.y_labels.length ?? 0;

  const filteredIndices = React.useMemo(() => {
    if (!card.data) return [];
    const from = layerRange ? layerRange[0] : 0;
    const to = layerRange ? layerRange[1] : nLayers - 1;
    const result: number[] = [];
    for (let i = from; i <= to; i += stride) result.push(i);
    return result;
  }, [card.data, layerRange, stride, nLayers]);

  const rankData = card.data?.rank_data;
  const maxRankInData = React.useMemo(() => {
    if (!rankData) return LOG_RANK_BASE;
    return Math.max(...rankData.flat(), 2);
  }, [rankData]);

  const entropyData = card.data?.entropy_data;
  const maxEntropyInData = React.useMemo(() => {
    if (!entropyData) return 1;
    return Math.max(...entropyData.flat(), 0.01);
  }, [entropyData]);

  const canToggle = card.status === "result" && card.data?.topk_tokens != null;
  const canPin = card.status === "result" && card.data?.topk_tokens != null;
  const hasKl = !!card.data?.kl_data;
  const hasRank = !!card.data?.rank_data;
  const hasEntropy = !!card.data?.entropy_data;
  const hasFilter = stride > 1 || layerRange !== null;
  const inTokensMode = mode === "tokens" && canToggle;
  const inKlMode = mode === "kl" && hasKl;
  const inRankMode = mode === "rank" && hasRank;
  const inEntropyMode = mode === "entropy" && hasEntropy;
  const cellWidth = card.data ? computeCellWidth(card.data.x_labels) : 24;
  const rowGap = mode === "tokens" && card.data?.topk_tokens != null ? 2 : 0;

  // 12 = body padding, 2 = card border (border-box via Tailwind preflight)
  const heatmapPx = card.data
    ? Y_LABEL_W + (cellWidth + COL_GAP) * card.data.x_labels.length + 12 + 2
    : null;

  const handleColClick = (i: number) => {
    setPinnedCol(prev => (prev === i ? null : i));
  };

  const panelData =
    pinnedCol !== null && card.data?.topk_tokens
      ? {
          tokens: card.data.topk_tokens[activeLayer][pinnedCol],
          probs: card.data.topk_probs![activeLayer][pinnedCol],
          colLabel: card.data.x_labels[pinnedCol],
          layerLabel: String(activeLayer),
        }
      : null;

  const rangeFrom = layerRange ? layerRange[0] : 0;
  const rangeTo = layerRange ? layerRange[1] : Math.max(0, nLayers - 1);

  return (
    <div
      ref={ref}
      data-card-id={card.id}
      className={cn(
        "absolute flex flex-col rounded-lg border border-card-border bg-card shadow-[0_2px_8px_rgba(0,0,0,0.08)]",
        pinnedCol !== null ? "z-20" : "z-10",
        // No minWidth in result state: small heatmaps (few tokens) size to content
        card.status === "loading" && "h-[200px] w-[280px] min-w-[280px]",
        card.status === "error" && "w-[280px] min-w-[280px]",
      )}
      style={{ left: card.position.x, top: card.position.y, ...(card.status === "result" && heatmapPx ? { width: heatmapPx } : {}) }}
    >
      {/* spin/fadeUp live in globals.css; slideInLeft is unique to this card */}
      <style>{`
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* Hover popup */}
      {headerHovered && (
        <div className="pointer-events-none absolute bottom-[calc(100%+6px)] left-0 z-[100] min-w-[200px] max-w-[320px] animate-fade-up rounded-lg border border-card-border bg-card px-3 py-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
          <p className="m-0 break-all text-[11px] font-semibold text-foreground">
            {card.modelName}
          </p>
          <p className="m-0 mt-[5px] break-words text-[10px] leading-[1.5] text-muted">
            {card.prompt}
          </p>
          {card.gpuTier && (
            <span className="mt-1.5 inline-block rounded-[3px] border border-card-border bg-surface-border px-[5px] py-px text-[9px] font-semibold tracking-[0.06em] text-accent">
              {TIER_LABELS[card.gpuTier] ?? card.gpuTier}
            </span>
          )}
        </div>
      )}

      {/* Pinned column side panel */}
      {panelData && (
        <div
          className="absolute right-[calc(100%+8px)] top-0 w-[180px] rounded-lg border border-card-border bg-card px-2.5 py-2 shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
          style={{ animation: "slideInLeft 140ms ease-out" }}
        >
          <div className="mb-2 flex items-baseline justify-between gap-1">
            <span className="max-w-[90px] shrink-0 truncate rounded-[3px] border border-card-border bg-surface-border px-[5px] py-px text-[11px] font-bold text-accent">
              {panelData.colLabel}
            </span>
            <span className="shrink-0 text-[9px] text-muted">
              layer {panelData.layerLabel}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {panelData.tokens.map((tok, i) => {
              const prob = panelData.probs[i];
              return (
                <div key={i} className="flex items-center gap-[5px]">
                  <span className="w-12 shrink-0 truncate text-right text-[9px] text-foreground">
                    {JSON.stringify(tok)}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-sm bg-surface-border">
                    <div className={cn("h-full rounded-sm transition-[width] duration-120 ease-out", i === 0 ? "bg-accent" : "bg-card-border")} style={{ width: `${prob * 100}%` }} />
                  </div>
                  <span className="w-[30px] shrink-0 text-right text-[9px] tabular-nums text-muted">
                    {(prob * 100).toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
          <p className="m-0 mt-2 text-center text-[8px] text-surface-border">
            hover rows to change layer
          </p>
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
        {/* Row 1: drag handle + title + close */}
        <div className="flex min-w-0 items-center gap-1.5 overflow-hidden px-2.5 py-[7px]">
          <CardDragHandle />
          <span className="shrink-0 truncate text-[11px] font-semibold text-foreground">
            {card.modelName}
          </span>
          <span className="min-w-0 flex-1 truncate text-[10px] text-muted">
            {card.prompt}
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

        {/* Row 2: mode controls — no overflow: hidden so the ··· popover can escape */}
        {card.status === "result" && (
          <div
            onPointerDown={e => e.stopPropagation()}
            className="flex flex-wrap items-center gap-1.5 border-t border-surface-border px-2.5 py-1"
          >
            {canToggle && (
              <div className="flex shrink-0 overflow-hidden rounded border border-card-border">
                {(["prob", "tokens", ...(hasKl ? ["kl"] : []), ...(hasRank ? ["rank"] : []), ...(hasEntropy ? ["entropy"] : [])] as DisplayMode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={cn(
                      "cursor-pointer border-none px-1.5 py-0.5 text-[9px] leading-[1.4]",
                      mode === m ? "bg-accent text-accent-fg" : "bg-transparent text-muted",
                    )}
                  >
                    {m === "prob" ? "Prob" : m === "tokens" ? "Tokens" : m === "kl" ? "KL" : m === "rank" ? "Rank" : "H"}
                  </button>
                ))}
              </div>
            )}

            {/* Entropy spawn button — visible whenever entropy data exists */}
            {!tutorialMode && hasEntropy && onSpawnEntropy && (
              <button
                onClick={entropyCardExists ? undefined : onSpawnEntropy}
                title={entropyCardExists ? "Entropy card already open" : "Spawn entropy sparkline card"}
                className={cn(
                  "shrink-0 rounded border border-card-border bg-surface-border px-[5px] py-0.5 text-[9px] leading-[1.4]",
                  entropyCardExists ? "cursor-default text-surface-border opacity-40" : "cursor-pointer text-muted",
                )}
              >
                ↗
              </button>
            )}

            <div className="flex-1" />

            {/* Active-filter badge — click to reset */}
            {hasFilter && (
              <button
                onClick={() => { setStride(1); setLayerRange(null); }}
                title="Reset layer filter"
                className="shrink-0 cursor-pointer rounded border border-card-border bg-surface-border px-[5px] py-px text-[9px] leading-[1.4] text-accent"
              >
                {stride > 1 ? `÷${stride}` : "◉"}
              </button>
            )}

            {/* Layer settings popover trigger — position: relative has no overflow: hidden ancestor, popover renders freely */}
            <div className="relative shrink-0">
              <button
                onClick={() => setStrideOpen(o => !o)}
                className={cn(
                  "cursor-pointer rounded border border-transparent px-[5px] py-px text-[10px] leading-[1.4] text-muted",
                  strideOpen ? "bg-surface-border" : "bg-transparent",
                )}
              >
                ···
              </button>

              {strideOpen && (
                <div
                  className="absolute right-0 top-[calc(100%+4px)] z-50 flex min-w-40 flex-col gap-2 rounded-md border border-card-border bg-card px-3 py-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.10)]"
                  onPointerDown={e => e.stopPropagation()}
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-semibold tracking-[0.06em] text-muted">STRIDE</span>
                    <div className="flex gap-[3px]">
                      {[1, 2, 4, 8].map(s => (
                        <button
                          key={s}
                          onClick={() => setStride(s)}
                          className={cn(
                            "cursor-pointer rounded-[3px] border border-card-border px-[7px] py-0.5 text-[9px]",
                            stride === s ? "bg-accent text-accent-fg" : "bg-surface-border text-muted",
                          )}
                        >
                          ×{s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-semibold tracking-[0.06em] text-muted">LAYERS</span>
                    <div className="flex items-center gap-1">
                      <span className="w-[22px] text-[9px] text-muted">from</span>
                      <button onClick={() => setLayerRange([Math.max(0, rangeFrom - 1), rangeTo])} className={stepperBtnCls}>−</button>
                      <span className="min-w-5 text-center text-[9px] text-foreground">{rangeFrom}</span>
                      <button onClick={() => setLayerRange([Math.min(rangeTo, rangeFrom + 1), rangeTo])} className={stepperBtnCls}>+</button>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-[22px] text-[9px] text-muted">to</span>
                      <button onClick={() => setLayerRange([rangeFrom, Math.max(rangeFrom, rangeTo - 1)])} className={stepperBtnCls}>−</button>
                      <span className="min-w-5 text-center text-[9px] text-foreground">{rangeTo}</span>
                      <button onClick={() => setLayerRange([rangeFrom, Math.min(nLayers - 1, rangeTo + 1)])} className={stepperBtnCls}>+</button>
                    </div>
                  </div>

                  <button
                    onClick={() => { setStride(1); setLayerRange(null); }}
                    className="cursor-pointer border-none bg-transparent py-[3px] text-left text-[9px] text-muted"
                  >
                    reset
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      {card.status === "loading" && (
        <div className="flex min-h-[110px] flex-col gap-2.5 px-3.5 py-3">
          <CardLoadingHeader gpuTier={card.gpuTier} elapsedMs={elapsedMs} />
          <CardLoadingState
            stage={stageLabel(card.loadingStage, elapsedMs, STAGE_LABELS)}
            warmup={!card.loadingStage && elapsedMs > 30_000}
          />
        </div>
      )}

      {card.status === "error" && <CardErrorState message={card.error ?? undefined} showBuyCredits={card.showBuyCredits} showVerifyCard={card.showVerifyCard} />}

      {card.status === "result" && card.data && (
        <div className="overflow-y-auto overflow-x-hidden bg-card p-1.5">
          <div className="inline-flex flex-col" style={{ gap: rowGap }}>
            {/* X-axis labels */}
            <div className="flex" style={{ gap: COL_GAP }}>
              <div className="shrink-0" style={{ width: Y_LABEL_W }} />
              {card.data.x_labels.map((token, i) => (
                <div
                  key={i}
                  onClick={() => canPin && handleColClick(i)}
                  className={cn(
                    "box-border shrink-0 truncate pb-1 text-center text-[7px]",
                    pinnedCol === i ? "font-bold text-accent" : "font-normal text-muted",
                    canPin ? "cursor-pointer" : "cursor-default",
                  )}
                  style={{ width: cellWidth }}
                >
                  {token}
                </div>
              ))}
            </div>

            {/* Heatmap rows (filtered by stride/range) */}
            {filteredIndices.map(yIndex => {
              const layerName = card.data!.y_labels[yIndex];
              const klMax = inKlMode ? Math.min(Math.max(...card.data!.kl_data![yIndex], 1e-6), 5) : 1;
              const cellHeight = inTokensMode ? 20 : 12;

              const yLabelActive = pinnedCol !== null && activeLayer === yIndex;
              return (
                <div
                  key={layerName}
                  className="flex items-center"
                  style={{ gap: COL_GAP }}
                  onMouseEnter={() => pinnedCol !== null && setActiveLayer(yIndex)}
                >
                  <div
                    className={cn(
                      "shrink-0 overflow-hidden pr-1 text-right text-[9px]",
                      yLabelActive ? "font-bold text-accent" : "font-normal text-muted",
                    )}
                    style={{ width: Y_LABEL_W }}
                  >
                    {String(yIndex)}
                  </div>

                  {card.data!.heatmap_data[yIndex].map((prob, xIndex) => {
                    const topProb = inTokensMode ? card.data!.topk_probs![yIndex][xIndex][0] : prob;
                    const topToken = inTokensMode ? card.data!.topk_tokens![yIndex][xIndex][0] : null;
                    const isPinned = pinnedCol === xIndex;
                    const isActivePinnedCell = isPinned && activeLayer === yIndex;

                    const rank = inRankMode ? card.data!.rank_data![yIndex][xIndex] : null;
                    const entropy = inEntropyMode ? card.data!.entropy_data![yIndex][xIndex] : null;
                    const klVal = inKlMode ? card.data!.kl_data![yIndex][xIndex] : null;

                    const cellColorValue = computeCellColorValue(
                      inRankMode, rank, maxRankInData,
                      inEntropyMode, entropy, maxEntropyInData,
                      inKlMode, klVal, klMax,
                      topProb
                    );

                    const cellBg = interpolateColor(palette, cellColorValue);
                    const cellBorder = isActivePinnedCell
                      ? "1.5px solid var(--accent)"
                      : isPinned
                      ? "0.5px solid var(--card-border)"
                      : "0.5px solid var(--surface-border)";

                    const showRankNumber = inRankMode && rank !== null && rank <= 50;

                    const xLabel = card.data!.x_labels[xIndex];
                    const tooltipContent: React.ReactNode = inRankMode && rank !== null ? (
                      <>
                        <div className="mb-0.5 text-muted">
                          <span className="font-semibold text-foreground">{xLabel}</span>{" · "}layer {yIndex}
                        </div>
                        <div>rank <span className="font-semibold">#{rank}</span></div>
                      </>
                    ) : inEntropyMode && entropy !== null ? (
                      <>
                        <div className="mb-0.5 text-muted">
                          <span className="font-semibold text-foreground">{xLabel}</span>{" · "}layer {yIndex}
                        </div>
                        <div className="tabular-nums">H = <span className="font-semibold">{entropy.toFixed(3)}</span> nats</div>
                      </>
                    ) : inKlMode && klVal !== null ? (
                      <>
                        <div className="mb-0.5 text-muted">
                          <span className="font-semibold text-foreground">{xLabel}</span>{" · "}layer {yIndex}
                        </div>
                        <div className="tabular-nums">KL = <span className="font-semibold">{klVal.toFixed(3)}</span> nats</div>
                      </>
                    ) : inTokensMode && card.data!.topk_tokens && card.data!.topk_probs ? (
                      <>
                        <div className="mb-1 text-muted">
                          <span className="font-semibold text-foreground">{xLabel}</span>{" · "}layer {yIndex}
                        </div>
                        {card.data!.topk_tokens[yIndex][xIndex].map((t, i) => (
                          <div key={i} className="flex gap-2.5 tabular-nums">
                            <span className="min-w-[30px] text-right text-muted">
                              {(card.data!.topk_probs![yIndex][xIndex][i] * 100).toFixed(1)}%
                            </span>
                            <span className={i === 0 ? "font-semibold" : "font-normal"}>{JSON.stringify(t)}</span>
                          </div>
                        ))}
                      </>
                    ) : (
                      <>
                        <div className="mb-0.5 text-muted">
                          <span className="font-semibold text-foreground">{xLabel}</span>{" · "}layer {yIndex}
                        </div>
                        <div className="tabular-nums">p = <span className="font-semibold">{(prob * 100).toFixed(2)}%</span></div>
                      </>
                    );

                    return (
                      <div
                        key={`${yIndex}-${xIndex}`}
                        onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, content: tooltipContent })}
                        onMouseLeave={() => setTooltip(null)}
                        className={cn(
                          "box-border shrink-0 overflow-hidden rounded-sm",
                          (inTokensMode || showRankNumber) && "flex items-center justify-center",
                          canPin ? "cursor-pointer" : "cursor-default",
                        )}
                        style={{ width: cellWidth, height: cellHeight, backgroundColor: cellBg, border: cellBorder }}
                        onClick={() => canPin && handleColClick(xIndex)}
                      >
                        {inTokensMode && topToken !== null && (
                          <span className="max-w-full overflow-hidden whitespace-nowrap text-[7px] leading-none" style={{ color: getContrastColor(palette, topProb) }}>
                            {topToken}
                          </span>
                        )}
                        {showRankNumber && !inTokensMode && (
                          <span className="max-w-full overflow-hidden whitespace-nowrap text-[7px] leading-none" style={{ color: getContrastColor(palette, cellColorValue) }}>
                            {rank}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {tooltip && <HoverTooltip x={tooltip.x} y={tooltip.y}>{tooltip.content}</HoverTooltip>}
    </div>
  );
}

export default React.memo(LensCard);
