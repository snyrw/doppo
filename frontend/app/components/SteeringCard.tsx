"use client";

import React from "react";
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
  CardScrollArea,
  CARD_INSET,
  CARD_MAX_W,
  useElapsedMs,
} from "./CardShell";
import { cn } from "../lib/cn";
import { techniqueForCard } from "../lib/techniques";
import { CardInfo } from "./CardInfo";
import { CardExplain } from "./CardExplain";
import { infoSectionsFor, type InfoSection } from "./card-info-content";
import {
  canStep,
  displayPrompt,
  formatAlpha,
  stepAlpha,
} from "./steering-alpha";
import { BAND_ACCENT_W, BAND_GAP } from "./card-geometry";
import type { LoadingStage } from "../lib/loading-stage";

const TECHNIQUE = techniqueForCard("steering");

/* The body columns mirror the band's own flex distribution rather than
   recomputing it. Each takes 1fr of the remainder exactly as the two `flex-1`
   chips above do, so CSS owns the split and there is no second copy of the
   arithmetic to drift out of step.

   The fixed bases are the band furniture each column sits beneath: the left
   column spans the accent square, the gap after it, and half the gap between the
   chips; the right column spans the other half. */
const LEFT_BASIS = BAND_ACCENT_W + BAND_GAP + BAND_GAP / 2;
const RIGHT_BASIS = BAND_GAP / 2;

export type SteeringComponent = {
  layer: number;
  // Legacy fields on old DB rows — ignored; all steering is now residual-stream.
  head?: number | null;
  injectionType?: string;
};

type SteeringStats = {
  layer: number;
  vector_norm: number;
  resid_norm: number;
  pair_cos: number[] | null;
};

export type SteeringResult = {
  steered_text: string;
  baseline_text: string;
  top_k_steered: Array<{ token: string; prob: number }>;
  top_k_baseline: Array<{ token: string; prob: number }>;
  logit_diff: number;
  steering_stats?: SteeringStats[];  // absent on results computed before it existed
};

export type SteeringCardData = {
  id: string;
  cardType: "steering";
  status: "loading" | "result" | "error";
  modelName: string;
  cleanPrompt: string;
  corruptedPrompt: string;
  generationPrompt?: string;
  targetPosition: number | "last";
  targetToken: string | null;
  components: SteeringComponent[];
  alpha: number;
  temperature: number;
  repetitionPenalty: number;
  nTokens: number;
  nPairs: number;
  extraPairs?: Array<{ clean: string; corrupted: string }>;
  data: SteeringResult | null;
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

type SteeringCardProps = {
  card: SteeringCardData;
  ref?: React.Ref<HTMLDivElement>;
  onStartDrag: (e: React.PointerEvent<HTMLDivElement>, cardId: string, pos: { x: number; y: number }) => void;
  onDragMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDragEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
  onRemove: (id: string) => void;
  onRerun: (cardId: string, newAlpha: number) => void;
  tutorialMode?: boolean;
  explainSections?: InfoSection[];
};

const STAGE_LABELS: Record<string, string> = {
  computing: "Computing DIM vectors…",
  token: "Generating steered text…",
};

function SteeringCard({
  card,
  ref,
  onStartDrag,
  onDragMove,
  onDragEnd,
  onRemove,
  onRerun,
  tutorialMode,
  explainSections,
}: SteeringCardProps) {
  const elapsedMs = useElapsedMs(card.status, card.startedAt);
  const [localAlpha, setLocalAlpha] = React.useState(card.alpha);

  // Re-sync when the card's alpha changes underneath us — a re-run writes the
  // new value in the same dispatch that clears `data`, which is what makes the
  // dirty state below resolve itself.
  React.useEffect(() => { setLocalAlpha(card.alpha); }, [card.alpha]);

  const loading = card.status === "loading";
  const dirty = !tutorialMode && !loading && localAlpha !== card.alpha;
  const stepperDisabled = tutorialMode || loading;
  const memoSections = React.useMemo(() => infoSectionsFor(card), [card]);

  /* Alpha, its vector diagnostics, and the Re-run that commits it.
     The diagnostics stay here rather than in `infoSectionsFor` because they are
     computed from the *live* alpha, not from the card — the panel recomputes
     them as you step, before any re-run has happened.

     The function form is what lets Re-run dismiss the panel: the regenerated
     text lands in the card body behind it. Stepping alpha leaves it open. */
  const steeringControls = (close: () => void) => (
    <div className="flex flex-col gap-2.5">
      {card.data?.steering_stats && card.data.steering_stats.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-semibold text-muted">Vector</span>
          {card.data.steering_stats.map((s, i) => {
            const relStrength = s.resid_norm > 0
              ? (Math.abs(localAlpha) * s.vector_norm) / s.resid_norm
              : 0;
            const cos = s.pair_cos;
            const meanCos = cos && cos.length > 0 ? cos.reduce((a, b) => a + b, 0) / cos.length : null;
            const minCos = cos && cos.length > 0 ? Math.min(...cos) : null;
            const nOpposed = cos ? cos.filter(c => c < 0).length : 0;
            return (
              <div key={i} className="flex flex-col gap-0.5 font-mono text-[9px] text-muted">
                <span title="‖αv‖ relative to the residual stream’s mean norm at this layer">
                  L{s.layer} ‖αv‖/‖resid‖ <span className="text-foreground">{relStrength.toFixed(2)}</span>
                </span>
                {meanCos !== null && minCos !== null && (
                  <span title="Cosine of each pair’s difference vector against the mean — low or negative pairs pull against the direction">
                    pair coherence <span className="text-foreground">{meanCos.toFixed(2)}</span> mean
                    {" · "}<span className={cn(minCos < 0 && "text-red-600")}>{minCos.toFixed(2)}</span> min
                    {nOpposed > 0 && <span className="text-red-600"> · {nOpposed} opposed</span>}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] leading-[15px] text-muted">Alpha</span>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={() => setLocalAlpha(a => stepAlpha(a, -1))}
            disabled={stepperDisabled || !canStep(localAlpha, -1)}
            aria-label="Decrease alpha"
            className="cursor-pointer border-none bg-transparent p-0 text-[11px] leading-none text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >←</button>
          <span className="font-mono text-[10px] leading-none tabular-nums text-foreground">
            {formatAlpha(localAlpha)}
          </span>
          <button
            onClick={() => setLocalAlpha(a => stepAlpha(a, 1))}
            disabled={stepperDisabled || !canStep(localAlpha, 1)}
            aria-label="Increase alpha"
            className="cursor-pointer border-none bg-transparent p-0 text-[11px] leading-none text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >→</button>
        </div>
      </div>

      {dirty && (
        <button
          onClick={() => { onRerun(card.id, localAlpha); close(); }}
          className="rounded-[var(--ctl-radius-xs)] cursor-pointer self-start whitespace-nowrap border-none bg-accent px-[7px] py-0.5 text-[9px] font-semibold text-accent-fg transition-transform active:translate-y-px"
        >
          Re-run →
        </button>
      )}
    </div>
  );

  /* No `elevated` on CardFrame: the info panel portals to document.body, so it
     already clears every neighbouring card and has no z-index to negotiate. */
  return (
    <CardFrame ref={ref} cardId={card.id} position={card.position} width={CARD_MAX_W}>
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
          prompt={displayPrompt(card.generationPrompt, card.cleanPrompt)}
        />

        {/* Two plain labels now that alpha has moved into the panel. Both chips
            are `flex-1`, and the body columns below mirror that same
            distribution — which is what places the divider. */}
        <CardBand info={
          <>
            <CardInfo
              accent={TECHNIQUE.band}
              accentLabel={TECHNIQUE.name}
              sections={memoSections}
              controls={steeringControls}
            />
            {tutorialMode && explainSections && (
              <CardExplain accent={TECHNIQUE.band} accentLabel={TECHNIQUE.name} sections={explainSections} />
            )}
          </>
        }>
          <BandChip className="min-w-0 flex-1">Base</BandChip>
          <BandChip className="min-w-0 flex-1">Steered</BandChip>
        </CardBand>

        <CardRule />
      </div>

      {loading && (
        <div className="flex flex-col gap-2.5 px-5 py-3">
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

      {card.status === "result" && card.data && (
        <CardScrollArea>
          {/* items-stretch so the divider spans the full scroll content height,
              not the viewport. Aligned to CARD_INSET, not CARD_BODY_PAD: the
              columns share the column CardRule uses. */}
          <div
            onPointerDown={e => e.stopPropagation()}
            className="flex items-stretch"
            style={{ paddingInline: CARD_INSET, paddingBlock: 20 }}
          >
            {/* The columns carry no padding of their own, and the text gutters
                sit on inner blocks instead. `flex-basis` is a BORDER-BOX size, so
                an item can never resolve below its own padding + border: with
                `pl-3.5` on the right column its 3px basis was floored to 14,
                which shifted the split by 5.5px. Folding the padding into the
                bases fixes the split but makes the free space odd, putting both
                columns on half pixels — so the padding moves inward instead and
                the bases stay pure.

                The divider is the left column's right border rather than a track
                of its own: a separate 1px track would leave an odd remainder and
                land the rule on a half pixel. `min-w-0` lets long unbroken
                generated text wrap instead of forcing the row wider. */}
            <div
              className="min-w-0 border-r border-card-border"
              style={{ flex: `1 1 ${LEFT_BASIS}px` }}
            >
              <div className="whitespace-pre-wrap break-words pr-3.5 text-[12px] leading-[1.6] text-foreground">
                {card.data.baseline_text}
              </div>
            </div>
            <div className="min-w-0" style={{ flex: `1 1 ${RIGHT_BASIS}px` }}>
              <div className="whitespace-pre-wrap break-words pl-3.5 text-[12px] leading-[1.6] text-foreground">
                {card.data.steered_text}
              </div>
            </div>
          </div>
        </CardScrollArea>
      )}
    </CardFrame>
  );
}

export default React.memo(SteeringCard);
