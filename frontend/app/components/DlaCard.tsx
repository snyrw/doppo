"use client";

import React from "react";
import { interpolateColorDivergent, type DivergingPaletteName } from "../lib/palette";
import { CardDragHandle, CardLoadingState, CardErrorState, CardLoadingHeader, TierBadge, useElapsedMs } from "./CardShell";
import { DivergingBar } from "./DivergingBar";
import { useDivergingPalette } from "../hooks/usePalette";
import { HoverTooltip, type TooltipState } from "../lib/tooltip";
import { cn } from "../lib/cn";
import type { LoadingStage } from "../lib/loading-stage";

// Shared cell classes for the DLA grid views (dimensional widths stay inline
// because they're derived from the layout constants below).
const yLabelCls = "shrink-0 pr-1 text-right font-mono text-[9px] text-muted";
const valueCls = "w-11 shrink-0 text-right font-mono text-[9px] tabular-nums text-muted";

export type DlaData = {
  target_token: string;
  contrastive_token: string | null;
  target_position: number;
  y_labels: string[];         // ["L0","L1",...] one per layer
  x_labels: string[];         // ["H0","H1",...] one per head
  embed_dla: number;          // combined token + positional embedding contribution
  layer_dla: number[];        // [n_layers] combined attn+mlp
  layer_attn_dla: number[];   // [n_layers] attention only
  layer_mlp_dla: number[];    // [n_layers] MLP only
  head_dla: number[][];       // [n_layers][n_heads] signed floats
};

export type DlaCardData = {
  id: string;
  cardType: "dla";
  status: "loading" | "result" | "error";
  modelName: string;
  prompt: string;
  data: DlaData | null;
  error: string | null;
  showBuyCredits?: boolean;
  showVerifyCard?: boolean;
  position: { x: number; y: number };
  gpuTier?: string;
  startedAt?: number;
  loadingStage?: LoadingStage;
  targetPosition: number | "last";
  targetToken: string | null;
  contrastiveToken: string | null;
};

type DlaCardProps = {
  card: DlaCardData;
  ref?: React.Ref<HTMLDivElement>;
  onStartDrag: (e: React.PointerEvent<HTMLDivElement>, cardId: string, pos: { x: number; y: number }) => void;
  onDragMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDragEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
  onRemove: (id: string) => void;
  tutorialMode?: boolean;
};


const COL_GAP = 2;
const Y_LABEL_W = 28;
const LAYER_CELL_H = 14;
const HEAD_CELL_SIZE = 14;
const LAYER_BAR_W = 160;

const STAGE_LABELS: Record<string, string> = {
  tokenizing:   "Tokenizing…",
  forward_pass: "Running forward pass",
  computing:    "Computing attributions",
};

function DlaCard({
  card,
  ref,
  onStartDrag,
  onDragMove,
  onDragEnd,
  onRemove,
  tutorialMode,
}: DlaCardProps) {
  const [view, setView] = React.useState<"layer" | "head" | "top">("layer");
  const elapsedMs = useElapsedMs(card.status, card.startedAt);
  const [headerHovered, setHeaderHovered] = React.useState(false);
  const palette = useDivergingPalette();

  const canToggle = card.status === "result" && card.data != null;

  // Compute the symmetric max for rdbu anchoring
  const absMax = React.useMemo(() => {
    if (!card.data) return 1;
    if (view === "layer") {
      const vals = [
        ...card.data.layer_attn_dla ?? [],
        ...card.data.layer_mlp_dla ?? [],
        card.data.embed_dla ?? 0,
      ];
      return Math.max(1e-9, ...vals.map(Math.abs));
    }
    return Math.max(1e-9, ...card.data.head_dla.flatMap(row => row.map(Math.abs)));
  }, [card.data, view]);

  // Card width: layer/top views fixed; head view expands with n_heads.
  // 12 = body padding, 2 = card border (border-box via Tailwind preflight),
  // VALUE_W = right-aligned numeric column.
  const cardWidth = React.useMemo(() => {
    const PAD = 12 + 2;
    const VALUE_W = 44;
    if (!card.data || card.status !== "result") return 280;
    if (view === "layer") {
      // split view: two half-bars + 4px spacer (4 flex gaps); single view: one full bar (2 flex gaps)
      const barArea = card.data.layer_attn_dla != null
        ? HALF_BAR_W + 4 + HALF_BAR_W + 4 * COL_GAP
        : LAYER_BAR_W + 2 * COL_GAP;
      return Y_LABEL_W + barArea + VALUE_W + PAD;
    }
    if (view === "head") {
      return Y_LABEL_W + (HEAD_CELL_SIZE + COL_GAP) * card.data.x_labels.length + PAD;
    }
    // top view: wider label column + single bar + value
    return (Y_LABEL_W + 14) + TOP_BAR_W + VALUE_W + 2 * COL_GAP + PAD;
  }, [card.data, card.status, view]);

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
        <div className="pointer-events-none absolute bottom-[calc(100%+6px)] left-0 z-[100] min-w-[200px] max-w-[320px] animate-fade-up rounded-lg border border-card-border bg-card px-3 py-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
          <p className="m-0 break-all text-[11px] font-semibold text-foreground">
            {card.modelName}
          </p>
          <p className="m-0 mt-[5px] break-words text-[10px] leading-[1.5] text-muted">
            {card.prompt}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {card.gpuTier && <TierBadge tier={card.gpuTier} />}
            <span className="rounded-[3px] border border-card-border bg-surface-border px-[5px] py-px text-[9px] font-semibold tracking-[0.06em] text-accent">
              DLA
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

        {/* Row 2: controls (result only) */}
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
              {(["layer", "head", "top"] as const).map(v => (
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
      </div>

      {/* Loading */}
      {card.status === "loading" && (
        <div className="flex min-h-[110px] flex-col gap-2.5 px-3.5 py-3">
          <CardLoadingHeader gpuTier={card.gpuTier} elapsedMs={elapsedMs} />
          <CardLoadingState stage={card.loadingStage} labels={STAGE_LABELS} />
        </div>
      )}

      {/* Error */}
      {card.status === "error" && <CardErrorState message={card.error ?? undefined} showBuyCredits={card.showBuyCredits} showVerifyCard={card.showVerifyCard} />}

      {/* Result */}
      {card.status === "result" && card.data && (
        <div className="overflow-y-auto overflow-x-hidden bg-card p-1.5">
          {view === "layer" ? (
            <LayerView data={card.data} absMax={absMax} palette={palette} />
          ) : view === "head" ? (
            <HeadView data={card.data} absMax={absMax} palette={palette} />
          ) : (
            <TopView data={card.data} absMax={absMax} palette={palette} />
          )}
        </div>
      )}
    </div>
  );
}

const HALF_BAR_W = Math.floor(LAYER_BAR_W / 2) - 2;

function LayerView({ data, absMax, palette }: { data: DlaData; absMax: number; palette: DivergingPaletteName }) {
  const hasAttnMlp = data.layer_attn_dla != null && data.layer_mlp_dla != null;

  return (
    <div className="inline-flex flex-col" style={{ gap: COL_GAP }}>
      {/* Column header when split view is active */}
      {hasAttnMlp && (
        <div className="flex items-center" style={{ gap: COL_GAP }}>
          <div className="shrink-0" style={{ width: Y_LABEL_W }} />
          <span className="shrink-0 text-center text-[8px] tracking-[0.04em] text-muted" style={{ width: HALF_BAR_W }}>Attn</span>
          <div className="w-1 shrink-0" />
          <span className="shrink-0 text-center text-[8px] tracking-[0.04em] text-muted" style={{ width: HALF_BAR_W }}>MLP</span>
          <div className="w-11 shrink-0" />
        </div>
      )}

      {/* Embed row */}
      {data.embed_dla != null && (
        <div className="flex items-center" style={{ gap: COL_GAP }}>
          <div className={cn(yLabelCls, "italic")} style={{ width: Y_LABEL_W }}>
            emb
          </div>
          {hasAttnMlp ? (
            <>
              <DivergingBar val={data.embed_dla} absMax={absMax} palette={palette} width={LAYER_BAR_W + 4} tooltipContent={<><span className="font-semibold">Embed</span>{" "}<span className="font-mono tabular-nums">{data.embed_dla >= 0 ? "+" : ""}{data.embed_dla.toFixed(3)}</span></>} />
              <span className={valueCls}>
                {data.embed_dla >= 0 ? "+" : ""}{data.embed_dla.toFixed(2)}
              </span>
            </>
          ) : (
            <>
              <DivergingBar val={data.embed_dla} absMax={absMax} palette={palette} tooltipContent={<><span className="font-semibold">Embed</span>{" "}<span className="font-mono tabular-nums">{data.embed_dla >= 0 ? "+" : ""}{data.embed_dla.toFixed(3)}</span></>} />
              <span className={valueCls}>
                {data.embed_dla >= 0 ? "+" : ""}{data.embed_dla.toFixed(2)}
              </span>
            </>
          )}
        </div>
      )}

      {/* Per-layer rows */}
      {data.y_labels.map((label, i) => {
        const combined = data.layer_dla[i];
        const attnVal = hasAttnMlp ? data.layer_attn_dla[i] : null;
        const mlpVal = hasAttnMlp ? data.layer_mlp_dla[i] : null;
        const tooltipContent: React.ReactNode = hasAttnMlp ? (
          <>
            <div className="mb-[3px] font-semibold">{label}</div>
            <div className="flex flex-col gap-0.5 font-mono tabular-nums">
              <div className="flex justify-between gap-3.5">
                <span className="text-muted">Attn</span>
                <span>{attnVal! >= 0 ? "+" : ""}{attnVal!.toFixed(3)}</span>
              </div>
              <div className="flex justify-between gap-3.5">
                <span className="text-muted">MLP</span>
                <span>{mlpVal! >= 0 ? "+" : ""}{mlpVal!.toFixed(3)}</span>
              </div>
              <div className="mt-px flex justify-between gap-3.5 border-t border-surface-border pt-0.5">
                <span className="text-muted">Total</span>
                <span className="font-semibold">{combined >= 0 ? "+" : ""}{combined.toFixed(3)}</span>
              </div>
            </div>
          </>
        ) : (
          <><span className="font-semibold">{label}</span>{" "}<span className="font-mono tabular-nums">{combined >= 0 ? "+" : ""}{combined.toFixed(3)}</span></>
        );

        return (
          <div key={label} className="flex items-center" style={{ gap: COL_GAP }}>
            <div className={yLabelCls} style={{ width: Y_LABEL_W }}>
              {label}
            </div>

            {hasAttnMlp ? (
              <>
                <DivergingBar val={attnVal!} absMax={absMax} palette={palette} width={HALF_BAR_W} tooltipContent={tooltipContent} />
                <div className="w-1 shrink-0" />
                <DivergingBar val={mlpVal!} absMax={absMax} palette={palette} width={HALF_BAR_W} tooltipContent={tooltipContent} />
              </>
            ) : (
              <DivergingBar val={combined} absMax={absMax} palette={palette} tooltipContent={tooltipContent} />
            )}

            <span className={valueCls}>
              {combined >= 0 ? "+" : ""}{combined.toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function HeadView({ data, absMax, palette }: { data: DlaData; absMax: number; palette: DivergingPaletteName }) {
  const [tooltip, setTooltip] = React.useState<TooltipState>(null);
  return (
    <>
    <div className="inline-flex flex-col" style={{ gap: COL_GAP }}>
      {/* X-axis: head labels */}
      <div className="flex" style={{ gap: COL_GAP }}>
        <div className="shrink-0" style={{ width: Y_LABEL_W }} />
        {data.x_labels.map((h, i) => (
          <div
            key={i}
            className="shrink-0 truncate pb-0.5 text-center font-mono text-[7px] text-muted"
            style={{ width: HEAD_CELL_SIZE }}
          >
            {h}
          </div>
        ))}
      </div>

      {/* Heatmap rows */}
      {data.y_labels.map((label, li) => (
        <div key={label} className="flex items-center" style={{ gap: COL_GAP }}>
          <div className={yLabelCls} style={{ width: Y_LABEL_W }}>
            {label}
          </div>
          {data.head_dla[li].map((val, hi) => {
            const color = interpolateColorDivergent(palette, val, absMax);
            return (
              <div
                key={hi}
                onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, content: <><span className="font-semibold">{label}</span>{" H"}{hi}<br /><span className="font-mono tabular-nums">{val >= 0 ? "+" : ""}{val.toFixed(3)}</span></> })}
                onMouseLeave={() => setTooltip(null)}
                className="box-border shrink-0 rounded-sm border-[0.5px] border-surface-border"
                style={{ width: HEAD_CELL_SIZE, height: HEAD_CELL_SIZE, backgroundColor: color }}
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

const TOP_N = 15;
const TOP_BAR_W = 120;

function TopView({ data, absMax, palette }: { data: DlaData; absMax: number; palette: DivergingPaletteName }) {
  const ranked = React.useMemo(() => {
    const entries: { label: string; val: number }[] = [];
    data.head_dla.forEach((row, li) => {
      row.forEach((val, hi) => {
        entries.push({ label: `${data.y_labels[li]}H${hi}`, val });
      });
    });
    return entries.sort((a, b) => Math.abs(b.val) - Math.abs(a.val)).slice(0, TOP_N);
  }, [data]);

  return (
    <div className="inline-flex flex-col" style={{ gap: COL_GAP }}>
      {ranked.map(({ label, val }) => (
        <div key={label} className="flex items-center" style={{ gap: COL_GAP }}>
          <div className={yLabelCls} style={{ width: Y_LABEL_W + 14 }}>
            {label}
          </div>
          <DivergingBar val={val} absMax={absMax} palette={palette} width={TOP_BAR_W} height={LAYER_CELL_H} tooltipContent={<><span className="font-semibold">{label}</span>{" "}<span className="font-mono tabular-nums">{val >= 0 ? "+" : ""}{val.toFixed(3)}</span></>} />
          <span className={valueCls}>
            {val >= 0 ? "+" : ""}{val.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default React.memo(DlaCard);
