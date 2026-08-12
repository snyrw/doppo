"use client";

import React from "react";
import { useDivergingPalette } from "../hooks/usePalette";
import { techniqueForCard } from "../lib/techniques";
import { CardInfo } from "./CardInfo";
import { CardExplain } from "./CardExplain";
import { infoSectionsFor, type InfoSection } from "./card-info-content";
import {
  BandChip, CardBand, CardCloseButton, CardErrorState, CardFrame, CardHeader,
  CardLoadingHeader, CardLoadingState, CardRule, CardScrollArea, ViewStrip,
  CARD_INSET, CARD_MAX_W, CARD_MIN_W, useElapsedMs,
} from "./CardShell";
import { BarTable, type BarColumn, type BarTableRow } from "./BarTable";
import { HeadView } from "./HeadGrid";
import {
  LAYER_LABEL_W, LAYER_ZONE_W, TOP_LABEL_W, TOP_ZONE_W, headViewWidth, signed,
} from "./bar-table-geometry";
import type { LoadingStage } from "../lib/loading-stage";

const TECHNIQUE = techniqueForCard("dla");

const TOP_N = 15;

const VIEWS = ["layer", "head", "top"] as const;
type View = (typeof VIEWS)[number];

const LAYER_COLUMNS: BarColumn[] = [
  { header: "Attn", width: LAYER_ZONE_W },
  { header: "MLP", width: LAYER_ZONE_W },
];

/** One zone, unlabelled: with a single column the bar and the value are the same number. */
const TOP_COLUMNS: BarColumn[] = [{ header: "", width: TOP_ZONE_W }];

const STAGE_LABELS: Record<string, string> = {
  tokenizing:   "Tokenizing…",
  forward_pass: "Running forward pass",
  computing:    "Computing attributions",
};

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
  /** Set by the CARD_RESOLVED reducer. Absent on rows saved before this existed. */
  finishedAt?: number;
  /** True when the spawn short-circuited on a cache hit — no GPU time was billed. */
  cached?: boolean;
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
  explainSections?: InfoSection[];
};

const VIEW_LABELS: Record<View, string> = { layer: "Layer", head: "Head", top: "Top" };

function layerRows(data: DlaData, absMax: number): BarTableRow[] {
  const rows: BarTableRow[] = [];

  // One scalar, so one bar across both zones. The mock draws two bars on this
  // row — that is it showing a populated row, not embed having a split.
  if (data.embed_dla != null) {
    rows.push({
      key: "emb",
      label: "emb",
      labelItalic: true,
      bars: [{ val: data.embed_dla, absMax, span: 2 }],
      value: signed(data.embed_dla),
      tooltip: (
        <>
          <span className="font-semibold">Embed</span>{" "}
          <span className="font-mono tabular-nums">{signed(data.embed_dla, 3)}</span>
        </>
      ),
    });
  }

  data.y_labels.forEach((label, i) => {
    const attn = data.layer_attn_dla[i];
    const mlp = data.layer_mlp_dla[i];
    const total = data.layer_dla[i];
    rows.push({
      key: label,
      label,
      bars: [{ val: attn, absMax }, { val: mlp, absMax }],
      value: signed(total),
      tooltip: (
        <>
          <div className="mb-[3px] font-semibold">{label}</div>
          <div className="flex flex-col gap-0.5 font-mono tabular-nums">
            <div className="flex justify-between gap-3.5">
              <span className="text-muted">Attn</span><span>{signed(attn, 3)}</span>
            </div>
            <div className="flex justify-between gap-3.5">
              <span className="text-muted">MLP</span><span>{signed(mlp, 3)}</span>
            </div>
            <div className="mt-px flex justify-between gap-3.5 border-t border-surface-border pt-0.5">
              <span className="text-muted">Total</span>
              <span className="font-semibold">{signed(total, 3)}</span>
            </div>
          </div>
        </>
      ),
    });
  });

  return rows;
}

function topRows(data: DlaData, absMax: number): BarTableRow[] {
  const entries: { label: string; val: number }[] = [];
  data.head_dla.forEach((row, li) => {
    row.forEach((val, hi) => {
      entries.push({ label: `${data.y_labels[li]}·H${hi}`, val });
    });
  });
  return entries
    .sort((a, b) => Math.abs(b.val) - Math.abs(a.val))
    .slice(0, TOP_N)
    .map(({ label, val }) => ({
      key: label,
      label,
      bars: [{ val, absMax }],
      value: signed(val),
      tooltip: (
        <>
          <span className="font-semibold">{label}</span>{" "}
          <span className="font-mono tabular-nums">{signed(val, 3)}</span>
        </>
      ),
    }));
}

function DlaCard({ card, ref, onStartDrag, onDragMove, onDragEnd, onRemove, tutorialMode, explainSections }: DlaCardProps) {
  const [view, setView] = React.useState<View>("layer");
  const elapsedMs = useElapsedMs(card.status, card.startedAt);
  const palette = useDivergingPalette();

  const data = card.status === "result" ? card.data : null;

  const absMax = React.useMemo(() => {
    if (!data) return 1;
    if (view === "layer") {
      return Math.max(1e-9, ...[
        ...(data.layer_attn_dla ?? []),
        ...(data.layer_mlp_dla ?? []),
        data.embed_dla ?? 0,
      ].map(Math.abs));
    }
    return Math.max(1e-9, ...data.head_dla.flatMap(row => row.map(Math.abs)));
  }, [data, view]);

  const memoLayerRows = React.useMemo(() => (data ? layerRows(data, absMax) : []), [data, absMax]);
  const memoTopRows = React.useMemo(() => (data ? topRows(data, absMax) : []), [data, absMax]);
  const memoSections = React.useMemo(() => infoSectionsFor(card), [card]);

  // Only the head view sizes to its data; the two tables always fit CARD_MIN_W.
  const cardWidth = data && view === "head"
    ? headViewWidth(data.x_labels.length, CARD_INSET, CARD_MIN_W, CARD_MAX_W)
    : CARD_MIN_W;

  return (
    <CardFrame ref={ref} cardId={card.id} position={card.position} width={cardWidth}>
      {!tutorialMode && <CardCloseButton onClick={() => onRemove(card.id)} />}

      {/* Chrome — the whole block is the drag surface; interactive children opt out */}
      <div
        onPointerDown={e => onStartDrag(e, card.id, card.position)}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        className="shrink-0 cursor-grab select-none"
      >
        <CardHeader modelName={card.modelName} prompt={card.prompt} />

        {/* The tier badge moved into the panel. The ViewStrip stays: it is
            one-click view selection, which is what the band is for. */}
        <CardBand info={
          <>
            <CardInfo
              accent={TECHNIQUE.band}
              accentLabel={TECHNIQUE.name}
              sections={memoSections}
            />
            {tutorialMode && explainSections && (
              <CardExplain accent={TECHNIQUE.band} accentLabel={TECHNIQUE.name} sections={explainSections} />
            )}
          </>
        }>
          {data && (
            <>
              {/* Tokens truncate before the strip does — they are the variable-width
                  part, and a clipped switcher would be unusable where a clipped
                  token is merely abbreviated (full value on hover). */}
              <BandChip className="min-w-0">
                <span className="truncate" title={data.target_token}>
                  {JSON.stringify(data.target_token)}
                </span>
              </BandChip>
              {data.contrastive_token && (
                <>
                  <span className="flex shrink-0 items-center text-[10px] leading-none text-muted">→</span>
                  <BandChip className="min-w-0">
                    <span className="truncate" title={data.contrastive_token}>
                      {JSON.stringify(data.contrastive_token)}
                    </span>
                  </BandChip>
                </>
              )}
              <div className="min-w-0 flex-1" />
              <ViewStrip views={VIEWS} labels={VIEW_LABELS} view={view} onChange={setView} />
            </>
          )}
        </CardBand>

        <CardRule />
      </div>

      {card.status === "loading" && (
        <div className="flex min-h-[110px] flex-col gap-2.5 px-5 py-3">
          <CardLoadingHeader gpuTier={card.gpuTier} elapsedMs={elapsedMs} />
          <CardLoadingState stage={card.loadingStage} labels={STAGE_LABELS} />
        </div>
      )}

      {card.status === "error" && (
        <CardErrorState
          message={card.error ?? undefined}
          showBuyCredits={card.showBuyCredits}
          showVerifyCard={card.showVerifyCard}
        />
      )}

      {data && view === "head" && (
        <HeadView
          values={data.head_dla}
          xLabels={data.x_labels}
          yLabels={data.y_labels}
          absMax={absMax}
          palette={palette}
          cardWidth={cardWidth}
        />
      )}

      {/* pb keeps the last row clear of the frame's bottom edge. */}
      {data && view !== "head" && (
        <CardScrollArea>
          <div className="pb-3" style={{ paddingInline: CARD_INSET }}>
            {view === "layer" ? (
              <BarTable
                labelW={LAYER_LABEL_W}
                columns={LAYER_COLUMNS}
                labelHeader=""
                valueHeader="Logit"
                rows={memoLayerRows}
                palette={palette}
              />
            ) : (
              <BarTable
                labelW={TOP_LABEL_W}
                columns={TOP_COLUMNS}
                labelHeader="Head"
                valueHeader="Logit"
                rows={memoTopRows}
                palette={palette}
              />
            )}
          </div>
        </CardScrollArea>
      )}
    </CardFrame>
  );
}

export default React.memo(DlaCard);
