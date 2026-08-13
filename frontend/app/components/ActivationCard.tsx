"use client";

import React from "react";
import { useDivergingPalette } from "../hooks/usePalette";
import { BAND_ACTIVATION, labelForCard } from "../lib/techniques";
import { CardInfo } from "./CardInfo";
import { CardExplain } from "./CardExplain";
import { infoSectionsFor, type InfoSection } from "./card-info-content";
import {
  BandChip, CardBand, CardCloseButton, CardErrorState, CardFrame, CardHeader,
  CardLoadingHeader, CardLoadingState, CardRule, useElapsedMs,
  CARD_INSET,
} from "./CardShell";
import { BarTable, type BarColumn, type BarTableRow } from "./BarTable";
import { ACTIVATION_VALUE_W, ACTIVATION_ZONE_W, TOP_LABEL_W } from "./bar-table-geometry";
import type { LoadingStage } from "../lib/loading-stage";

const COLUMNS: BarColumn[] = [
  { header: "Attr.", width: ACTIVATION_ZONE_W },
  { header: "Effect", width: ACTIVATION_ZONE_W },
];

const STAGE_LABELS: Record<string, string> = {
  preparing:         "Caching clean activations…",
  computing_effects: "Normalizing effects…",
  patching:          "Verifying component {i} of {n}…",
};

type VerifiedComponent = {
  layer: number;
  head: number;
  component_type: string;
  attribution_score: number;
  actual_effect: number;
};

export type ActivationPatchResult = {
  total_diff: number;
  components: VerifiedComponent[];
};

export type ActivationCardData = {
  id: string;
  cardType: "activation";
  status: "loading" | "result" | "error";
  modelName: string;
  cleanPrompt: string;
  k: number;
  parentAttributionId: string;
  /** Copied from the parent attribution card at creation, for the band's chips.
   *  Null on rows saved before these were threaded through. */
  targetToken: string | null;
  contrastiveToken: string | null;
  data: ActivationPatchResult | null;
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
};

type ActivationCardProps = {
  card: ActivationCardData;
  ref?: React.Ref<HTMLDivElement>;
  onStartDrag: (e: React.PointerEvent<HTMLDivElement>, cardId: string, pos: { x: number; y: number }) => void;
  onDragMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDragEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
  onRemove: (id: string) => void;
  tutorialMode?: boolean;
  explainSections?: InfoSection[];
};

function componentLabel(c: VerifiedComponent): string {
  return c.component_type === "attn_head" ? `L${c.layer}·H${c.head}` : `L${c.layer}·MLP`;
}

const pct = (v: number) => `${v >= 0 ? "+" : "−"}${(Math.abs(v) * 100).toFixed(1)}%`;

/** Components where predicted (attribution_score) and verified (actual_effect)
 * agree on sign — the only agreement claim that holds up at k≈10 with possible
 * near-zero ties; a correlation coefficient over this few points is not a
 * meaningful statistic. */
function signAgreement(components: VerifiedComponent[]): { agree: number; total: number } {
  let agree = 0;
  for (const c of components) {
    if (Math.sign(c.attribution_score) === Math.sign(c.actual_effect)) agree++;
  }
  return { agree, total: components.length };
}

function rows(data: ActivationPatchResult, attrAbsMax: number, effectAbsMax: number): BarTableRow[] {
  return data.components.map((c, i) => {
    const label = componentLabel(c);
    return {
      key: `${label}-${i}`,
      label,
      // Two independent scales: attribution scores and effect percentages are
      // not the same unit, which is why BarSpec.absMax is per bar.
      bars: [
        { val: c.attribution_score, absMax: attrAbsMax },
        { val: c.actual_effect, absMax: effectAbsMax },
      ],
      value: pct(c.actual_effect),
      tooltip: (
        <>
          <div className="mb-[3px] font-semibold">{label}</div>
          <div className="flex flex-col gap-0.5 font-mono tabular-nums">
            <div className="flex justify-between gap-3.5">
              <span className="text-muted">attr</span>
              <span>{c.attribution_score >= 0 ? "+" : ""}{c.attribution_score.toFixed(3)}</span>
            </div>
            <div className="flex justify-between gap-3.5">
              <span className="text-muted">effect</span>
              <span>{pct(c.actual_effect)}</span>
            </div>
          </div>
        </>
      ),
    };
  });
}

function ActivationCard({
  card, ref, onStartDrag, onDragMove, onDragEnd, onRemove, tutorialMode, explainSections,
}: ActivationCardProps) {
  const elapsedMs = useElapsedMs(card.status, card.startedAt);
  const palette = useDivergingPalette();

  const data = card.status === "result" ? card.data : null;

  const attrAbsMax = React.useMemo(
    () => (data ? Math.max(1e-9, ...data.components.map(c => Math.abs(c.attribution_score))) : 1),
    [data],
  );
  const effectAbsMax = React.useMemo(
    () => (data ? Math.max(1e-9, ...data.components.map(c => Math.abs(c.actual_effect))) : 1),
    [data],
  );
  const agreement = React.useMemo(
    () => (data && data.components.length > 0 ? signAgreement(data.components) : null),
    [data],
  );
  const memoRows = React.useMemo(
    () => (data ? rows(data, attrAbsMax, effectAbsMax) : []),
    [data, attrAbsMax, effectAbsMax],
  );
  const memoSections = React.useMemo(() => infoSectionsFor(card), [card]);

  return (
    <CardFrame ref={ref} cardId={card.id} position={card.position} uncappedHeight>
      {!tutorialMode && <CardCloseButton onClick={() => onRemove(card.id)} />}

      {/* Chrome — the whole block is the drag surface; interactive children opt out */}
      <div
        onPointerDown={e => onStartDrag(e, card.id, card.position)}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        className="shrink-0 cursor-grab select-none"
      >
        <CardHeader modelName={card.modelName} prompt={card.cleanPrompt} />

        {/* BAND_ACTIVATION, not techniqueForCard: both patching cards share the
            "patching" key but not the fill. */}
        <CardBand info={
          <>
            <CardInfo
              accent={BAND_ACTIVATION}
              accentLabel={labelForCard(card.cardType)}
              sections={memoSections}
            />
            {tutorialMode && explainSections && (
              <CardExplain accent={BAND_ACTIVATION} accentLabel={labelForCard(card.cardType)} sections={explainSections} />
            )}
          </>
        }>
          {data && (
            <>
              {/* Null on rows saved before the tokens were threaded through; the
                  band degrades to accent + count rather than showing empty chips. */}
              {card.targetToken && (
                <BandChip className="min-w-0">
                  <span className="truncate" title={card.targetToken}>
                    {JSON.stringify(card.targetToken)}
                  </span>
                </BandChip>
              )}
              {card.targetToken && card.contrastiveToken && (
                <>
                  <span className="flex shrink-0 items-center text-[10px] leading-none text-muted">→</span>
                  <BandChip className="min-w-0">
                    <span className="truncate" title={card.contrastiveToken}>
                      {JSON.stringify(card.contrastiveToken)}
                    </span>
                  </BandChip>
                </>
              )}
              <div className="min-w-0 flex-1" />
              {/* Static label, not a control — the mock's 127x39 slab. `k` is also
                  a panel parameter; the duplication is deliberate, since this chip
                  is the band's only content besides the token pair. */}
              <BandChip className="shrink-0">top {card.k}</BandChip>
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

      {data && (
        <>
          <div className="pb-3" style={{ paddingInline: CARD_INSET }}>
            <BarTable
              labelW={TOP_LABEL_W}
              columns={COLUMNS}
              labelHeader="Comp."
              valueHeader=""
              valueW={ACTIVATION_VALUE_W}
              rows={memoRows}
              palette={palette}
            />
          </div>

          {/* The card's conclusion — whether the gradient approximation held.
              Paints no background, so it needs no bottom radius. */}
          {agreement !== null && (
            <div
              className="shrink-0 border-t border-card-border py-2"
              style={{ marginInline: CARD_INSET }}
            >
              <span className="text-[9px] text-muted">
                sign agreement: {agreement.agree}/{agreement.total} components
              </span>
            </div>
          )}
        </>
      )}
    </CardFrame>
  );
}

export default React.memo(ActivationCard);
