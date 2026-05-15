"use client";

import React from "react";
import { usePalette } from "../hooks/usePalette";
import { interpolateColor, getContrastColor } from "../lib/palette";
import { TIER_LABELS } from "../lib/tiers";

type HeatmapData = {
  x_labels: string[];
  y_labels: string[];
  heatmap_data: number[][];
  topk_tokens?: string[][][];
  topk_probs?: number[][][];
  kl_data?: number[][];
};

export type LensCardData = {
  id: string;
  cardType?: "logit-lens";
  status: "loading" | "result" | "error";
  modelName: string;
  prompt: string;
  data: HeatmapData | null;
  error: string | null;
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
};


// approximate char width at 7px Azeret Mono
const CHAR_W = 4.5;
const CELL_PAD = 6;
const MIN_CELL_W = 20;
const MAX_CELL_W = 48;
const Y_LABEL_W = 28;
const COL_GAP = 2;

function computeCellWidth(xLabels: string[]): number {
  const maxLen = Math.max(...xLabels.map(t => t.length));
  return Math.max(MIN_CELL_W, Math.min(MAX_CELL_W, Math.ceil(maxLen * CHAR_W) + CELL_PAD));
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function getStageLabel(stage: string | undefined, elapsedMs: number): string {
  switch (stage) {
    case "tokenizing":   return "Tokenizing…";
    case "forward_pass": return "Running forward pass";
    case "computing":    return "Computing logit lens";
  }
  return elapsedMs > 30_000 ? "GPU container is starting…" : "Connecting to GPU…";
}

function LensCard({
  card,
  ref,
  onStartDrag,
  onDragMove,
  onDragEnd,
  onRemove,
}: LensCardProps) {
  const palette = usePalette();
  const [mode, setMode] = React.useState<"prob" | "tokens" | "kl">("prob");
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [pinnedCol, setPinnedCol] = React.useState<number | null>(null);
  const [activeLayer, setActiveLayer] = React.useState(0);
  const [headerHovered, setHeaderHovered] = React.useState(false);

  React.useEffect(() => {
    if (card.status !== "loading") return;
    const start = card.startedAt ?? Date.now();
    setElapsedMs(Date.now() - start);
    const id = setInterval(() => setElapsedMs(Date.now() - start), 1000);
    return () => clearInterval(id);
  }, [card.status, card.startedAt]);

  React.useEffect(() => {
    if (card.data) setActiveLayer(card.data.y_labels.length - 1);
  }, [card.data]);

  const canToggle = card.status === "result" && card.data?.topk_tokens != null;
  const canPin = card.status === "result" && card.data?.topk_tokens != null;
  const hasKl = card.data?.kl_data != null;
  const cellWidth = card.data ? computeCellWidth(card.data.x_labels) : 24;
  const rowGap = mode === "tokens" && card.data?.topk_tokens != null ? 2 : 0;
  // 6px padding on each side of the heatmap body; COL_GAP between every flex child
  const heatmapPx = card.data
    ? Y_LABEL_W + (cellWidth + COL_GAP) * card.data.x_labels.length + 12
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

  return (
    <div
      ref={ref}
      data-card-id={card.id}
      style={{
        position: "absolute",
        left: card.position.x,
        top: card.position.y,
        zIndex: pinnedCol !== null ? 20 : 10,
        background: "var(--color-card)",
        borderRadius: 8,
        border: "1px solid var(--color-card-border)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        display: "flex",
        flexDirection: "column",
        ...(card.status === "loading" ? { width: 280, height: 200 } : {}),
        ...(card.status === "error" ? { width: 280 } : {}),
        ...(card.status === "result" && heatmapPx ? { width: heatmapPx } : {}),
      }}
    >
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(3px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Hover popup — floats above the card on header hover */}
      {headerHovered && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: 0,
            background: "var(--color-card)",
            border: "1px solid var(--color-card-border)",
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
          <p style={{
            fontSize: 11,
            fontWeight: 600,
            margin: 0,
            color: "var(--color-text)",
            fontFamily: "var(--font-azeret-mono), monospace",
            wordBreak: "break-all",
          }}>
            {card.modelName}
          </p>
          <p style={{
            fontSize: 10,
            color: "var(--color-text-muted)",
            margin: "5px 0 0",
            lineHeight: 1.5,
            fontFamily: "var(--font-azeret-mono), monospace",
            wordBreak: "break-word",
          }}>
            {card.prompt}
          </p>
          {card.gpuTier && (
            <span style={{
              display: "inline-block",
              marginTop: 6,
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.06em",
              color: "var(--color-accent)",
              background: "var(--color-surface-border)",
              border: "1px solid var(--color-card-border)",
              borderRadius: 3,
              padding: "1px 5px",
            }}>
              {TIER_LABELS[card.gpuTier] ?? card.gpuTier}
            </span>
          )}
        </div>
      )}

      {/* Focus panel — slides out to the left when a column is pinned */}
      {panelData && (
        <div
          style={{
            position: "absolute",
            right: "calc(100% + 8px)",
            top: 0,
            width: 180,
            background: "var(--color-card)",
            border: "1px solid var(--color-card-border)",
            borderRadius: 8,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            padding: "8px 10px",
            animation: "slideInLeft 140ms ease-out",
          }}
        >
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 8,
            gap: 4,
          }}>
            <span style={{
              fontFamily: "var(--font-azeret-mono), monospace",
              fontSize: 11,
              fontWeight: 700,
              color: "var(--color-accent)",
              background: "var(--color-surface-border)",
              border: "1px solid var(--color-card-border)",
              borderRadius: 3,
              padding: "1px 5px",
              maxWidth: 90,
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
              flexShrink: 0,
            }}>
              {panelData.colLabel}
            </span>
            <span style={{ fontSize: 9, color: "var(--color-text-muted)", fontFamily: "var(--font-azeret-mono), monospace", flexShrink: 0 }}>
              layer {panelData.layerLabel}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {panelData.tokens.map((tok, i) => {
              const prob = panelData.probs[i];
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{
                    width: 48,
                    fontFamily: "var(--font-azeret-mono), monospace",
                    fontSize: 9,
                    color: "var(--color-text)",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    flexShrink: 0,
                    textAlign: "right",
                  }}>
                    {JSON.stringify(tok)}
                  </span>
                  <div style={{ flex: 1, height: 8, background: "var(--color-surface-border)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{
                      width: `${prob * 100}%`,
                      height: "100%",
                      background: i === 0 ? "var(--color-accent)" : "var(--color-card-border)",
                      borderRadius: 2,
                      transition: "width 120ms ease-out",
                    }} />
                  </div>
                  <span style={{
                    width: 30,
                    fontSize: 9,
                    color: "var(--color-text-muted)",
                    textAlign: "right",
                    flexShrink: 0,
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {(prob * 100).toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>

          <p style={{ fontSize: 8, color: "var(--color-surface-border)", margin: "8px 0 0", textAlign: "center" }}>
            hover rows to change layer
          </p>
        </div>
      )}

      {/* Drag handle / header */}
      <div
        onPointerDown={e => onStartDrag(e, card.id, card.position)}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onMouseEnter={() => setHeaderHovered(true)}
        onMouseLeave={() => setHeaderHovered(false)}
        style={{
          padding: "7px 10px",
          borderBottom: "1px solid var(--color-surface-border)",
          display: "flex",
          alignItems: "center",
          gap: 6,
          cursor: "grab",
          userSelect: "none",
          flexShrink: 0,
          borderRadius: "8px 8px 0 0",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        <svg width="8" height="12" viewBox="0 0 8 12" fill="none" style={{ opacity: 0.3, flexShrink: 0 }}>
          <circle cx="2" cy="2" r="1.2" fill="currentColor" />
          <circle cx="6" cy="2" r="1.2" fill="currentColor" />
          <circle cx="2" cy="6" r="1.2" fill="currentColor" />
          <circle cx="6" cy="6" r="1.2" fill="currentColor" />
          <circle cx="2" cy="10" r="1.2" fill="currentColor" />
          <circle cx="6" cy="10" r="1.2" fill="currentColor" />
        </svg>
        <span style={{ fontSize: 11, color: "var(--color-text)", fontWeight: 600, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {card.modelName}
        </span>
        <span style={{ fontSize: 10, color: "var(--color-text-muted)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {card.prompt}
        </span>

        {canToggle && (
          <div
            onPointerDown={e => e.stopPropagation()}
            style={{ display: "flex", border: "1px solid var(--color-card-border)", borderRadius: 4, overflow: "hidden", flexShrink: 0 }}
          >
            {(["prob", "tokens", ...(hasKl ? ["kl"] : [])] as ("prob" | "tokens" | "kl")[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  fontSize: 9,
                  padding: "2px 6px",
                  background: mode === m ? "var(--color-accent)" : "transparent",
                  color: mode === m ? "var(--color-accent-fg)" : "var(--color-text-muted)",
                  border: "none",
                  cursor: "pointer",
                  lineHeight: 1.4,
                }}
              >
                {m === "prob" ? "Prob" : m === "tokens" ? "Tokens" : "KL"}
              </button>
            ))}
          </div>
        )}

        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={() => onRemove(card.id)}
          style={{ fontSize: 12, color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer", padding: "0 2px", flexShrink: 0, lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      {/* Body */}
      {card.status === "loading" && (
        <div style={{ display: "flex", flexDirection: "column", padding: "12px 14px", gap: 10, minHeight: 110 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {card.gpuTier ? (
              <span style={{
                fontSize: 9, fontWeight: 600, letterSpacing: "0.06em",
                color: "var(--color-accent)", background: "var(--color-surface-border)",
                border: "1px solid var(--color-card-border)", borderRadius: 3,
                padding: "1px 5px",
              }}>
                {TIER_LABELS[card.gpuTier] ?? card.gpuTier}
              </span>
            ) : <span />}
            <span style={{ fontSize: 10, color: "var(--color-text-muted)", fontFamily: "var(--font-azeret-mono), monospace", fontVariantNumeric: "tabular-nums" }}>
              {formatElapsed(elapsedMs)}
            </span>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <div style={{
              width: 20, height: 20,
              border: "2px solid var(--color-surface-border)",
              borderTopColor: "var(--color-accent)",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }} />
            <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: 0 }}>
              {getStageLabel(card.loadingStage, elapsedMs)}
            </p>
          </div>

          {!card.loadingStage && elapsedMs > 30_000 && (
            <p style={{ fontSize: 10, color: "var(--color-text-muted)", margin: 0, textAlign: "center", lineHeight: 1.5 }}>
              First run warms the GPU container — large models can take up to 2 min.
            </p>
          )}
        </div>
      )}

      {card.status === "error" && (
        <div style={{ padding: "12px 14px" }}>
          <p style={{ fontSize: 11, color: "#dc2626" }}>✗ {card.error ?? "Unknown error"}</p>
        </div>
      )}

      {card.status === "result" && card.data && (
        <div style={{ overflow: "auto", padding: 6 }}>
          <div style={{ display: "inline-flex", flexDirection: "column", gap: rowGap }}>
            {/* X-axis labels — flat, no rotation, width tracks longest token */}
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
                    fontFamily: "var(--font-azeret-mono), monospace",
                    color: pinnedCol === i ? "var(--color-accent)" : "var(--color-text-muted)",
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

            {/* Heatmap rows — inTokensMode/inKlMode/klMax computed once outside the cell loops */}
            {card.data.y_labels.map((layerName, yIndex) => {
              const inTokensMode = mode === "tokens" && card.data!.topk_tokens != null;
              const inKlMode = mode === "kl" && card.data!.kl_data != null;
              const klMax = inKlMode
                ? Math.min(Math.max(...card.data!.kl_data![yIndex], 1e-6), 5)
                : 1;
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
                  fontFamily: "var(--font-azeret-mono), monospace",
                  paddingRight: 4,
                  textAlign: "right",
                  overflow: "hidden",
                  color: pinnedCol !== null && activeLayer === yIndex ? "var(--color-accent)" : "var(--color-text-muted)",
                  fontWeight: pinnedCol !== null && activeLayer === yIndex ? 700 : 400,
                }}>
                  {String(yIndex)}
                </div>
                {card.data!.heatmap_data[yIndex].map((prob, xIndex) => {
                  const topProb = inTokensMode ? card.data!.topk_probs![yIndex][xIndex][0] : prob;
                  const topToken = inTokensMode ? card.data!.topk_tokens![yIndex][xIndex][0] : null;
                  const isPinned = pinnedCol === xIndex;
                  const isActivePinnedCell = isPinned && activeLayer === yIndex;

                  const klVal = inKlMode ? card.data!.kl_data![yIndex][xIndex] : null;
                  const klNorm = klVal !== null ? Math.min(klVal / klMax, 1) : 0;

                  const tooltipText = inKlMode
                    ? `Token: ${card.data!.x_labels[xIndex]}\nLayer: ${yIndex}\nKL from final: ${klVal!.toFixed(3)} nats`
                    : inTokensMode
                    ? `Top predictions at "${card.data!.x_labels[xIndex]}", layer ${yIndex}:\n${
                        card.data!.topk_tokens![yIndex][xIndex]
                          .map((t, i) => `${(card.data!.topk_probs![yIndex][xIndex][i] * 100).toFixed(1)}%  ${JSON.stringify(t)}`)
                          .join("\n")
                      }`
                    : `Token: ${card.data!.x_labels[xIndex]}\nLayer: ${yIndex}\nProb: ${(prob * 100).toFixed(2)}%`;

                  const cellBg = inKlMode
                    ? interpolateColor(palette, klNorm)
                    : interpolateColor(palette, topProb);
                  const cellBorder = isActivePinnedCell
                    ? "1.5px solid var(--color-accent)"
                    : isPinned
                    ? "0.5px solid var(--color-card-border)"
                    : "0.5px solid var(--color-surface-border)";

                  return (
                    <div
                      key={`${yIndex}-${xIndex}`}
                      title={tooltipText}
                      style={{
                        width: cellWidth,
                        height: cellHeight,
                        flexShrink: 0,
                        backgroundColor: cellBg,
                        border: cellBorder,
                        display: inTokensMode ? "flex" : undefined,
                        alignItems: inTokensMode ? "center" : undefined,
                        justifyContent: inTokensMode ? "center" : undefined,
                        borderRadius: 2,
                        overflow: "hidden",
                        cursor: canPin ? "pointer" : "default",
                        boxSizing: "border-box",
                      }}
                      onClick={() => canPin && handleColClick(xIndex)}
                    >
                      {inTokensMode && topToken !== null && (
                        <span style={{
                          fontSize: 7,
                          fontFamily: "var(--font-azeret-mono), monospace",
                          lineHeight: 1,
                          color: getContrastColor(palette, topProb),
                          maxWidth: "100%",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                        }}>
                          {topToken}
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
    </div>
  );
}

export default React.memo(LensCard);
