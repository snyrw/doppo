"use client";

import React from "react";
import { techniqueForCard } from "../lib/techniques";
import { CardInfo } from "./CardInfo";
import { CardExplain } from "./CardExplain";
import { infoSectionsFor, type InfoSection } from "./card-info-content";
import { useDivergingPalette } from "../hooks/usePalette";
import { cn } from "../lib/cn";
import { TOP_N_OPTIONS, type TopN } from "../lib/patching";
import {
  BandChip, CardBand, CardCloseButton, CardErrorState, CardFrame, CardHeader,
  CardLoadingHeader, CardLoadingState, CardRule, ViewStrip,
  CARD_INSET, CARD_MIN_W, useElapsedMs,
} from "./CardShell";
import { BarTable, type BarColumn, type BarTableRow } from "./BarTable";
import { HeadView } from "./HeadGrid";
import {
  HEAD_VIEW_MAX_W, LAYER_LABEL_W, LAYER_ZONE_W, TOP_LABEL_W, TOP_ZONE_W, headViewWidth, signed,
} from "./bar-table-geometry";
import type { LoadingStage } from "../lib/loading-stage";

const TECHNIQUE = techniqueForCard("attribution");

const VIEWS = ["layer", "head", "top"] as const;
type View = (typeof VIEWS)[number];
const VIEW_LABELS: Record<View, string> = { layer: "Layer", head: "Head", top: "Top" };

const LAYER_COLUMNS: BarColumn[] = [
  { header: "Attn", width: LAYER_ZONE_W },
  { header: "MLP", width: LAYER_ZONE_W },
];
const TOP_COLUMNS: BarColumn[] = [{ header: "", width: TOP_ZONE_W }];

const DEFAULT_TOP_N: TopN = 10;

const STAGE_LABELS: Record<string, string> = {
  tokenizing:                 "Tokenizing…",
  clean_forward_pass:         "Running reference forward pass",
  corrupted_forward_backward: "Running counterfactual pass + backward",
  computing_attribution:      "Computing attributions",
};

type TopKComponent = {
  layer: number;
  head: number;
  component_type: "attn_head" | "mlp";
  attribution_score: number;
};

export type AttributionData = {
  target_token: string;
  target_token_idx: number;
  contrastive_token: string | null;
  contrastive_token_idx: number | null;
  target_position: number;
  y_labels: string[];
  x_labels: string[];
  layer_attribution: number[];
  /** Absent on rows cached before the attn/mlp split existed. */
  layer_attn_attribution?: number[];
  layer_mlp_attribution?: number[];
  head_attribution: number[][];
  top_k_components: TopKComponent[];
};

export type AttributionCardData = {
  id: string;
  cardType: "attribution";
  status: "loading" | "result" | "error";
  modelName: string;
  cleanPrompt: string;
  corruptedPrompt: string;
  data: AttributionData | null;
  error: string | null;
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
  verifyStatus?: "idle" | "loading" | "done";
};

type AttributionCardProps = {
  card: AttributionCardData;
  ref?: React.Ref<HTMLDivElement>;
  onStartDrag: (e: React.PointerEvent<HTMLDivElement>, cardId: string, pos: { x: number; y: number }) => void;
  onDragMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDragEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
  onRemove: (id: string) => void;
  onVerifyTopK: (cardId: string, k: number) => void;
  tutorialMode?: boolean;
  explainSections?: InfoSection[];
};

const componentLabel = (c: TopKComponent) =>
  c.component_type === "attn_head" ? `L${c.layer}·H${c.head}` : `L${c.layer}·MLP`;

function layerRows(data: AttributionData, absMax: number): BarTableRow[] {
  const { layer_attn_attribution: attnArr, layer_mlp_attribution: mlpArr } = data;
  return data.y_labels.map((label, i) => {
    const total = data.layer_attribution[i];

    // Cache rows from before the split existed: one bar spanning both zones,
    // same as DLA's embed row when it has no attn/mlp breakdown either.
    if (!attnArr || !mlpArr) {
      return {
        key: label,
        label,
        bars: [{ val: total, absMax, span: 2 }],
        value: signed(total),
        tooltip: (
          <>
            <span className="font-semibold">{label}</span>{" "}
            <span className="font-mono tabular-nums">{signed(total, 3)}</span>
          </>
        ),
      };
    }

    const attn = attnArr[i];
    const mlp = mlpArr[i];
    return {
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
    };
  });
}

function topRows(data: AttributionData, topN: number): BarTableRow[] {
  const rows = data.top_k_components.slice(0, topN);
  // Sorted by |score| upstream, so the first row sets the scale.
  const absMax = Math.max(1e-9, ...rows.map(c => Math.abs(c.attribution_score)));
  return rows.map(c => {
    const label = componentLabel(c);
    return {
      key: label,
      label,
      bars: [{ val: c.attribution_score, absMax }],
      value: signed(c.attribution_score),
      tooltip: (
        <>
          <span className="font-semibold">{label}</span>{" "}
          <span className="font-mono tabular-nums">{signed(c.attribution_score, 3)}</span>
        </>
      ),
    };
  });
}

/**
 * The one number that governs both the Top view's row count and how many
 * components Verify patches — so "Top shows exactly what Verify will patch"
 * holds at every setting. It sits directly above Verify in the info panel for
 * that reason.
 *
 * Hidden in tutorial mode: handleVerifyTopK there ignores k and spawns a card
 * precomputed at 10, so offering 5 or 20 would be a control that does nothing.
 * Verify itself stays — it is the tutorial's only route to an activation card.
 */
function TopNPicker({ topN, onChange }: { topN: TopN; onChange: (n: TopN) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px] font-semibold text-muted">Top components</span>
      <div className="flex gap-[3px]">
        {TOP_N_OPTIONS.map(n => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={cn(
              "cursor-pointer rounded-[var(--ctl-radius-xs)] border border-card-border px-[7px] py-0.5 text-[9px]",
              topN === n ? "bg-accent text-accent-fg" : "bg-surface-border text-muted",
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Spawns the activation card. Lives in the info panel with the top-N that drives
 * its `k`.
 */
function VerifyChip({
  status, topN, onClick,
}: {
  status: "idle" | "loading" | "done";
  topN: TopN;
  onClick: () => void;
}) {
  if (status === "done") {
    return (
      <span className="flex h-[18px] shrink-0 items-center bg-surface-border px-2 text-[10px] leading-none text-foreground">
        ✓ Verified
      </span>
    );
  }
  return (
    <button
      onPointerDown={e => e.stopPropagation()}
      onClick={onClick}
      disabled={status === "loading"}
      className="flex h-[18px] shrink-0 cursor-pointer items-center gap-1 border-none bg-surface-border px-2 text-[10px] leading-none text-foreground disabled:cursor-not-allowed disabled:text-muted"
    >
      {status === "loading" ? (
        <>
          <span className="h-2 w-2 animate-spinner rounded-full border-[1.5px] border-current border-t-transparent" />
          Verifying
        </>
      ) : (
        `Verify ${topN} →`
      )}
    </button>
  );
}

function AttributionCard({
  card, ref, onStartDrag, onDragMove, onDragEnd, onRemove, onVerifyTopK, tutorialMode, explainSections,
}: AttributionCardProps) {
  const [view, setView] = React.useState<View>("layer");
  const [topN, setTopN] = React.useState<TopN>(DEFAULT_TOP_N);
  const elapsedMs = useElapsedMs(card.status, card.startedAt);
  const palette = useDivergingPalette();

  const data = card.status === "result" ? card.data : null;
  const verifyStatus = card.verifyStatus ?? "idle";

  const absMax = React.useMemo(() => {
    if (!data) return 1;
    if (view === "layer") {
      return Math.max(1e-9, ...[
        ...data.layer_attribution,
        ...(data.layer_attn_attribution ?? []),
        ...(data.layer_mlp_attribution ?? []),
      ].map(Math.abs));
    }
    return Math.max(1e-9, ...data.head_attribution.flatMap(row => row.map(Math.abs)));
  }, [data, view]);

  const memoLayerRows = React.useMemo(() => (data ? layerRows(data, absMax) : []), [data, absMax]);
  const memoTopRows = React.useMemo(() => (data ? topRows(data, topN) : []), [data, topN]);
  const memoSections = React.useMemo(() => infoSectionsFor(card), [card]);

  // Only the head view sizes to its data; the two tables always fit CARD_MIN_W.
  const cardWidth = data && view === "head"
    ? headViewWidth(data.x_labels.length, CARD_INSET, CARD_MIN_W, HEAD_VIEW_MAX_W)
    : CARD_MIN_W;

  /* Top-N sits directly above the Verify it drives, so "Top shows exactly what
     Verify patches" is visible as one block. The function form is what lets
     Verify dismiss the panel — the activation card it spawns lands on the canvas
     behind it. Changing top-N leaves the panel open. */
  const verifyControls = (close: () => void) => (
    <div className="flex flex-col gap-2">
      {!tutorialMode && <TopNPicker topN={topN} onChange={setTopN} />}
      <VerifyChip
        status={verifyStatus}
        topN={topN}
        onClick={() => { onVerifyTopK(card.id, topN); close(); }}
      />
    </div>
  );

  return (
    <CardFrame ref={ref} cardId={card.id} position={card.position} width={cardWidth} uncappedHeight>
      {!tutorialMode && <CardCloseButton onClick={() => onRemove(card.id)} />}

      {/* Chrome — the whole block is the drag surface; interactive children opt out */}
      <div
        onPointerDown={e => onStartDrag(e, card.id, card.position)}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        className="shrink-0 cursor-grab select-none"
      >
        <CardHeader
          modelName={card.modelName}
          prompt={card.cleanPrompt}
          subPrompt={card.corruptedPrompt || undefined}
        />

        <CardBand info={
          <>
            <CardInfo
              accent={TECHNIQUE.band}
              accentLabel={TECHNIQUE.name}
              sections={memoSections}
              controls={data ? verifyControls : undefined}
            />
            {tutorialMode && explainSections && (
              <CardExplain accent={TECHNIQUE.band} accentLabel={TECHNIQUE.name} sections={explainSections} />
            )}
          </>
        }>
          {data && (
            <>
              {/* Tokens truncate before the strip does — a clipped switcher is
                  unusable where a clipped token is merely abbreviated. */}
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
        <CardErrorState message={card.error ?? undefined} />
      )}

      {data && view === "head" && (
        <HeadView
          values={data.head_attribution}
          xLabels={data.x_labels}
          yLabels={data.y_labels}
          absMax={absMax}
          palette={palette}
          cardWidth={cardWidth}
        />
      )}

      {/* pb keeps the last row clear of the frame's bottom edge. */}
      {data && view !== "head" && (
        <div className="pb-3" style={{ paddingInline: CARD_INSET }}>
          {view === "layer" ? (
            <BarTable
              labelW={LAYER_LABEL_W}
              columns={LAYER_COLUMNS}
              labelHeader=""
              valueHeader="≈Logit"
              rows={memoLayerRows}
              palette={palette}
            />
          ) : (
            <BarTable
              labelW={TOP_LABEL_W}
              columns={TOP_COLUMNS}
              labelHeader="Comp."
              valueHeader="≈Logit"
              rows={memoTopRows}
              palette={palette}
            />
          )}
        </div>
      )}
    </CardFrame>
  );
}

export default React.memo(AttributionCard);
