"use client";

import React from "react";
import { getHeadColor } from "../lib/palette";
import { techniqueForCard } from "../lib/techniques";
import { CardInfo } from "./CardInfo";
import { infoSectionsFor } from "./card-info-content";
import { BORDER_W } from "./card-geometry";
import {
  BandChip,
  CardBand,
  CardCloseButton,
  CardErrorState,
  CardFrame,
  CardHeader,
  CardLoadingHeader,
  CardLoadingState,
  CardRule,
  CARD_INSET,
  CARD_MAX_W,
  CARD_MIN_W,
  useElapsedMs,
} from "./CardShell";
import { HoverTooltip, type TooltipState } from "../lib/tooltip";
import { cn } from "../lib/cn";
import type { LoadingStage } from "../lib/loading-stage";

const TECHNIQUE = techniqueForCard("attention-pattern");

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
  /** Set by the CARD_RESOLVED reducer. Absent on rows saved before this existed. */
  finishedAt?: number;
  /** True when the spawn short-circuited on a cache hit — no GPU time was billed. */
  cached?: boolean;
  loadingStage?: LoadingStage;
  cacheKey?: string | null;  // reference into attnCache; project saves store this instead of `data`
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

/* CARD_MAX_W now lives in CardShell — it bounds every card, not just this one,
   and projects/helpers.ts derives the spawn lattice from it. */

const CELL_SIZE = 8;
/** Pinned heads render at half scale, so the shelf reads as an index rather than a second copy. */
const PIN_CELL_SIZE = 4;
const HEAD_LABEL_H = 14;
const MAX_PINS = 5;
const HEAD_GAP = 8;

/** Strip padding. CARD_INSET, not CARD_BODY_PAD: the data shares the chrome's column so
    the edge fade can begin exactly where CardRule ends. */
const STRIP_PAD_TOP = 12;
/** Deep enough to seat the scroll thumb with even space above and below it. */
const STRIP_PAD_BOTTOM = 16;

const THUMB_H = 4;
const THUMB_MIN_W = 24;

type PinnedHead = { layer: number; head: number };
type SelectedCell = { q: number; k: number } | null;

/**
 * Horizontal fade over the first and last CARD_INSET px, so heads dissolve at the
 * column edge instead of being cut off. A mask rather than a gradient overlay: it
 * fades to whatever is behind, which is the card in either theme.
 *
 * Only the side with content off-screen gets a fade, so a strip that fits is fully
 * opaque. The native scrollbar is masked along with the content, which is what
 * keeps the pill's ends clear of the frame's corner radius.
 */
function edgeMask(left: boolean, right: boolean): string | undefined {
  if (!left && !right) return undefined;
  const from = left ? `transparent, #000 ${CARD_INSET}px` : "#000 0";
  const to = right ? `#000 calc(100% - ${CARD_INSET}px), transparent` : "#000 100%";
  return `linear-gradient(to right, ${from}, ${to})`;
}

/**
 * Scrolling row of heads with a faded column edge. Used at full scale for the
 * current layer and at half scale for the pinned shelf.
 *
 * The thumb is a real element, not a native scrollbar, for three reasons the
 * native one can't satisfy: its track is inset to CARD_INSET so it can never
 * reach the frame's rounded corner (a native gutter spans the container's full
 * width), it sits centred in the strip's bottom padding rather than jammed at
 * the container edge, and it has no platform arrow buttons.
 *
 * Note `::-webkit-scrollbar` styling is unusable here anyway: Chrome ignores
 * those pseudo-elements entirely once `scrollbar-width` or `scrollbar-color`
 * is set, and without them the native bar keeps its arrows and square ends.
 */
function HeadStrip({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [edges, setEdges] = React.useState({ left: false, right: false });
  const [thumb, setThumb] = React.useState<{ left: number; width: number } | null>(null);

  const update = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({ left: el.scrollLeft > 1, right: el.scrollLeft < max - 1 });
    if (max <= 0) {
      setThumb(null);
      return;
    }
    const track = el.clientWidth - CARD_INSET * 2;
    const width = Math.max(THUMB_MIN_W, track * (el.clientWidth / el.scrollWidth));
    setThumb({ width, left: (track - width) * (el.scrollLeft / max) });
  }, []);

  // Observing the content too, so paging layers or pinning re-evaluates both.
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [update]);

  /** Drag the thumb: track delta scaled by the content-to-track ratio. */
  function onThumbDown(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    const el = ref.current;
    if (!el) return;
    const startX = e.clientX;
    const startScroll = el.scrollLeft;
    const track = el.clientWidth - CARD_INSET * 2;
    const ratio = el.scrollWidth / track;
    e.currentTarget.setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => {
      el.scrollLeft = startScroll + (ev.clientX - startX) * ratio;
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const mask = edgeMask(edges.left, edges.right);

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={update}
        onPointerDown={e => e.stopPropagation()}
        onWheel={e => e.stopPropagation()}
        className="attn-strip overflow-x-auto overflow-y-hidden"
        style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
      >
        <div
          className="flex"
          style={{
            gap: HEAD_GAP,
            paddingInline: CARD_INSET,
            paddingTop: STRIP_PAD_TOP,
            paddingBottom: STRIP_PAD_BOTTOM,
          }}
        >
          {children}
        </div>
      </div>

      {thumb && (
        <div
          onPointerDown={onThumbDown}
          className="absolute cursor-grab"
          style={{
            height: THUMB_H,
            width: thumb.width,
            left: CARD_INSET + thumb.left,
            bottom: (STRIP_PAD_BOTTOM - THUMB_H) / 2,
            borderRadius: THUMB_H / 2,
            backgroundColor: "var(--scroll-thumb)",
          }}
        />
      )}
    </div>
  );
}

const AttentionMatrixCanvas = React.memo(function AttentionMatrixCanvas({
  headIdx,
  nHeads,
  pattern,
  cellSize,
  selectedCell,
  onCellClick,
  onHover,
  onHoverEnd,
}: {
  headIdx: number;
  nHeads: number;
  pattern: number[][];
  cellSize: number;
  selectedCell: SelectedCell;
  onCellClick: (q: number, k: number) => void;
  onHover: (info: { head: number; q: number; k: number; w: number }, e: React.MouseEvent) => void;
  onHoverEnd: () => void;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const n = pattern.length;
  const canvasPx = n * cellSize;

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
        ctx.fillRect(k * cellSize, q * cellSize, cellSize, cellSize);
      }
    }
  }, [pattern, headIdx, nHeads, n, canvasPx, cellSize]);

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
          if (c) onHover({ head: headIdx, q: c.q, k: c.k, w: pattern[c.q][c.k] }, e);
        }}
        onMouseLeave={onHoverEnd}
      />
      {selectedCell && (
        <div
          className="pointer-events-none absolute z-[1] outline outline-2 -outline-offset-1 outline-foreground"
          style={{
            left: selectedCell.k * cellSize,
            top: selectedCell.q * cellSize,
            width: cellSize,
            height: cellSize,
          }}
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
  const [tooltip, setTooltip] = React.useState<TooltipState>(null);
  const elapsedMs = useElapsedMs(card.status, card.startedAt);

  React.useEffect(() => {
    setCurrentLayer(0);
    setSelectedCell(null);
    setPinnedHeads([]);
  }, [card.data]);

  const nLayers = card.data?.n_layers ?? 0;
  const atPinCap = pinnedHeads.length >= MAX_PINS;

  function handleCellClick(q: number, k: number) {
    setSelectedCell(prev => (prev?.q === q && prev?.k === k ? null : { q, k }));
  }

  /** One click toggles the pin; the ring appearing in the strip is the confirmation. */
  function handlePinToggle(layer: number, head: number) {
    setPinnedHeads(prev => {
      const already = prev.some(p => p.layer === layer && p.head === head);
      if (already) return prev.filter(p => !(p.layer === layer && p.head === head));
      if (prev.length >= MAX_PINS) return prev;
      return [...prev, { layer, head }];
    });
  }

  function handleLayerChange(delta: number) {
    setCurrentLayer(l => Math.max(0, Math.min(nLayers - 1, l + delta)));
  }

  const data = card.status === "result" ? card.data : null;

  // Head strip sizes to its data, then caps and scrolls.
  const cardWidth = data
    ? Math.min(
        CARD_MAX_W,
        Math.max(
          CARD_MIN_W,
          data.n_heads * data.tokens.length * CELL_SIZE + (data.n_heads - 1) * HEAD_GAP + CARD_INSET * 2 + BORDER_W,
        ),
      )
    : CARD_MIN_W;

  const memoSections = React.useMemo(() => infoSectionsFor(card), [card]);

  const showCellTooltip = (
    info: { head: number; q: number; k: number; w: number },
    e: React.MouseEvent,
    layerLabel: string,
  ) => {
    if (!data) return;
    setTooltip({
      x: e.clientX,
      y: e.clientY,
      content: (
        <>
          <div className="mb-0.5 text-muted">
            <span className="font-semibold text-foreground">{layerLabel}·H{info.head}</span>
          </div>
          <div className="font-mono tabular-nums">
            {JSON.stringify(data.tokens[info.q])} → {JSON.stringify(data.tokens[info.k])}
          </div>
          <div className="font-mono tabular-nums">
            w = <span className="font-semibold">{info.w.toFixed(3)}</span>
          </div>
        </>
      ),
    });
  };

  return (
    <CardFrame ref={ref} cardId={card.id} position={card.position} width={cardWidth}>
      {/* Native bar fully hidden; HeadStrip draws its own thumb. The -webkit rule
          is for Safari, which only got scrollbar-width in 18.2. */}
      <style>{`
        .attn-strip { scrollbar-width: none; -ms-overflow-style: none; }
        .attn-strip::-webkit-scrollbar { display: none; }
      `}</style>

      {!tutorialMode && <CardCloseButton onClick={() => onRemove(card.id)} />}

      {/* Chrome — the whole block is the drag surface; interactive children opt out */}
      <div
        onPointerDown={e => onStartDrag(e, card.id, card.position)}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        className="shrink-0 cursor-grab select-none"
      >
        <CardHeader modelName={card.modelName} prompt={card.prompt} />
        <CardBand info={
          <CardInfo
            accent={TECHNIQUE.band}
            accentLabel={TECHNIQUE.name}
            sections={memoSections}
          />
        }>
          {data && (
            /* 265 = the mock's 530px pager bar at scale. */
            <BandChip className="w-full max-w-[265px]">
              <div className="flex w-full items-center justify-between gap-1">
                <button
                  onPointerDown={e => e.stopPropagation()}
                  onClick={() => handleLayerChange(-1)}
                  disabled={currentLayer === 0}
                  aria-label="Previous layer"
                  className="cursor-pointer border-none bg-transparent p-0 text-[11px] leading-none text-current disabled:cursor-not-allowed disabled:opacity-40"
                >←</button>
                <span className="font-mono text-[11px] leading-none tabular-nums">
                  L{currentLayer}
                </span>
                <button
                  onPointerDown={e => e.stopPropagation()}
                  onClick={() => handleLayerChange(1)}
                  disabled={currentLayer === nLayers - 1}
                  aria-label="Next layer"
                  className="cursor-pointer border-none bg-transparent p-0 text-[11px] leading-none text-current disabled:cursor-not-allowed disabled:opacity-40"
                >→</button>
              </div>
            </BandChip>
          )}
        </CardBand>

        <CardRule />
      </div>

      {/* Loading */}
      {card.status === "loading" && (
        <div className="flex min-h-[110px] flex-col gap-2.5 px-5 py-3">
          <CardLoadingHeader gpuTier={card.gpuTier} elapsedMs={elapsedMs} />
          <CardLoadingState
            stage={card.loadingStage}
            labels={{ computing: "Computing attention patterns…" }}
          />
        </div>
      )}

      {/* Error */}
      {card.status === "error" && <CardErrorState message={card.error ?? undefined} showBuyCredits={card.showBuyCredits} showVerifyCard={card.showVerifyCard} />}

      {/* Result */}
      {data && (
        <>
          <HeadStrip>
            {Array.from({ length: data.n_heads }, (_, h) => {
              const isPinned = pinnedHeads.some(p => p.layer === currentLayer && p.head === h);
              const gridW = data.tokens.length * CELL_SIZE;

              return (
                <div
                  key={h}
                  className={cn(
                    "flex shrink-0 flex-col rounded-[3px]",
                    isPinned && "outline outline-1 outline-offset-2 outline-accent",
                  )}
                >
                  <div
                    onPointerDown={e => e.stopPropagation()}
                    onClick={() => handlePinToggle(currentLayer, h)}
                    title={
                      isPinned ? "Unpin" : atPinCap ? `Max ${MAX_PINS} pinned` : "Pin for comparison"
                    }
                    className={cn(
                      "flex select-none items-center justify-center",
                      isPinned || !atPinCap ? "cursor-pointer" : "cursor-default",
                    )}
                    style={{ height: HEAD_LABEL_H, width: gridW }}
                  >
                    <span className={cn(
                      "font-mono text-[8px] font-bold tracking-[0.04em] transition-colors",
                      isPinned ? "text-accent" : "text-muted",
                    )}>
                      H{h}
                    </span>
                  </div>

                  <AttentionMatrixCanvas
                    headIdx={h}
                    nHeads={data.n_heads}
                    pattern={data.patterns[currentLayer][h]}
                    cellSize={CELL_SIZE}
                    selectedCell={selectedCell}
                    onCellClick={handleCellClick}
                    onHover={(info, e) => showCellTooltip(info, e, `L${currentLayer}`)}
                    onHoverEnd={() => setTooltip(null)}
                  />
                </div>
              );
            })}
          </HeadStrip>

          {/* Pinned shelf — same surface as the card, separated by the same rule the
              chrome uses. Half scale so it reads as an index, not a second render. */}
          {pinnedHeads.length > 0 && (
            <>
              <CardRule />
              <HeadStrip>
                {pinnedHeads.map(({ layer, head }) => (
                  <div key={`${layer}-${head}`} className="group flex shrink-0 flex-col">
                    <div
                      className="relative flex items-center justify-center"
                      style={{ height: HEAD_LABEL_H, width: data.tokens.length * PIN_CELL_SIZE }}
                    >
                      <span className="font-mono text-[8px] font-bold text-accent">
                        L{layer}·H{head}
                      </span>
                      <button
                        onPointerDown={e => e.stopPropagation()}
                        onClick={() => handlePinToggle(layer, head)}
                        aria-label={`Unpin L${layer} H${head}`}
                        className="absolute -right-1 cursor-pointer border-none bg-transparent px-0.5 text-[10px] leading-none text-muted opacity-0 transition-opacity group-hover:opacity-100"
                      >×</button>
                    </div>
                    <AttentionMatrixCanvas
                      headIdx={head}
                      nHeads={data.n_heads}
                      pattern={data.patterns[layer][head]}
                      cellSize={PIN_CELL_SIZE}
                      selectedCell={selectedCell}
                      onCellClick={handleCellClick}
                      onHover={(info, e) => showCellTooltip(info, e, `L${layer}`)}
                      onHoverEnd={() => setTooltip(null)}
                    />
                  </div>
                ))}
              </HeadStrip>
            </>
          )}
        </>
      )}
      {tooltip && <HoverTooltip x={tooltip.x} y={tooltip.y}>{tooltip.content}</HoverTooltip>}
    </CardFrame>
  );
}

export default React.memo(AttentionCard);
