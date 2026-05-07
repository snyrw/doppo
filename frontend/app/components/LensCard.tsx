"use client";

import React from "react";

type HeatmapData = {
  x_labels: string[];
  y_labels: string[];
  heatmap_data: number[][];
  topk_tokens?: string[][][];
  topk_probs?: number[][][];
};

export type LensCardData = {
  id: string;
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

const TIER_LABELS: Record<string, string> = {
  tl_small: "L4",
  tl_medium: "A10G",
  tl_large: "A100-80GB",
};

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

function simplifyLayerLabel(raw: string): string {
  if (raw === "embedding") return "emb";
  const match = raw.match(/\.(\d+)\./);
  return match ? match[1] : raw;
}

export default function LensCard({
  card,
  ref,
  onStartDrag,
  onDragMove,
  onDragEnd,
  onRemove,
}: LensCardProps) {
  const [mode, setMode] = React.useState<"prob" | "tokens">("prob");
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [pinnedCol, setPinnedCol] = React.useState<number | null>(null);
  const [activeLayer, setActiveLayer] = React.useState(0);

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

  const shortPrompt = card.prompt.length > 38 ? card.prompt.slice(0, 38) + "…" : card.prompt;
  const canToggle = card.status === "result" && card.data?.topk_tokens != null;
  const canPin = card.status === "result" && card.data?.topk_tokens != null;

  const handleColClick = (i: number) => {
    setPinnedCol(prev => (prev === i ? null : i));
  };

  const panelData =
    pinnedCol !== null && card.data?.topk_tokens
      ? {
          tokens: card.data.topk_tokens[activeLayer][pinnedCol],
          probs: card.data.topk_probs![activeLayer][pinnedCol],
          colLabel: card.data.x_labels[pinnedCol],
          layerLabel: simplifyLayerLabel(card.data.y_labels[activeLayer]),
        }
      : null;

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: card.position.x,
        top: card.position.y,
        zIndex: pinnedCol !== null ? 20 : 10,
        background: "#161b22",
        borderRadius: 8,
        border: "1px solid #30363d",
        boxShadow: "0 4px 16px rgba(0,0,0,0.4), 0 0 0 1px rgba(88,166,255,0.04)",
        display: "flex",
        flexDirection: "column",
        ...(card.status === "loading" ? { width: 280, height: 200 } : {}),
        ...(card.status === "error" ? { width: 280 } : {}),
      }}
    >
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* Focus panel — slides out to the left when a column is pinned */}
      {panelData && (
        <div
          style={{
            position: "absolute",
            right: "calc(100% + 8px)",
            top: 0,
            width: 180,
            background: "#1c2128",
            border: "1px solid #30363d",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            padding: "8px 10px",
            animation: "slideInLeft 140ms ease-out",
          }}
        >
          {/* Header */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 8,
            gap: 4,
          }}>
            <span style={{
              fontFamily: "monospace",
              fontSize: 11,
              fontWeight: 700,
              color: "#79c0ff",
              background: "#111d2e",
              border: "1px solid #1f6feb",
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
            <span style={{ fontSize: 9, color: "#484f58", fontFamily: "monospace", flexShrink: 0 }}>
              layer {panelData.layerLabel}
            </span>
          </div>

          {/* Bar chart */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {panelData.tokens.map((tok, i) => {
              const prob = panelData.probs[i];
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{
                    width: 48,
                    fontFamily: "monospace",
                    fontSize: 9,
                    color: "#e6edf3",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    flexShrink: 0,
                    textAlign: "right",
                  }}>
                    {JSON.stringify(tok)}
                  </span>
                  <div style={{ flex: 1, height: 8, background: "#21262d", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{
                      width: `${prob * 100}%`,
                      height: "100%",
                      background: i === 0 ? "#58a6ff" : "#1f6feb",
                      borderRadius: 2,
                      transition: "width 120ms ease-out",
                    }} />
                  </div>
                  <span style={{
                    width: 30,
                    fontSize: 9,
                    color: "#7d8590",
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

          {/* Hint */}
          <p style={{ fontSize: 8, color: "#484f58", margin: "8px 0 0", textAlign: "center" }}>
            hover rows to change layer
          </p>
        </div>
      )}

      {/* Drag handle / header */}
      <div
        onPointerDown={e => onStartDrag(e, card.id, card.position)}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        style={{
          padding: "7px 10px",
          borderBottom: "1px solid #21262d",
          display: "flex",
          alignItems: "center",
          gap: 6,
          cursor: "grab",
          userSelect: "none",
          flexShrink: 0,
          borderRadius: "8px 8px 0 0",
        }}
      >
        <svg width="8" height="12" viewBox="0 0 8 12" fill="none" style={{ opacity: 0.3, flexShrink: 0 }}>
          <circle cx="2" cy="2" r="1.2" fill="#7d8590" />
          <circle cx="6" cy="2" r="1.2" fill="#7d8590" />
          <circle cx="2" cy="6" r="1.2" fill="#7d8590" />
          <circle cx="6" cy="6" r="1.2" fill="#7d8590" />
          <circle cx="2" cy="10" r="1.2" fill="#7d8590" />
          <circle cx="6" cy="10" r="1.2" fill="#7d8590" />
        </svg>
        <span style={{ fontSize: 11, color: "#e6edf3", fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {card.modelName}
        </span>
        <span style={{ fontSize: 10, color: "#7d8590", flex: "0 0 auto", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {shortPrompt}
        </span>

        {/* Prob / Tokens mode toggle */}
        {canToggle && (
          <div
            onPointerDown={e => e.stopPropagation()}
            style={{ display: "flex", border: "1px solid #30363d", borderRadius: 4, overflow: "hidden", flexShrink: 0 }}
          >
            {(["prob", "tokens"] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  fontSize: 9,
                  padding: "2px 6px",
                  background: mode === m ? "#58a6ff" : "transparent",
                  color: mode === m ? "#0d1117" : "#484f58",
                  border: "none",
                  cursor: "pointer",
                  lineHeight: 1.4,
                  fontFamily: "inherit",
                }}
              >
                {m === "prob" ? "Prob" : "Tokens"}
              </button>
            ))}
          </div>
        )}

        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={() => onRemove(card.id)}
          style={{ fontSize: 12, color: "#484f58", background: "none", border: "none", cursor: "pointer", padding: "0 2px", flexShrink: 0, lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      {/* Body */}
      {card.status === "loading" && (
        <div style={{ display: "flex", flexDirection: "column", padding: "12px 14px", gap: 10, minHeight: 110 }}>
          {/* GPU tier + elapsed timer */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {card.gpuTier ? (
              <span style={{
                fontSize: 9, fontWeight: 600, letterSpacing: "0.06em",
                color: "#58a6ff", background: "#111d2e",
                border: "1px solid #1f6feb", borderRadius: 3,
                padding: "1px 5px",
              }}>
                {TIER_LABELS[card.gpuTier] ?? card.gpuTier}
              </span>
            ) : <span />}
            <span style={{ fontSize: 10, color: "#484f58", fontFamily: "monospace", fontVariantNumeric: "tabular-nums" }}>
              {formatElapsed(elapsedMs)}
            </span>
          </div>

          {/* Spinner + stage label */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <div style={{
              width: 20, height: 20,
              border: "2px solid #21262d",
              borderTopColor: "#58a6ff",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }} />
            <p style={{ fontSize: 11, color: "#7d8590", margin: 0 }}>
              {getStageLabel(card.loadingStage, elapsedMs)}
            </p>
          </div>

          {!card.loadingStage && elapsedMs > 30_000 && (
            <p style={{ fontSize: 10, color: "#484f58", margin: 0, textAlign: "center", lineHeight: 1.5 }}>
              First run warms the GPU container — large models can take up to 2 min.
            </p>
          )}
        </div>
      )}

      {card.status === "error" && (
        <div style={{ padding: "12px 14px" }}>
          <p style={{ fontSize: 11, color: "#f85149" }}>✗ {card.error ?? "Unknown error"}</p>
        </div>
      )}

      {card.status === "result" && card.data && (
        <div style={{ overflow: "auto", padding: 6 }}>
          <div style={{ display: "inline-block" }}>
            {/* X-axis labels */}
            <div style={{ display: "flex" }}>
              <div style={{ width: 32, flexShrink: 0 }} />
              {card.data.x_labels.map((token, i) => (
                <div
                  key={i}
                  onClick={() => canPin && handleColClick(i)}
                  style={{
                    width: 24,
                    flexShrink: 0,
                    fontSize: 9,
                    textAlign: "center",
                    fontFamily: "monospace",
                    color: pinnedCol === i ? "#58a6ff" : "#7d8590",
                    fontWeight: pinnedCol === i ? 700 : 400,
                    transform: "rotate(-45deg)",
                    transformOrigin: "bottom left",
                    paddingBottom: 6,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    cursor: canPin ? "pointer" : "default",
                  }}
                >
                  {token}
                </div>
              ))}
            </div>

            {/* Heatmap rows */}
            {card.data.y_labels.map((layerName, yIndex) => (
              <div
                key={layerName}
                style={{ display: "flex", alignItems: "center" }}
                onMouseEnter={() => pinnedCol !== null && setActiveLayer(yIndex)}
              >
                <div style={{
                  width: 32,
                  flexShrink: 0,
                  fontSize: 9,
                  fontFamily: "monospace",
                  paddingRight: 4,
                  textAlign: "right",
                  color: pinnedCol !== null && activeLayer === yIndex ? "#58a6ff" : "#484f58",
                  fontWeight: pinnedCol !== null && activeLayer === yIndex ? 700 : 400,
                }}>
                  {simplifyLayerLabel(layerName)}
                </div>
                {card.data!.heatmap_data[yIndex].map((prob, xIndex) => {
                  const inTokensMode = mode === "tokens" && card.data!.topk_tokens != null;
                  const topProb = inTokensMode ? card.data!.topk_probs![yIndex][xIndex][0] : prob;
                  const topToken = inTokensMode ? card.data!.topk_tokens![yIndex][xIndex][0] : null;
                  const cellHeight = inTokensMode ? 20 : 12;
                  const isPinned = pinnedCol === xIndex;
                  const isActivePinnedCell = isPinned && activeLayer === yIndex;

                  const tooltipText = inTokensMode
                    ? `Top predictions at "${card.data!.x_labels[xIndex]}", ${layerName}:\n${
                        card.data!.topk_tokens![yIndex][xIndex]
                          .map((t, i) => `${(card.data!.topk_probs![yIndex][xIndex][i] * 100).toFixed(1)}%  ${JSON.stringify(t)}`)
                          .join("\n")
                      }`
                    : `Token: ${card.data!.x_labels[xIndex]}\nLayer: ${layerName}\nProb: ${(prob * 100).toFixed(2)}%`;

                  return (
                    <div
                      key={`${yIndex}-${xIndex}`}
                      title={tooltipText}
                      style={{
                        width: 24,
                        height: cellHeight,
                        flexShrink: 0,
                        backgroundColor: `rgba(88, 166, 255, ${topProb})`,
                        border: isActivePinnedCell
                          ? "1.5px solid #58a6ff"
                          : isPinned
                          ? "0.5px solid rgba(88,166,255,0.4)"
                          : "0.5px solid rgba(33,38,45,0.5)",
                        display: inTokensMode ? "flex" : undefined,
                        alignItems: inTokensMode ? "center" : undefined,
                        justifyContent: inTokensMode ? "center" : undefined,
                        overflow: "hidden",
                        cursor: canPin ? "pointer" : "default",
                        boxSizing: "border-box",
                      }}
                      onClick={() => canPin && handleColClick(xIndex)}
                    >
                      {inTokensMode && topToken !== null && (
                        <span style={{
                          fontSize: 7,
                          fontFamily: "monospace",
                          lineHeight: 1,
                          color: topProb > 0.5 ? "#0d1117" : "#e6edf3",
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
