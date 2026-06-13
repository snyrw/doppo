"use client";

import React from "react";
import { usePalette } from "../hooks/usePalette";
import { interpolateColor, getContrastColor } from "../lib/palette";
import { TIER_LABELS } from "../lib/tiers";
import { CardDragHandle, CardLoadingState, CardErrorState, CardLoadingHeader, useElapsedMs, stageLabel } from "./CardShell";
import { HoverTooltip, type TooltipState } from "../lib/tooltip";

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
      style={{
        position: "absolute",
        left: card.position.x,
        top: card.position.y,
        zIndex: pinnedCol !== null ? 20 : 10,
        background: "var(--card)",
        borderRadius: 8,
        border: "1px solid var(--card-border)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        display: "flex",
        flexDirection: "column",
        // No minWidth in result state: small heatmaps (few tokens) size to content
        ...(card.status === "loading" ? { minWidth: 280, width: 280, height: 200 } : {}),
        ...(card.status === "error" ? { minWidth: 280, width: 280 } : {}),
        ...(card.status === "result" && heatmapPx ? { width: heatmapPx } : {}),
      }}
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
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: 0,
            background: "var(--card)",
            border: "1px solid var(--card-border)",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            padding: "10px 12px",
            zIndex: 100,
            pointerEvents: "none",
            minWidth: 200,
            maxWidth: 320,
            animation: "fadeUp 120ms ease-out",
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 600, margin: 0, color: "var(--text)", fontFamily: "var(--font-ibm-plex-sans), sans-serif", wordBreak: "break-all" }}>
            {card.modelName}
          </p>
          <p style={{ fontSize: 10, color: "var(--text-muted)", margin: "5px 0 0", lineHeight: 1.5, fontFamily: "var(--font-ibm-plex-sans), sans-serif", wordBreak: "break-word" }}>
            {card.prompt}
          </p>
          {card.gpuTier && (
            <span style={{ display: "inline-block", marginTop: 6, fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", color: "var(--accent)", background: "var(--surface-border)", border: "1px solid var(--card-border)", borderRadius: 3, padding: "1px 5px" }}>
              {TIER_LABELS[card.gpuTier] ?? card.gpuTier}
            </span>
          )}
        </div>
      )}

      {/* Pinned column side panel */}
      {panelData && (
        <div
          style={{
            position: "absolute",
            right: "calc(100% + 8px)",
            top: 0,
            width: 180,
            background: "var(--card)",
            border: "1px solid var(--card-border)",
            borderRadius: 8,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            padding: "8px 10px",
            animation: "slideInLeft 140ms ease-out",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, gap: 4 }}>
            <span style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "var(--surface-border)", border: "1px solid var(--card-border)", borderRadius: 3, padding: "1px 5px", maxWidth: 90, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", flexShrink: 0 }}>
              {panelData.colLabel}
            </span>
            <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-ibm-plex-sans), sans-serif", flexShrink: 0 }}>
              layer {panelData.layerLabel}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {panelData.tokens.map((tok, i) => {
              const prob = panelData.probs[i];
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 48, fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 9, color: "var(--text)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", flexShrink: 0, textAlign: "right" }}>
                    {JSON.stringify(tok)}
                  </span>
                  <div style={{ flex: 1, height: 8, background: "var(--surface-border)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${prob * 100}%`, height: "100%", background: i === 0 ? "var(--accent)" : "var(--card-border)", borderRadius: 2, transition: "width 120ms ease-out" }} />
                  </div>
                  <span style={{ width: 30, fontSize: 9, color: "var(--text-muted)", textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                    {(prob * 100).toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 8, color: "var(--surface-border)", margin: "8px 0 0", textAlign: "center" }}>
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
        style={{
          borderBottom: "1px solid var(--surface-border)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          borderRadius: "8px 8px 0 0",
          cursor: "grab",
          userSelect: "none",
        }}
      >
        {/* Row 1: drag handle + title + close */}
        <div style={{ padding: "7px 10px", display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
          <CardDragHandle />
          <span style={{ fontSize: 11, color: "var(--text)", fontWeight: 600, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {card.modelName}
          </span>
          <span style={{ fontSize: 10, color: "var(--text-muted)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {card.prompt}
          </span>
          {!tutorialMode && (
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={() => onRemove(card.id)}
              style={{ fontSize: 12, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: "0 2px", flexShrink: 0, lineHeight: 1 }}
            >
              ×
            </button>
          )}
        </div>

        {/* Row 2: mode controls — no overflow: hidden so the ··· popover can escape */}
        {card.status === "result" && (
          <div
            onPointerDown={e => e.stopPropagation()}
            style={{ padding: "4px 10px", borderTop: "1px solid var(--surface-border)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}
          >
            {canToggle && (
              <div style={{ display: "flex", border: "1px solid var(--card-border)", borderRadius: 4, overflow: "hidden", flexShrink: 0 }}>
                {(["prob", "tokens", ...(hasKl ? ["kl"] : []), ...(hasRank ? ["rank"] : []), ...(hasEntropy ? ["entropy"] : [])] as DisplayMode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    style={{
                      fontSize: 9,
                      padding: "2px 6px",
                      background: mode === m ? "var(--accent)" : "transparent",
                      color: mode === m ? "var(--accent-fg)" : "var(--text-muted)",
                      border: "none",
                      cursor: "pointer",
                      lineHeight: 1.4,
                    }}
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
                style={{ fontSize: 9, padding: "2px 5px", background: "var(--surface-border)", border: "1px solid var(--card-border)", borderRadius: 4, color: entropyCardExists ? "var(--surface-border)" : "var(--text-muted)", cursor: entropyCardExists ? "default" : "pointer", flexShrink: 0, lineHeight: 1.4, opacity: entropyCardExists ? 0.4 : 1 }}
              >
                ↗
              </button>
            )}

            <div style={{ flex: 1 }} />

            {/* Active-filter badge — click to reset */}
            {hasFilter && (
              <button
                onClick={() => { setStride(1); setLayerRange(null); }}
                title="Reset layer filter"
                style={{ fontSize: 9, padding: "1px 5px", background: "var(--surface-border)", border: "1px solid var(--card-border)", borderRadius: 4, color: "var(--accent)", cursor: "pointer", flexShrink: 0, fontFamily: "var(--font-ibm-plex-sans), sans-serif", lineHeight: 1.4 }}
              >
                {stride > 1 ? `÷${stride}` : "◉"}
              </button>
            )}

            {/* Layer settings popover trigger — position: relative has no overflow: hidden ancestor, popover renders freely */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <button
                onClick={() => setStrideOpen(o => !o)}
                style={{ fontSize: 10, padding: "1px 5px", background: strideOpen ? "var(--surface-border)" : "transparent", border: "1px solid transparent", borderRadius: 4, color: "var(--text-muted)", cursor: "pointer", lineHeight: 1.4 }}
              >
                ···
              </button>

              {strideOpen && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 4px)",
                    background: "var(--card)",
                    border: "1px solid var(--card-border)",
                    borderRadius: 6,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
                    padding: "10px 12px",
                    zIndex: 50,
                    minWidth: 160,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                  onPointerDown={e => e.stopPropagation()}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 9, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.06em", fontFamily: "var(--font-ibm-plex-sans), sans-serif" }}>STRIDE</span>
                    <div style={{ display: "flex", gap: 3 }}>
                      {[1, 2, 4, 8].map(s => (
                        <button
                          key={s}
                          onClick={() => setStride(s)}
                          style={{
                            fontSize: 9,
                            padding: "2px 7px",
                            background: stride === s ? "var(--accent)" : "var(--surface-border)",
                            color: stride === s ? "var(--accent-fg)" : "var(--text-muted)",
                            border: "1px solid var(--card-border)",
                            borderRadius: 3,
                            cursor: "pointer",
                            fontFamily: "var(--font-ibm-plex-sans), sans-serif",
                          }}
                        >
                          ×{s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 9, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.06em", fontFamily: "var(--font-ibm-plex-sans), sans-serif" }}>LAYERS</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-ibm-plex-sans), sans-serif", width: 22 }}>from</span>
                      <button onClick={() => setLayerRange([Math.max(0, rangeFrom - 1), rangeTo])} style={stepperBtn}>−</button>
                      <span style={{ fontSize: 9, fontFamily: "var(--font-ibm-plex-sans), sans-serif", color: "var(--text)", minWidth: 20, textAlign: "center" }}>{rangeFrom}</span>
                      <button onClick={() => setLayerRange([Math.min(rangeTo, rangeFrom + 1), rangeTo])} style={stepperBtn}>+</button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-ibm-plex-sans), sans-serif", width: 22 }}>to</span>
                      <button onClick={() => setLayerRange([rangeFrom, Math.max(rangeFrom, rangeTo - 1)])} style={stepperBtn}>−</button>
                      <span style={{ fontSize: 9, fontFamily: "var(--font-ibm-plex-sans), sans-serif", color: "var(--text)", minWidth: 20, textAlign: "center" }}>{rangeTo}</span>
                      <button onClick={() => setLayerRange([rangeFrom, Math.min(nLayers - 1, rangeTo + 1)])} style={stepperBtn}>+</button>
                    </div>
                  </div>

                  <button
                    onClick={() => { setStride(1); setLayerRange(null); }}
                    style={{ fontSize: 9, padding: "3px 0", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", textAlign: "left", fontFamily: "var(--font-ibm-plex-sans), sans-serif" }}
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
        <div style={{ display: "flex", flexDirection: "column", padding: "12px 14px", gap: 10, minHeight: 110 }}>
          <CardLoadingHeader gpuTier={card.gpuTier} elapsedMs={elapsedMs} />
          <CardLoadingState
            stage={stageLabel(card.loadingStage, elapsedMs, STAGE_LABELS)}
            warmup={!card.loadingStage && elapsedMs > 30_000}
          />
        </div>
      )}

      {card.status === "error" && <CardErrorState message={card.error ?? undefined} showBuyCredits={card.showBuyCredits} />}

      {card.status === "result" && card.data && (
        <div style={{ overflowY: "auto", overflowX: "hidden", padding: 6, background: "var(--card)" }}>
          <div style={{ display: "inline-flex", flexDirection: "column", gap: rowGap }}>
            {/* X-axis labels */}
            <div style={{ display: "flex", gap: COL_GAP }}>
              <div style={{ width: Y_LABEL_W, flexShrink: 0 }} />
              {card.data.x_labels.map((token, i) => (
                <div
                  key={i}
                  onClick={() => canPin && handleColClick(i)}
                  style={{
                    width: cellWidth,
                    flexShrink: 0,
                    fontSize: 7,
                    textAlign: "center",
                    fontFamily: "var(--font-ibm-plex-sans), sans-serif",
                    color: pinnedCol === i ? "var(--accent)" : "var(--text-muted)",
                    fontWeight: pinnedCol === i ? 700 : 400,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    paddingBottom: 4,
                    cursor: canPin ? "pointer" : "default",
                    boxSizing: "border-box",
                  }}
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

              return (
                <div
                  key={layerName}
                  style={{ display: "flex", alignItems: "center", gap: COL_GAP }}
                  onMouseEnter={() => pinnedCol !== null && setActiveLayer(yIndex)}
                >
                  <div style={{
                    width: Y_LABEL_W,
                    flexShrink: 0,
                    fontSize: 9,
                    fontFamily: "var(--font-ibm-plex-sans), sans-serif",
                    paddingRight: 4,
                    textAlign: "right",
                    overflow: "hidden",
                    color: pinnedCol !== null && activeLayer === yIndex ? "var(--accent)" : "var(--text-muted)",
                    fontWeight: pinnedCol !== null && activeLayer === yIndex ? 700 : 400,
                  }}>
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
                        <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>
                          <span style={{ color: "var(--text)", fontWeight: 600 }}>{xLabel}</span>{" · "}layer {yIndex}
                        </div>
                        <div>rank <span style={{ fontWeight: 600 }}>#{rank}</span></div>
                      </>
                    ) : inEntropyMode && entropy !== null ? (
                      <>
                        <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>
                          <span style={{ color: "var(--text)", fontWeight: 600 }}>{xLabel}</span>{" · "}layer {yIndex}
                        </div>
                        <div style={{ fontVariantNumeric: "tabular-nums" }}>H = <span style={{ fontWeight: 600 }}>{entropy.toFixed(3)}</span> nats</div>
                      </>
                    ) : inKlMode && klVal !== null ? (
                      <>
                        <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>
                          <span style={{ color: "var(--text)", fontWeight: 600 }}>{xLabel}</span>{" · "}layer {yIndex}
                        </div>
                        <div style={{ fontVariantNumeric: "tabular-nums" }}>KL = <span style={{ fontWeight: 600 }}>{klVal.toFixed(3)}</span> nats</div>
                      </>
                    ) : inTokensMode && card.data!.topk_tokens && card.data!.topk_probs ? (
                      <>
                        <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>
                          <span style={{ color: "var(--text)", fontWeight: 600 }}>{xLabel}</span>{" · "}layer {yIndex}
                        </div>
                        {card.data!.topk_tokens[yIndex][xIndex].map((t, i) => (
                          <div key={i} style={{ display: "flex", gap: 10, fontVariantNumeric: "tabular-nums" }}>
                            <span style={{ color: "var(--text-muted)", minWidth: 30, textAlign: "right" }}>
                              {(card.data!.topk_probs![yIndex][xIndex][i] * 100).toFixed(1)}%
                            </span>
                            <span style={{ fontWeight: i === 0 ? 600 : 400 }}>{JSON.stringify(t)}</span>
                          </div>
                        ))}
                      </>
                    ) : (
                      <>
                        <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>
                          <span style={{ color: "var(--text)", fontWeight: 600 }}>{xLabel}</span>{" · "}layer {yIndex}
                        </div>
                        <div style={{ fontVariantNumeric: "tabular-nums" }}>p = <span style={{ fontWeight: 600 }}>{(prob * 100).toFixed(2)}%</span></div>
                      </>
                    );

                    return (
                      <div
                        key={`${yIndex}-${xIndex}`}
                        onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, content: tooltipContent })}
                        onMouseLeave={() => setTooltip(null)}
                        style={{
                          width: cellWidth,
                          height: cellHeight,
                          flexShrink: 0,
                          backgroundColor: cellBg,
                          border: cellBorder,
                          display: (inTokensMode || showRankNumber) ? "flex" : undefined,
                          alignItems: (inTokensMode || showRankNumber) ? "center" : undefined,
                          justifyContent: (inTokensMode || showRankNumber) ? "center" : undefined,
                          borderRadius: 2,
                          overflow: "hidden",
                          cursor: canPin ? "pointer" : "default",
                          boxSizing: "border-box",
                        }}
                        onClick={() => canPin && handleColClick(xIndex)}
                      >
                        {inTokensMode && topToken !== null && (
                          <span style={{ fontSize: 7, fontFamily: "var(--font-ibm-plex-sans), sans-serif", lineHeight: 1, color: getContrastColor(palette, topProb), maxWidth: "100%", overflow: "hidden", whiteSpace: "nowrap" }}>
                            {topToken}
                          </span>
                        )}
                        {showRankNumber && !inTokensMode && (
                          <span style={{ fontSize: 7, fontFamily: "var(--font-ibm-plex-sans), sans-serif", lineHeight: 1, color: getContrastColor(palette, cellColorValue), maxWidth: "100%", overflow: "hidden", whiteSpace: "nowrap" }}>
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

const stepperBtn: React.CSSProperties = {
  fontSize: 10,
  width: 18,
  height: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--surface-border)",
  border: "1px solid var(--card-border)",
  borderRadius: 3,
  cursor: "pointer",
  color: "var(--text-muted)",
  flexShrink: 0,
  padding: 0,
  lineHeight: 1,
};

export default React.memo(LensCard);
