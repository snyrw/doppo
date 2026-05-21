"use client";

import React from "react";
import { getHeadColor } from "../lib/palette";
import { TIER_LABELS } from "../lib/tiers";
import { CardDragHandle, CardLoadingState, CardErrorState, formatElapsed } from "./CardShell";

export type AttentionData = {
  tokens: string[];
  patterns: number[][][][];  // [n_layers][n_heads][seq][seq]
  n_layers: number;
  n_heads: number;
  truncated: boolean;
};

export type AttentionCardData = {
  id: string;
  cardType: "attention-pattern";
  status: "loading" | "result" | "error";
  modelName: string;
  prompt: string;
  data: AttentionData | null;
  error: string | null;
  position: { x: number; y: number };
  gpuTier?: string;
  startedAt?: number;
  loadingStage?: string;
};

type AttentionCardProps = {
  card: AttentionCardData;
  ref?: React.Ref<HTMLDivElement>;
  onStartDrag: (e: React.PointerEvent<HTMLDivElement>, cardId: string, pos: { x: number; y: number }) => void;
  onDragMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDragEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
  onRemove: (id: string) => void;
};

const CELL_SIZE = 10;
const Y_LABEL_W = 42;
const X_LABEL_H = 40;

type SelectedCell = { q: number; k: number } | null;

const AttentionMatrix = React.memo(function AttentionMatrix({
  headIdx,
  nHeads,
  pattern,
  tokens,
  selectedCell,
  onCellClick,
}: {
  headIdx: number;
  nHeads: number;
  pattern: number[][];
  tokens: string[];
  selectedCell: SelectedCell;
  onCellClick: (q: number, k: number) => void;
}) {
  const colors = React.useMemo(
    () => pattern.map(row => row.map(w => getHeadColor(headIdx, nHeads, w))),
    [pattern, headIdx, nHeads],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{
        height: 14,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 8,
        fontFamily: "var(--font-azeret-mono), monospace",
        color: "var(--color-text-muted)",
        marginBottom: 2,
      }}>
        H{headIdx}
      </div>

      <div style={{ display: "flex" }}>
        <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ height: X_LABEL_H }} />
          {tokens.map((tok, qi) => (
            <div
              key={qi}
              style={{
                width: Y_LABEL_W,
                height: CELL_SIZE,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                paddingRight: 3,
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              <span style={{
                fontSize: 6,
                fontFamily: "var(--font-azeret-mono), monospace",
                color: "var(--color-text-muted)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: Y_LABEL_W - 4,
              }}>
                {tok}
              </span>
            </div>
          ))}
        </div>

        <div style={{ flexShrink: 0 }}>
          <div style={{ display: "flex", height: X_LABEL_H, alignItems: "flex-end" }}>
            {tokens.map((tok, ki) => (
              <div
                key={ki}
                style={{
                  width: CELL_SIZE,
                  height: X_LABEL_H,
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  overflow: "visible",
                  flexShrink: 0,
                }}
              >
                <span style={{
                  fontSize: 6,
                  fontFamily: "var(--font-azeret-mono), monospace",
                  color: "var(--color-text-muted)",
                  whiteSpace: "nowrap",
                  transform: "rotate(-45deg)",
                  transformOrigin: "bottom center",
                  display: "block",
                  maxWidth: 28,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>
                  {tok}
                </span>
              </div>
            ))}
          </div>

          {pattern.map((row, qi) => (
            <div key={qi} style={{ display: "flex" }}>
              {row.map((weight, ki) => {
                const isSelected = selectedCell?.q === qi && selectedCell?.k === ki;
                return (
                  <div
                    key={ki}
                    onPointerDown={e => e.stopPropagation()}
                    onClick={() => onCellClick(qi, ki)}
                    title={`H${headIdx}: "${tokens[qi]}" → "${tokens[ki]}" = ${weight.toFixed(3)}`}
                    style={{
                      width: CELL_SIZE,
                      height: CELL_SIZE,
                      background: colors[qi][ki],
                      boxSizing: "border-box",
                      cursor: "pointer",
                      outline: isSelected ? "1.5px solid var(--color-text)" : "none",
                      outlineOffset: "-1px",
                      position: "relative",
                      zIndex: isSelected ? 1 : 0,
                      flexShrink: 0,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

function AttentionCard({
  card,
  ref,
  onStartDrag,
  onDragMove,
  onDragEnd,
  onRemove,
}: AttentionCardProps) {
  const [currentLayer, setCurrentLayer] = React.useState(0);
  const [selectedCell, setSelectedCell] = React.useState<SelectedCell>(null);
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [headerHovered, setHeaderHovered] = React.useState(false);

  React.useEffect(() => {
    if (card.status !== "loading") return;
    const start = card.startedAt ?? Date.now();
    setElapsedMs(Date.now() - start);
    const id = setInterval(() => setElapsedMs(Date.now() - start), 1000);
    return () => clearInterval(id);
  }, [card.status, card.startedAt]);

  React.useEffect(() => {
    setCurrentLayer(0);
    setSelectedCell(null);
  }, [card.data]);

  const nLayers = card.data?.n_layers ?? 0;

  function handleCellClick(q: number, k: number) {
    setSelectedCell(prev => (prev?.q === q && prev?.k === k ? null : { q, k }));
  }

  return (
    <div
      ref={ref}
      data-card-id={card.id}
      style={{
        position: "absolute",
        left: card.position.x,
        top: card.position.y,
        zIndex: 10,
        background: "var(--color-card)",
        borderRadius: 8,
        border: "1px solid var(--color-card-border)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        display: "flex",
        flexDirection: "column",
        ...(card.status === "loading" ? { width: 280, height: 200 } : {}),
        ...(card.status === "error" ? { width: 280 } : {}),
      }}
    >
      {headerHovered && (
        <div style={{
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
        }}>
          <p style={{ fontSize: 11, fontWeight: 600, margin: 0, color: "var(--color-text)", fontFamily: "var(--font-azeret-mono), monospace", wordBreak: "break-all" }}>
            {card.modelName}
          </p>
          <p style={{ fontSize: 10, color: "var(--color-text-muted)", margin: "5px 0 0", lineHeight: 1.5, fontFamily: "var(--font-azeret-mono), monospace", wordBreak: "break-word" }}>
            {card.prompt}
          </p>
          <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
            {card.gpuTier && (
              <span style={{ fontSize: 9, fontWeight: 600, color: "var(--color-accent)", background: "var(--color-surface-border)", border: "1px solid var(--color-card-border)", borderRadius: 3, padding: "1px 5px" }}>
                {TIER_LABELS[card.gpuTier] ?? card.gpuTier}
              </span>
            )}
            <span style={{ fontSize: 9, fontWeight: 600, color: "var(--color-accent)", background: "var(--color-surface-border)", border: "1px solid var(--color-card-border)", borderRadius: 3, padding: "1px 5px" }}>
              Attn
            </span>
          </div>
        </div>
      )}

      <div
        onPointerDown={e => onStartDrag(e, card.id, card.position)}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onMouseEnter={() => setHeaderHovered(true)}
        onMouseLeave={() => setHeaderHovered(false)}
        style={{
          borderBottom: "1px solid var(--color-surface-border)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          borderRadius: "8px 8px 0 0",
          cursor: "grab",
          userSelect: "none",
        }}
      >
        <div style={{ padding: "7px 10px", display: "flex", alignItems: "center", gap: 6 }}>
          <CardDragHandle />
          <span style={{ fontSize: 11, color: "var(--color-text)", fontWeight: 600, flexShrink: 0 }}>
            {card.modelName}
          </span>
          <span style={{ fontSize: 10, color: "var(--color-text-muted)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {card.prompt}
          </span>
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={() => onRemove(card.id)}
            style={{ fontSize: 12, color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer", padding: "0 2px", flexShrink: 0, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {card.status === "result" && card.data && (
          <div
            onPointerDown={e => e.stopPropagation()}
            style={{
              padding: "4px 10px",
              borderTop: "1px solid var(--color-surface-border)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <button
              onClick={() => setCurrentLayer(l => Math.max(0, l - 1))}
              disabled={currentLayer === 0}
              style={{ fontSize: 12, background: "none", border: "none", cursor: currentLayer === 0 ? "not-allowed" : "pointer", color: currentLayer === 0 ? "var(--color-text-muted)" : "var(--color-text)", padding: "0 4px", lineHeight: 1 }}
            >
              ←
            </button>
            <span style={{ fontSize: 10, fontFamily: "var(--font-azeret-mono), monospace", color: "var(--color-text)", minWidth: 28, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
              L{currentLayer}
            </span>
            <button
              onClick={() => setCurrentLayer(l => Math.min(nLayers - 1, l + 1))}
              disabled={currentLayer === nLayers - 1}
              style={{ fontSize: 12, background: "none", border: "none", cursor: currentLayer === nLayers - 1 ? "not-allowed" : "pointer", color: currentLayer === nLayers - 1 ? "var(--color-text-muted)" : "var(--color-text)", padding: "0 4px", lineHeight: 1 }}
            >
              →
            </button>
            <div style={{ flex: 1 }} />
            {card.gpuTier && (
              <span style={{ fontSize: 9, fontWeight: 600, color: "var(--color-accent)", background: "var(--color-surface-border)", border: "1px solid var(--color-card-border)", borderRadius: 3, padding: "1px 5px" }}>
                {TIER_LABELS[card.gpuTier] ?? card.gpuTier}
              </span>
            )}
            {card.data.truncated && (
              <span style={{ fontSize: 9, fontWeight: 600, color: "#d97706", background: "var(--color-surface-border)", border: "1px solid var(--color-card-border)", borderRadius: 3, padding: "1px 5px" }}>
                truncated to 64 tok
              </span>
            )}
          </div>
        )}
      </div>

      {card.status === "loading" && (
        <div style={{ display: "flex", flexDirection: "column", padding: "12px 14px", gap: 10, minHeight: 110 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {card.gpuTier ? (
              <span style={{ fontSize: 9, fontWeight: 600, color: "var(--color-accent)", background: "var(--color-surface-border)", border: "1px solid var(--color-card-border)", borderRadius: 3, padding: "1px 5px" }}>
                {TIER_LABELS[card.gpuTier] ?? card.gpuTier}
              </span>
            ) : <span />}
            <span style={{ fontSize: 10, color: "var(--color-text-muted)", fontFamily: "var(--font-azeret-mono), monospace", fontVariantNumeric: "tabular-nums" }}>
              {formatElapsed(elapsedMs)}
            </span>
          </div>
          <CardLoadingState
            stage="Computing attention patterns…"
            elapsed={elapsedMs}
            warmup={elapsedMs > 30_000}
          />
        </div>
      )}

      {card.status === "error" && <CardErrorState message={card.error ?? undefined} />}

      {card.status === "result" && card.data && (
        <div style={{ overflow: "auto", background: "var(--color-card)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: 10 }}>
            {Array.from({ length: card.data.n_heads }, (_, h) => (
              <AttentionMatrix
                key={h}
                headIdx={h}
                nHeads={card.data!.n_heads}
                pattern={card.data!.patterns[currentLayer][h]}
                tokens={card.data!.tokens}
                selectedCell={selectedCell}
                onCellClick={handleCellClick}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(AttentionCard);
