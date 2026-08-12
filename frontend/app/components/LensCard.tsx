"use client";

import React from "react";
import { useSequentialPalette } from "../hooks/usePalette";
import { interpolateColor, getContrastColor } from "../lib/palette";
import { techniqueForCard } from "../lib/techniques";
import { CardInfo } from "./CardInfo";
import { CardExplain } from "./CardExplain";
import { infoSectionsFor, type InfoSection } from "./card-info-content";
import { BORDER_W } from "./card-geometry";
import {
  CardBand,
  CardCloseButton,
  CardErrorState,
  CardFrame,
  CardHeader,
  CardLoadingHeader,
  CardLoadingState,
  CardBody,
  CardRule,
  CARD_BODY_PAD,
  CARD_MAX_W,
  CARD_MIN_W,
  STRIP_SEGMENT_RADIUS,
  useElapsedMs,
} from "./CardShell";
import { HoverTooltip, type TooltipState } from "../lib/tooltip";
import { cn } from "../lib/cn";
import type { LoadingStage } from "../lib/loading-stage";

const stepperBtnCls = "flex h-4 w-[18px] shrink-0 cursor-pointer items-center justify-center rounded-[var(--ctl-radius-xs)] border border-card-border bg-surface-border p-0 text-[10px] leading-none text-muted";

const TECHNIQUE = techniqueForCard("logit-lens");

const MODE_LABELS: Record<DisplayMode, string> = {
  prob:    "Prob",
  tokens:  "Tokens",
  kl:      "KL",
  rank:    "Rank",
  entropy: "H",
};

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
  /** Set by the CARD_RESOLVED reducer. Absent on rows saved before this existed. */
  finishedAt?: number;
  /** True when the spawn short-circuited on a cache hit — no GPU time was billed. */
  cached?: boolean;
  loadingStage?: LoadingStage;
};

type LensCardProps = {
  card: LensCardData;
  ref?: React.Ref<HTMLDivElement>;
  onStartDrag: (e: React.PointerEvent<HTMLDivElement>, cardId: string, pos: { x: number; y: number }) => void;
  onDragMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDragEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
  onRemove: (id: string) => void;
  tutorialMode?: boolean;
  explainSections?: InfoSection[];
};

type DisplayMode = "prob" | "tokens" | "kl" | "rank" | "entropy";

const CHAR_W = 5;
const CELL_PAD = 6;
const MIN_CELL_W = 24;
const MAX_CELL_W = 52;
const Y_LABEL_W = 30;
const COL_GAP = 2;
const LOG_RANK_BASE = 100000;

/** Row heights, sized to sit closer to the header's type than the old 12px did. */
const CELL_H = 15;
const CELL_H_TOKENS = 24;

/**
 * Cell width: shrinks to keep wide rows under CARD_MAX_W, then grows to fill
 * CARD_MIN_W so a short row's heatmap reaches the card's edge instead of
 * leaving a gap. Never exceeds MAX_CELL_W — the card widens past that instead.
 */
function computeCellWidth(xLabels: string[]): number {
  const maxLen = Math.max(...xLabels.map(t => t.length));
  const natural = Math.max(MIN_CELL_W, Math.min(MAX_CELL_W, Math.ceil(maxLen * CHAR_W) + CELL_PAD));
  const shrinkBudget = CARD_MAX_W - Y_LABEL_W - CARD_BODY_PAD * 2 - BORDER_W;
  const toFit = Math.floor(shrinkBudget / xLabels.length) - COL_GAP;
  const shrunk = Math.max(MIN_CELL_W, Math.min(natural, toFit));

  const fillBudget = CARD_MIN_W - Y_LABEL_W - CARD_BODY_PAD * 2 - BORDER_W;
  const toFill = Math.floor(fillBudget / xLabels.length) - COL_GAP;
  return Math.min(MAX_CELL_W, Math.max(shrunk, toFill));
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
  tutorialMode,
  explainSections,
}: LensCardProps) {
  const palette = useSequentialPalette();
  const [mode, setMode] = React.useState<DisplayMode>("prob");
  const elapsedMs = useElapsedMs(card.status, card.startedAt);
  const [pinnedCol, setPinnedCol] = React.useState<number | null>(null);
  const [activeLayer, setActiveLayer] = React.useState(0);
  const [tooltip, setTooltip] = React.useState<TooltipState>(null);

  // Layer stride/range state — null range means use all layers
  const [stride, setStride] = React.useState(1);
  const [layerRange, setLayerRange] = React.useState<[number, number] | null>(null);

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
  const inTokensMode = mode === "tokens" && canToggle;
  const inKlMode = mode === "kl" && hasKl;
  const inRankMode = mode === "rank" && hasRank;
  const inEntropyMode = mode === "entropy" && hasEntropy;
  const cellWidth = card.data ? computeCellWidth(card.data.x_labels) : 24;
  const rowGap = mode === "tokens" && card.data?.topk_tokens != null ? 2 : 0;

  // Narrow heatmaps sit at CARD_MIN_W so the band has room for all five mode
  // labels.
  const cardWidth = card.data
    ? Math.max(CARD_MIN_W, Y_LABEL_W + (cellWidth + COL_GAP) * card.data.x_labels.length + CARD_BODY_PAD * 2 + BORDER_W)
    : CARD_MIN_W;

  const memoSections = React.useMemo(() => infoSectionsFor(card), [card]);

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

  /* Which layers the heatmap draws. Free and instant, so by the band/panel rule
     it would belong in the band — but at CARD_MIN_W the band's 320px content is
     already spent on the accent (18), the gap (6) and the five-label mode strip
     (308), and a stride row plus a range stepper needs ~120 more. It lives here
     instead, and the panel occluding the heatmap it tunes is the accepted cost:
     this is a set-then-look control, not a live-tune one.

     Plain JSX rather than a nested component: one declared during render is a
     new component type every render, so the panel's controls would remount on
     every parent update (react-hooks/static-components). */
  const layerControls = (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <span className="text-[9px] font-semibold text-muted">Stride</span>
        <div className="flex gap-[3px]">
          {[1, 2, 4, 8].map(s => (
            <button
              key={s}
              onClick={() => setStride(s)}
              className={cn(
                "cursor-pointer rounded-[var(--ctl-radius-xs)] border border-card-border px-[7px] py-0.5 text-[9px]",
                stride === s ? "bg-accent text-accent-fg" : "bg-surface-border text-muted",
              )}
            >
              ×{s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[9px] font-semibold text-muted">Layers</span>
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
  );

  return (
    <CardFrame
      ref={ref}
      cardId={card.id}
      position={card.position}
      width={cardWidth}
      elevated={pinnedCol !== null}
      uncappedHeight
    >
      {/* spin/fadeUp live in globals.css; slideInLeft is unique to this card */}
      <style>{`
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* Pinned column side panel */}
      {panelData && (
        <div
          className="absolute right-[calc(100%+8px)] top-0 w-[180px] rounded-lg border border-card-border bg-card px-2.5 py-2"
          style={{ animation: "slideInLeft 140ms ease-out" }}
        >
          <div className="mb-2 flex items-baseline justify-between gap-1">
            <span className="max-w-[90px] shrink-0 truncate rounded-[var(--ctl-radius-xs)] border border-card-border bg-surface-border px-[5px] py-px text-[11px] font-bold text-accent">
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
                <div key={i} className="flex items-center gap-[5px] font-mono">
                  <span className="w-12 shrink-0 truncate text-right text-[9px] text-foreground">
                    {JSON.stringify(tok)}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-sm bg-surface-border">
                    <div className={cn("h-full rounded-sm transition-[width] duration-120 ease-out", i === 0 ? "bg-accent" : "bg-card-border")} style={{ width: `${prob * 100}%` }} />
                  </div>
                  <span className="w-[34px] shrink-0 text-right font-mono text-[9px] tabular-nums text-muted">
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

      {!tutorialMode && <CardCloseButton onClick={() => onRemove(card.id)} />}

      {/* Chrome — the whole block is the drag surface; interactive children opt out */}
      <div
        onPointerDown={e => onStartDrag(e, card.id, card.position)}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        className="shrink-0 cursor-grab select-none"
      >
        <CardHeader modelName={card.modelName} prompt={card.prompt} />

        {/* Renders in every status — only the mode strip gates. The info button
            is most wanted while a job loads, which is exactly when the old
            `{data && <CardBand …>}` hid it. `canToggle` still guards the strip
            alone, so a result without top-k now keeps its info button. */}
        <CardBand info={
          <>
            <CardInfo
              accent={TECHNIQUE.band}
              accentLabel={TECHNIQUE.name}
              sections={memoSections}
              controls={card.status === "result" ? layerControls : undefined}
            />
            {tutorialMode && explainSections && (
              <CardExplain accent={TECHNIQUE.band} accentLabel={TECHNIQUE.name} sections={explainSections} />
            )}
          </>
        }>
          {card.status === "result" && canToggle && (
            <div className="flex h-full w-full max-w-[380px] items-stretch bg-surface-border">
              {(["prob", "tokens", ...(hasKl ? ["kl"] : []), ...(hasRank ? ["rank"] : []), ...(hasEntropy ? ["entropy"] : [])] as DisplayMode[]).map(m => (
                <button
                  key={m}
                  onPointerDown={e => e.stopPropagation()}
                  onClick={() => setMode(m)}
                  className={cn(
                    "flex-1 cursor-pointer border-none text-[11px] leading-none transition-colors",
                    mode === m ? "bg-background text-foreground" : "bg-transparent text-muted",
                  )}
                  style={{ borderRadius: STRIP_SEGMENT_RADIUS }}
                >
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>
          )}
        </CardBand>

        <CardRule />
      </div>

      {/* Body */}
      {card.status === "loading" && (
        <div className="flex min-h-[110px] flex-col gap-2.5 px-5 py-3">
          <CardLoadingHeader gpuTier={card.gpuTier} elapsedMs={elapsedMs} />
          <CardLoadingState stage={card.loadingStage} labels={STAGE_LABELS} />
        </div>
      )}

      {card.status === "error" && <CardErrorState message={card.error ?? undefined} showBuyCredits={card.showBuyCredits} showVerifyCard={card.showVerifyCard} />}

      {card.status === "result" && card.data && (
        <CardBody>
          <div className="inline-flex flex-col" style={{ gap: rowGap }}>
            {/* X-axis labels */}
            <div className="flex" style={{ gap: COL_GAP }}>
              <div className="shrink-0" style={{ width: Y_LABEL_W }} />
              {card.data.x_labels.map((token, i) => (
                <div
                  key={i}
                  onClick={() => canPin && handleColClick(i)}
                  className={cn(
                    "box-border shrink-0 truncate pb-1.5 text-center font-mono text-[9px]",
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
              const cellHeight = inTokensMode ? CELL_H_TOKENS : CELL_H;

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
                      "shrink-0 overflow-hidden pr-1.5 text-right font-mono text-[10px]",
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
                        <div className="font-mono">rank <span className="font-semibold">#{rank}</span></div>
                      </>
                    ) : inEntropyMode && entropy !== null ? (
                      <>
                        <div className="mb-0.5 text-muted">
                          <span className="font-semibold text-foreground">{xLabel}</span>{" · "}layer {yIndex}
                        </div>
                        <div className="font-mono tabular-nums">H = <span className="font-semibold">{entropy.toFixed(3)}</span> nats</div>
                      </>
                    ) : inKlMode && klVal !== null ? (
                      <>
                        <div className="mb-0.5 text-muted">
                          <span className="font-semibold text-foreground">{xLabel}</span>{" · "}layer {yIndex}
                        </div>
                        <div className="font-mono tabular-nums">KL = <span className="font-semibold">{klVal.toFixed(3)}</span> nats</div>
                      </>
                    ) : inTokensMode && card.data!.topk_tokens && card.data!.topk_probs ? (
                      <>
                        <div className="mb-1 text-muted">
                          <span className="font-semibold text-foreground">{xLabel}</span>{" · "}layer {yIndex}
                        </div>
                        {card.data!.topk_tokens[yIndex][xIndex].map((t, i) => (
                          <div key={i} className="flex gap-2.5 font-mono tabular-nums">
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
                        <div className="font-mono tabular-nums">p = <span className="font-semibold">{(prob * 100).toFixed(2)}%</span></div>
                      </>
                    );

                    return (
                      <div
                        key={`${yIndex}-${xIndex}`}
                        onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, content: tooltipContent })}
                        onMouseLeave={() => setTooltip(null)}
                        className={cn(
                          "box-border shrink-0 overflow-hidden rounded-[1px]",
                          (inTokensMode || showRankNumber) && "flex items-center justify-center",
                          canPin ? "cursor-pointer" : "cursor-default",
                        )}
                        style={{ width: cellWidth, height: cellHeight, backgroundColor: cellBg, border: cellBorder }}
                        onClick={() => canPin && handleColClick(xIndex)}
                      >
                        {inTokensMode && topToken !== null && (
                          <span className="max-w-full overflow-hidden whitespace-nowrap font-mono text-[9px] leading-none" style={{ color: getContrastColor(palette, topProb) }}>
                            {topToken}
                          </span>
                        )}
                        {showRankNumber && !inTokensMode && (
                          <span className="max-w-full overflow-hidden whitespace-nowrap font-mono text-[9px] leading-none" style={{ color: getContrastColor(palette, cellColorValue) }}>
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
        </CardBody>
      )}
      {tooltip && <HoverTooltip x={tooltip.x} y={tooltip.y}>{tooltip.content}</HoverTooltip>}
    </CardFrame>
  );
}

export default React.memo(LensCard);
