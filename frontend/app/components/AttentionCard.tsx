"use client";

import React from "react";
import { getHeadColor } from "../lib/palette";
import { CardDragHandle, CardLoadingState, CardErrorState, CardLoadingHeader, TierBadge, useElapsedMs } from "./CardShell";
import { cn } from "../lib/cn";

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
  showVerifyCard?: boolean;
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
  tutorialMode?: boolean;
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
    const cellPx = rect.width / n;
    const k = Math.floor((e.clientX - rect.left) / cellPx);
    const q = Math.floor((e.clientY - rect.top) / cellPx);
    return k >= 0 && k < n && q >= 0 && q < n ? { q, k } : null;
  }

  return (
    <div className="relative shrink-0" style={{ width: canvasPx, height: canvasPx }}>
      <canvas
        ref={canvasRef}
        width={canvasPx}
        height={canvasPx}
        className="block cursor-crosshair"
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
        <div
          className="pointer-events-none absolute z-[1] h-2 w-2 outline outline-2 -outline-offset-1 outline-foreground"
          style={{ left: selectedCell.k * CELL_SIZE, top: selectedCell.q * CELL_SIZE }}
        />
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
  tutorialMode,
}: AttentionCardProps) {
  const [currentLayer, setCurrentLayer] = React.useState(0);
  const [selectedCell, setSelectedCell] = React.useState<SelectedCell>(null);
  const [pinnedHeads, setPinnedHeads] = React.useState<PinnedHead[]>([]);
  const [focusedHead, setFocusedHead] = React.useState<FocusedHead>(null);
  const [pinConfirm, setPinConfirm] = React.useState<string | null>(null);
  const elapsedMs = useElapsedMs(card.status, card.startedAt);
  const [headerHovered, setHeaderHovered] = React.useState(false);
  const [hoverInfo, setHoverInfo] = React.useState<HoverInfo>(null);
  const pinConfirmTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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
      className={cn(
        "absolute z-10 flex flex-col rounded-lg border border-card-border bg-card shadow-[0_2px_8px_rgba(0,0,0,0.08)]",
        card.status === "loading" && "h-[200px] w-[280px]",
        card.status === "error" && "w-[280px]",
        data && "max-w-[760px]",
      )}
      style={{ left: card.position.x, top: card.position.y }}
    >
      <style>{`
        @keyframes pulseRing {
          0%, 100% { box-shadow: 0 0 0 1.5px var(--accent), 0 0 6px 1px var(--accent); }
          50%       { box-shadow: 0 0 0 1.5px var(--accent), 0 0 14px 4px var(--accent); }
        }
        .attn-browse::-webkit-scrollbar { height: 4px; }
        .attn-browse::-webkit-scrollbar-track { background: transparent; }
        .attn-browse::-webkit-scrollbar-thumb { background: var(--card-border); border-radius: 2px; }
        .attn-browse::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
      `}</style>

      {/* Hover popup */}
      {headerHovered && (
        <div className="pointer-events-none absolute bottom-[calc(100%+6px)] left-0 z-[100] min-w-[200px] max-w-[320px] rounded-lg border border-card-border bg-card px-3 py-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
          <p className="m-0 break-all text-[11px] font-semibold text-foreground">
            {card.modelName}
          </p>
          <p className="m-0 mt-[5px] break-words text-[10px] leading-[1.5] text-muted">
            {card.prompt}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {card.gpuTier && <TierBadge tier={card.gpuTier} />}
            <span className="rounded-[3px] border border-card-border bg-surface-border px-[5px] py-px text-[9px] font-semibold text-accent">
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
        className="flex shrink-0 cursor-grab select-none flex-col rounded-t-lg border-b border-surface-border"
      >
        <div className="flex items-center gap-1.5 px-2.5 py-[7px]">
          <CardDragHandle />
          <span className="shrink-0 text-[11px] font-semibold text-foreground">
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

        {data && (
          <div
            onPointerDown={e => e.stopPropagation()}
            className="flex items-center gap-1.5 border-t border-surface-border px-2.5 py-1"
          >
            <button
              onClick={() => handleLayerChange(-1)}
              disabled={currentLayer === 0}
              className="cursor-pointer border-none bg-transparent px-1 text-xs leading-none text-foreground disabled:cursor-not-allowed disabled:text-muted"
            >←</button>
            <span className="min-w-[28px] text-center text-[10px] tabular-nums text-foreground">
              L{currentLayer}
            </span>
            <button
              onClick={() => handleLayerChange(1)}
              disabled={currentLayer === nLayers - 1}
              className="cursor-pointer border-none bg-transparent px-1 text-xs leading-none text-foreground disabled:cursor-not-allowed disabled:text-muted"
            >→</button>
            <div className="flex-1" />
            {card.gpuTier && <TierBadge tier={card.gpuTier} />}
            {data.truncated && (
              <span className="rounded-[3px] border border-card-border bg-surface-border px-[5px] py-px text-[9px] font-semibold text-amber-600">
                truncated to 30 tok
              </span>
            )}
          </div>
        )}
      </div>

      {/* Loading */}
      {card.status === "loading" && (
        <div className="flex min-h-[110px] flex-col gap-2.5 px-3.5 py-3">
          <CardLoadingHeader gpuTier={card.gpuTier} elapsedMs={elapsedMs} />
          <CardLoadingState stage="Computing attention patterns…" warmup={elapsedMs > 30_000} />
        </div>
      )}

      {/* Error */}
      {card.status === "error" && <CardErrorState message={card.error ?? undefined} showBuyCredits={card.showBuyCredits} showVerifyCard={card.showVerifyCard} />}

      {/* Result */}
      {data && (
        <>
          {/* Browse strip — onPointerDown + onWheel stop propagation so scroll works inside the canvas */}
          <div
            onPointerDown={e => e.stopPropagation()}
            onWheel={e => e.stopPropagation()}
            className="attn-browse overflow-x-auto overflow-y-hidden bg-card"
          >
            <div className="flex gap-2 px-2.5 py-2">
              {Array.from({ length: data.n_heads }, (_, h) => {
                const isPinned = pinnedHeads.some(p => p.layer === currentLayer && p.head === h);
                const isFocused = focusedHead?.layer === currentLayer && focusedHead?.head === h;
                const gridW = data.tokens.length * CELL_SIZE;

                return (
                  <div
                    key={h}
                    className="flex shrink-0 flex-col rounded outline-none transition-shadow"
                    style={{
                      // Aura appears on first click; pulses until second click
                      animation: isFocused ? "pulseRing 1.8s ease-in-out infinite" : "none",
                      boxShadow: isFocused
                        ? "0 0 0 1.5px var(--accent), 0 0 6px 1px var(--accent)"
                        : isPinned
                          ? "0 0 0 1px var(--accent)"
                          : "none",
                    }}
                  >
                    {/* Head label — click target for two-click pinning */}
                    <div
                      onPointerDown={e => e.stopPropagation()}
                      onClick={() => handleHeadLabelClick(currentLayer, h)}
                      title={isFocused ? "Click again to pin" : "Click to select, click again to pin"}
                      className="flex cursor-pointer select-none items-center justify-center rounded-t"
                      style={{ height: HEAD_LABEL_H, width: gridW }}
                    >
                      <span className={cn(
                        "text-[8px] font-bold tracking-[0.04em] transition-colors",
                        isFocused || isPinned ? "text-accent" : "text-muted",
                      )}>
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
            className="flex h-[22px] shrink-0 items-center overflow-hidden border-t border-surface-border bg-card px-2.5"
          >
            {infoContent.type === "confirm" && (
              <span className="whitespace-nowrap text-[9px] font-semibold text-accent">
                {infoContent.text}
              </span>
            )}
            {infoContent.type === "focused" && (
              <span className="whitespace-nowrap text-[9px] text-muted">
                {infoContent.text}
              </span>
            )}
            {infoContent.type === "hover" && (
              <span className="whitespace-nowrap text-[9px] text-muted">
                {"H" + infoContent.head + "  ·  "}
                <span className="text-foreground">&ldquo;{infoContent.tokens[infoContent.q]}&rdquo;</span>
                {"  →  "}
                <span className="text-foreground">&ldquo;{infoContent.tokens[infoContent.k]}&rdquo;</span>
                {"  =  "}
                <span className="font-semibold text-foreground">{infoContent.w.toFixed(3)}</span>
              </span>
            )}
            {infoContent.type === "selected" && (
              <span className="whitespace-nowrap text-[9px] text-muted">
                {"selected  "}
                <span className="text-foreground">&ldquo;{infoContent.tokens[infoContent.q]}&rdquo;</span>
                {"  →  "}
                <span className="text-foreground">&ldquo;{infoContent.tokens[infoContent.k]}&rdquo;</span>
              </span>
            )}
            {infoContent.type === "idle" && (
              <span className="text-[9px] text-muted">
                hover cells to inspect  ·  click a head label once then again to pin
              </span>
            )}
          </div>

          {/* Pinned comparison section */}
          {pinnedHeads.length > 0 && (
            <div className="rounded-b-lg border-t-2 border-surface-border bg-panel">
              <div
                onPointerDown={e => e.stopPropagation()}
                className="flex items-center gap-1.5 border-b border-surface-border px-2.5 py-[5px]"
              >
                <span className="text-[9px] font-bold tracking-[0.08em] text-muted">
                  PINNED
                </span>
                <span className="text-[9px] text-muted">
                  {pinnedHeads.length}/{MAX_PINS}
                </span>
                <div className="flex-1" />
                <button
                  onPointerDown={e => e.stopPropagation()}
                  onClick={() => setPinnedHeads([])}
                  className="cursor-pointer border-none bg-transparent p-0 text-[9px] text-muted"
                >
                  clear all
                </button>
              </div>

              <div
                onPointerDown={e => e.stopPropagation()}
                onWheel={e => e.stopPropagation()}
                className="attn-browse overflow-x-auto bg-panel"
              >
                <div className="flex gap-2 px-2.5 py-2">
                  {pinnedHeads.map(({ layer, head }) => (
                    <div key={`${layer}-${head}`} className="flex shrink-0 flex-col">
                      <div
                        className="relative flex items-center justify-center"
                        style={{ height: HEAD_LABEL_H, width: data.tokens.length * CELL_SIZE }}
                      >
                        <span className="text-[8px] font-bold text-accent">
                          L{layer}·H{head}
                        </span>
                        <button
                          onPointerDown={e => e.stopPropagation()}
                          onClick={() => handleUnpin(layer, head)}
                          className="absolute right-0 cursor-pointer border-none bg-transparent px-0.5 text-[10px] leading-none text-muted"
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
