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
  showBuyCredits?: boolean;
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
  onBuyCredits?: () => void;
};

const CELL_SIZE = 8;
const HEAD_LABEL_H = 24;
const MAX_PINS = 5;

type PinnedHead = { layer: number; head: number };
type SelectedCell = { q: number; k: number } | null;
type FocusedHead = { layer: number; head: number } | null;
type HoverInfo = { head: number; q: number; k: number; w: number } | null;

const AttentionMatrixCanvas = React.memo(function AttentionMatrixCanvas({
  headIdx,
  nHeads,
  pattern,
  selectedCell,
  onCellClick,
  onHover,
  onHoverEnd,
}: {
  headIdx: number;
  nHeads: number;
  pattern: number[][];
  selectedCell: SelectedCell;
  onCellClick: (q: number, k: number) => void;
  onHover: (info: { head: number; q: number; k: number; w: number }) => void;
  onHoverEnd: () => void;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const n = pattern.length;
  const canvasPx = n * CELL_SIZE;

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasPx * dpr;
    canvas.height = canvasPx * dpr;
    canvas.style.width = `${canvasPx}px`;
    canvas.style.height = `${canvasPx}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    for (let q = 0; q < n; q++) {
      for (let k = 0; k < n; k++) {
        ctx.fillStyle = getHeadColor(headIdx, nHeads, pattern[q][k]);
        ctx.fillRect(k * CELL_SIZE, q * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }, [pattern, headIdx, nHeads, n, canvasPx]);

  function getCellAt(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const k = Math.floor((e.clientX - rect.left) / CELL_SIZE);
    const q = Math.floor((e.clientY - rect.top) / CELL_SIZE);
    return k >= 0 && k < n && q >= 0 && q < n ? { q, k } : null;
  }

  return (
    <div style={{ position: "relative", width: canvasPx, height: canvasPx, flexShrink: 0 }}>
      <canvas
        ref={canvasRef}
        width={canvasPx}
        height={canvasPx}
        style={{ display: "block", cursor: "crosshair" }}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => {
          const c = getCellAt(e);
          if (c) onCellClick(c.q, c.k);
        }}
        onMouseMove={e => {
          const c = getCellAt(e);
          if (c) onHover({ head: headIdx, q: c.q, k: c.k, w: pattern[c.q][c.k] });
        }}
        onMouseLeave={onHoverEnd}
      />
      {selectedCell && (
        <div style={{
          position: "absolute",
          left: selectedCell.k * CELL_SIZE,
          top: selectedCell.q * CELL_SIZE,
          width: CELL_SIZE,
          height: CELL_SIZE,
          outline: "2px solid var(--color-text)",
          outlineOffset: "-1px",
          pointerEvents: "none",
          zIndex: 1,
        }} />
      )}
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
  onBuyCredits,
}: AttentionCardProps) {
  const [currentLayer, setCurrentLayer] = React.useState(0);
  const [selectedCell, setSelectedCell] = React.useState<SelectedCell>(null);
  const [pinnedHeads, setPinnedHeads] = React.useState<PinnedHead[]>([]);
  const [focusedHead, setFocusedHead] = React.useState<FocusedHead>(null);
  const [pinConfirm, setPinConfirm] = React.useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [headerHovered, setHeaderHovered] = React.useState(false);
  const [hoverInfo, setHoverInfo] = React.useState<HoverInfo>(null);
  const pinConfirmTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setPinnedHeads([]);
    setFocusedHead(null);
  }, [card.data]);

  // Clear focus when Escape pressed
  React.useEffect(() => {
    if (!focusedHead) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFocusedHead(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [focusedHead]);

  // Cleanup confirm timer on unmount
  React.useEffect(() => {
    return () => { if (pinConfirmTimer.current) clearTimeout(pinConfirmTimer.current); };
  }, []);

  const nLayers = card.data?.n_layers ?? 0;

  function showConfirm(msg: string) {
    if (pinConfirmTimer.current) clearTimeout(pinConfirmTimer.current);
    setPinConfirm(msg);
    pinConfirmTimer.current = setTimeout(() => setPinConfirm(null), 1800);
  }

  function handleCellClick(q: number, k: number) {
    setSelectedCell(prev => (prev?.q === q && prev?.k === k ? null : { q, k }));
  }

  function handlePin(layer: number, head: number) {
    setPinnedHeads(prev => {
      const alreadyPinned = prev.some(p => p.layer === layer && p.head === head);
      if (alreadyPinned) return prev.filter(p => !(p.layer === layer && p.head === head));
      if (prev.length >= MAX_PINS) return prev;
      return [...prev, { layer, head }];
    });
  }

  function handleHeadLabelClick(layer: number, head: number) {
    const isPinned = pinnedHeads.some(p => p.layer === layer && p.head === head);
    const isFocused = focusedHead?.layer === layer && focusedHead?.head === head;

    if (isFocused) {
      // Second click — commit
      if (isPinned) {
        handlePin(layer, head); // unpin
        showConfirm(`unpinned L${layer}·H${head}`);
      } else if (pinnedHeads.length < MAX_PINS) {
        handlePin(layer, head); // pin
        showConfirm(`✓ pinned L${layer}·H${head}`);
      } else {
        showConfirm(`max ${MAX_PINS} pins reached`);
      }
      setFocusedHead(null);
    } else {
      // First click — focus (show aura)
      setFocusedHead({ layer, head });
    }
  }

  function handleLayerChange(delta: number) {
    setCurrentLayer(l => Math.max(0, Math.min(nLayers - 1, l + delta)));
    setFocusedHead(null);
  }

  function handleUnpin(layer: number, head: number) {
    setPinnedHeads(prev => prev.filter(p => !(p.layer === layer && p.head === head)));
  }

  const data = card.status === "result" ? card.data : null;

  // Info bar text priority: confirm > focused > hover > selected > default
  const infoContent = React.useMemo(() => {
    if (pinConfirm) return { type: "confirm" as const, text: pinConfirm };
    if (focusedHead) {
      const isPinned = pinnedHeads.some(p => p.layer === focusedHead.layer && p.head === focusedHead.head);
      const action = isPinned ? "unpin" : pinnedHeads.length >= MAX_PINS ? "max pins reached — click to dismiss" : "pin for comparison";
      return { type: "focused" as const, text: `click again to ${action}  ·  L${focusedHead.layer}·H${focusedHead.head}  ·  Esc to cancel` };
    }
    if (hoverInfo && data) return { type: "hover" as const, head: hoverInfo.head, q: hoverInfo.q, k: hoverInfo.k, w: hoverInfo.w, tokens: data.tokens };
    if (selectedCell && data) return { type: "selected" as const, q: selectedCell.q, k: selectedCell.k, tokens: data.tokens };
    return { type: "idle" as const };
  }, [pinConfirm, focusedHead, hoverInfo, selectedCell, data, pinnedHeads]);

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
        ...(data ? { maxWidth: 760 } : {}),
      }}
    >
      <style>{`
        @keyframes pulseRing {
          0%, 100% { box-shadow: 0 0 0 1.5px var(--color-accent), 0 0 6px 1px var(--color-accent); }
          50%       { box-shadow: 0 0 0 1.5px var(--color-accent), 0 0 14px 4px var(--color-accent); }
        }
      `}</style>

      {/* Hover popup */}
      {headerHovered && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: 0,
          background: "var(--color-card)", border: "1px solid var(--color-card-border)",
          borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          padding: "10px 12px", zIndex: 100, pointerEvents: "none",
          minWidth: 200, maxWidth: 320,
        }}>
          <p style={{ fontSize: 11, fontWeight: 600, margin: 0, color: "var(--color-text)", fontFamily: "var(--font-ibm-plex-mono), monospace", wordBreak: "break-all" }}>
            {card.modelName}
          </p>
          <p style={{ fontSize: 10, color: "var(--color-text-muted)", margin: "5px 0 0", lineHeight: 1.5, fontFamily: "var(--font-ibm-plex-mono), monospace", wordBreak: "break-word" }}>
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

      {/* Header */}
      <div
        onPointerDown={e => onStartDrag(e, card.id, card.position)}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onMouseEnter={() => setHeaderHovered(true)}
        onMouseLeave={() => setHeaderHovered(false)}
        style={{
          borderBottom: "1px solid var(--color-surface-border)",
          display: "flex", flexDirection: "column", flexShrink: 0,
          borderRadius: "8px 8px 0 0", cursor: "grab", userSelect: "none",
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

        {data && (
          <div
            onPointerDown={e => e.stopPropagation()}
            style={{ padding: "4px 10px", borderTop: "1px solid var(--color-surface-border)", display: "flex", alignItems: "center", gap: 6 }}
          >
            <button
              onClick={() => handleLayerChange(-1)}
              disabled={currentLayer === 0}
              style={{ fontSize: 12, background: "none", border: "none", cursor: currentLayer === 0 ? "not-allowed" : "pointer", color: currentLayer === 0 ? "var(--color-text-muted)" : "var(--color-text)", padding: "0 4px", lineHeight: 1 }}
            >←</button>
            <span style={{ fontSize: 10, fontFamily: "var(--font-ibm-plex-mono), monospace", color: "var(--color-text)", minWidth: 28, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
              L{currentLayer}
            </span>
            <button
              onClick={() => handleLayerChange(1)}
              disabled={currentLayer === nLayers - 1}
              style={{ fontSize: 12, background: "none", border: "none", cursor: currentLayer === nLayers - 1 ? "not-allowed" : "pointer", color: currentLayer === nLayers - 1 ? "var(--color-text-muted)" : "var(--color-text)", padding: "0 4px", lineHeight: 1 }}
            >→</button>
            <div style={{ flex: 1 }} />
            {card.gpuTier && (
              <span style={{ fontSize: 9, fontWeight: 600, color: "var(--color-accent)", background: "var(--color-surface-border)", border: "1px solid var(--color-card-border)", borderRadius: 3, padding: "1px 5px" }}>
                {TIER_LABELS[card.gpuTier] ?? card.gpuTier}
              </span>
            )}
            {data.truncated && (
              <span style={{ fontSize: 9, fontWeight: 600, color: "#d97706", background: "var(--color-surface-border)", border: "1px solid var(--color-card-border)", borderRadius: 3, padding: "1px 5px" }}>
                truncated to 30 tok
              </span>
            )}
          </div>
        )}
      </div>

      {/* Loading */}
      {card.status === "loading" && (
        <div style={{ display: "flex", flexDirection: "column", padding: "12px 14px", gap: 10, minHeight: 110 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {card.gpuTier ? (
              <span style={{ fontSize: 9, fontWeight: 600, color: "var(--color-accent)", background: "var(--color-surface-border)", border: "1px solid var(--color-card-border)", borderRadius: 3, padding: "1px 5px" }}>
                {TIER_LABELS[card.gpuTier] ?? card.gpuTier}
              </span>
            ) : <span />}
            <span style={{ fontSize: 10, color: "var(--color-text-muted)", fontFamily: "var(--font-ibm-plex-mono), monospace", fontVariantNumeric: "tabular-nums" }}>
              {formatElapsed(elapsedMs)}
            </span>
          </div>
          <CardLoadingState stage="Computing attention patterns…" elapsed={elapsedMs} warmup={elapsedMs > 30_000} />
        </div>
      )}

      {/* Error */}
      {card.status === "error" && <CardErrorState message={card.error ?? undefined} showBuyCredits={card.showBuyCredits} onBuyCredits={onBuyCredits} />}

      {/* Result */}
      {data && (
        <>
          {/* Browse strip — onPointerDown + onWheel stop propagation so scroll works inside the canvas */}
          <div
            onPointerDown={e => e.stopPropagation()}
            onWheel={e => e.stopPropagation()}
            style={{ overflowX: "auto", overflowY: "hidden", background: "var(--color-card)" }}
          >
            <div style={{ display: "flex", gap: 8, padding: "8px 10px" }}>
              {Array.from({ length: data.n_heads }, (_, h) => {
                const isPinned = pinnedHeads.some(p => p.layer === currentLayer && p.head === h);
                const isFocused = focusedHead?.layer === currentLayer && focusedHead?.head === h;
                const gridW = data.tokens.length * CELL_SIZE;

                return (
                  <div
                    key={h}
                    style={{
                      flexShrink: 0,
                      display: "flex",
                      flexDirection: "column",
                      borderRadius: 4,
                      // Aura appears on first click; pulses until second click
                      animation: isFocused ? "pulseRing 1.8s ease-in-out infinite" : "none",
                      boxShadow: isFocused
                        ? "0 0 0 1.5px var(--color-accent), 0 0 6px 1px var(--color-accent)"
                        : isPinned
                          ? "0 0 0 1px var(--color-accent)"
                          : "none",
                      transition: "box-shadow 150ms",
                      outline: "none",
                    }}
                  >
                    {/* Head label — click target for two-click pinning */}
                    <div
                      onPointerDown={e => e.stopPropagation()}
                      onClick={() => handleHeadLabelClick(currentLayer, h)}
                      title={isFocused ? "Click again to pin" : "Click to select, click again to pin"}
                      style={{
                        height: HEAD_LABEL_H,
                        width: gridW,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        borderRadius: "4px 4px 0 0",
                        userSelect: "none",
                      }}
                    >
                      <span style={{
                        fontSize: 8,
                        fontFamily: "var(--font-ibm-plex-mono), monospace",
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        color: isFocused ? "var(--color-accent)" : isPinned ? "var(--color-accent)" : "var(--color-text-muted)",
                        transition: "color 150ms",
                      }}>
                        H{h}
                      </span>
                    </div>

                    <AttentionMatrixCanvas
                      headIdx={h}
                      nHeads={data.n_heads}
                      pattern={data.patterns[currentLayer][h]}
                      selectedCell={selectedCell}
                      onCellClick={handleCellClick}
                      onHover={info => setHoverInfo(info)}
                      onHoverEnd={() => setHoverInfo(null)}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Info bar */}
          <div
            onPointerDown={e => e.stopPropagation()}
            style={{
              height: 22,
              padding: "0 10px",
              display: "flex",
              alignItems: "center",
              borderTop: "1px solid var(--color-surface-border)",
              background: "var(--color-card)",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {infoContent.type === "confirm" && (
              <span style={{ fontSize: 9, fontFamily: "var(--font-ibm-plex-mono), monospace", color: "var(--color-accent)", fontWeight: 600, whiteSpace: "nowrap" }}>
                {infoContent.text}
              </span>
            )}
            {infoContent.type === "focused" && (
              <span style={{ fontSize: 9, fontFamily: "var(--font-ibm-plex-mono), monospace", color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
                {infoContent.text}
              </span>
            )}
            {infoContent.type === "hover" && (
              <span style={{ fontSize: 9, fontFamily: "var(--font-ibm-plex-mono), monospace", color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
                {"H" + infoContent.head + "  ·  "}
                <span style={{ color: "var(--color-text)" }}>&ldquo;{infoContent.tokens[infoContent.q]}&rdquo;</span>
                {"  →  "}
                <span style={{ color: "var(--color-text)" }}>&ldquo;{infoContent.tokens[infoContent.k]}&rdquo;</span>
                {"  =  "}
                <span style={{ color: "var(--color-text)", fontWeight: 600 }}>{infoContent.w.toFixed(3)}</span>
              </span>
            )}
            {infoContent.type === "selected" && (
              <span style={{ fontSize: 9, fontFamily: "var(--font-ibm-plex-mono), monospace", color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
                {"selected  "}
                <span style={{ color: "var(--color-text)" }}>&ldquo;{infoContent.tokens[infoContent.q]}&rdquo;</span>
                {"  →  "}
                <span style={{ color: "var(--color-text)" }}>&ldquo;{infoContent.tokens[infoContent.k]}&rdquo;</span>
              </span>
            )}
            {infoContent.type === "idle" && (
              <span style={{ fontSize: 9, color: "var(--color-text-muted)", fontFamily: "var(--font-ibm-plex-mono), monospace" }}>
                hover cells to inspect  ·  click a head label once then again to pin
              </span>
            )}
          </div>

          {/* Pinned comparison section */}
          {pinnedHeads.length > 0 && (
            <div style={{
              borderTop: "2px solid var(--color-surface-border)",
              background: "var(--color-panel)",
              borderRadius: "0 0 8px 8px",
            }}>
              <div
                onPointerDown={e => e.stopPropagation()}
                style={{ padding: "5px 10px", display: "flex", alignItems: "center", gap: 6, borderBottom: "1px solid var(--color-surface-border)" }}
              >
                <span style={{ fontSize: 9, fontWeight: 700, color: "var(--color-text-muted)", fontFamily: "var(--font-ibm-plex-mono), monospace", letterSpacing: "0.08em" }}>
                  PINNED
                </span>
                <span style={{ fontSize: 9, color: "var(--color-text-muted)", fontFamily: "var(--font-ibm-plex-mono), monospace" }}>
                  {pinnedHeads.length}/{MAX_PINS}
                </span>
                <div style={{ flex: 1 }} />
                <button
                  onPointerDown={e => e.stopPropagation()}
                  onClick={() => setPinnedHeads([])}
                  style={{ fontSize: 9, color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "var(--font-ibm-plex-mono), monospace" }}
                >
                  clear all
                </button>
              </div>

              <div
                onPointerDown={e => e.stopPropagation()}
                onWheel={e => e.stopPropagation()}
                style={{ overflowX: "auto", background: "var(--color-panel)" }}
              >
                <div style={{ display: "flex", gap: 8, padding: "8px 10px" }}>
                  {pinnedHeads.map(({ layer, head }) => (
                    <div key={`${layer}-${head}`} style={{ flexShrink: 0, display: "flex", flexDirection: "column" }}>
                      <div style={{
                        height: HEAD_LABEL_H,
                        width: data.tokens.length * CELL_SIZE,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 5,
                      }}>
                        <span style={{ fontSize: 8, fontFamily: "var(--font-ibm-plex-mono), monospace", color: "var(--color-accent)", fontWeight: 700 }}>
                          L{layer}·H{head}
                        </span>
                        <button
                          onPointerDown={e => e.stopPropagation()}
                          onClick={() => handleUnpin(layer, head)}
                          style={{ fontSize: 10, background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: "0 2px", lineHeight: 1 }}
                        >×</button>
                      </div>
                      <AttentionMatrixCanvas
                        headIdx={head}
                        nHeads={data.n_heads}
                        pattern={data.patterns[layer][head]}
                        selectedCell={selectedCell}
                        onCellClick={handleCellClick}
                        onHover={info => setHoverInfo(info)}
                        onHoverEnd={() => setHoverInfo(null)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default React.memo(AttentionCard);
