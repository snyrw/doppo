"use client";

import React from "react";
import { interpolateColorDivergent } from "../lib/palette";
import { TIER_LABELS } from "../lib/tiers";
import type { SteeringComponent } from "./SteeringCard";
import { CardDragHandle, CardLoadingState, CardErrorState, CardLoadingHeader, useElapsedMs } from "./CardShell";
import { HoverTooltip, type TooltipState } from "../lib/tooltip";

export type VerifiedComponent = {
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
  data: ActivationPatchResult | null;
  error: string | null;
  showBuyCredits?: boolean;
  position: { x: number; y: number };
  gpuTier?: string;
  startedAt?: number;
  loadingStage?: string;
};

type ActivationCardProps = {
  card: ActivationCardData;
  ref?: React.Ref<HTMLDivElement>;
  onStartDrag: (e: React.PointerEvent<HTMLDivElement>, cardId: string, pos: { x: number; y: number }) => void;
  onDragMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDragEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
  onRemove: (id: string) => void;
  onSteerComponents: (cardId: string, components: SteeringComponent[]) => void;
  tutorialMode?: boolean;
};

function getStageLabel(stage: string | undefined, elapsedMs: number): string {
  if (!stage) return elapsedMs > 30_000 ? "GPU container is starting…" : "Connecting to GPU…";
  if (stage.startsWith("patching_")) {
    const match = stage.match(/patching_(\d+)_of_(\d+)/);
    if (match) return `Verifying component ${match[1]} of ${match[2]}`;
  }
  const labels: Record<string, string> = {
    tokenizing: "Tokenizing…",
    preparing: "Caching clean activations",
    computing_effects: "Normalizing effects",
  };
  return labels[stage] ?? "Processing…";
}

function matchLabel(effect: number): { text: string; color: string; bg: string; border: string } {
  if (effect < 0) return { text: "Counter", color: "#9333ea", bg: "rgba(147,51,234,0.08)", border: "rgba(147,51,234,0.25)" };
  if (effect > 0.7) return { text: "High", color: "#16a34a", bg: "rgba(22,163,74,0.08)", border: "rgba(22,163,74,0.25)" };
  if (effect > 0.3) return { text: "Mid", color: "#d97706", bg: "rgba(217,119,6,0.08)", border: "rgba(217,119,6,0.25)" };
  return { text: "Low", color: "#dc2626", bg: "rgba(220,38,38,0.08)", border: "rgba(220,38,38,0.25)" };
}

function spearmanCorrelation(xs: number[], ys: number[]): number {
  if (xs.length < 2) return 0;
  const rank = (arr: number[]) => {
    const sorted = [...arr].map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
    const ranks = new Array(arr.length);
    sorted.forEach(({ i }, r) => { ranks[i] = r + 1; });
    return ranks;
  };
  const rx = rank(xs);
  const ry = rank(ys);
  const n = xs.length;
  const d2 = rx.reduce((s, r, i) => s + (r - ry[i]) ** 2, 0);
  return 1 - (6 * d2) / (n * (n * n - 1));
}

function ActivationCard({
  card,
  ref,
  onStartDrag,
  onDragMove,
  onDragEnd,
  onRemove,
  onSteerComponents,
  tutorialMode,
}: ActivationCardProps) {
  const elapsedMs = useElapsedMs(card.status, card.startedAt);
  const [headerHovered, setHeaderHovered] = React.useState(false);
  const [selectedComponents, setSelectedComponents] = React.useState<SteeringComponent[]>([]);
  const [tooltip, setTooltip] = React.useState<TooltipState>(null);

  const spearman = React.useMemo(() => {
    if (!card.data) return null;
    const { components } = card.data;
    if (components.length < 2) return null;
    return spearmanCorrelation(
      components.map(c => c.attribution_score),
      components.map(c => c.actual_effect)
    );
  }, [card.data]);

  const attrAbsMax = React.useMemo(() => {
    if (!card.data) return 1;
    return Math.max(1e-9, ...card.data.components.map(c => Math.abs(c.attribution_score)));
  }, [card.data]);

  return (
    <div
      ref={ref}
      data-card-id={card.id}
      style={{
        position: "absolute",
        left: card.position.x,
        top: card.position.y,
        zIndex: 10,
        width: 320,
        background: "var(--color-card)",
        borderRadius: 8,
        border: "1px solid var(--color-card-border)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        display: "flex",
        flexDirection: "column",
      }}
    >

      {/* Hover popup */}
      {headerHovered && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: 0,
          background: "var(--color-card)", border: "1px solid var(--color-card-border)",
          borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          padding: "10px 12px", zIndex: 100, pointerEvents: "none",
          minWidth: 200, maxWidth: 300,
        }}>
          <p style={{ fontSize: 11, fontWeight: 600, margin: 0, color: "var(--color-text)", fontFamily: "var(--font-ibm-plex-sans), sans-serif", wordBreak: "break-all" }}>
            {card.modelName}
          </p>
          <p style={{ fontSize: 10, color: "var(--color-text-muted)", margin: "5px 0 0", lineHeight: 1.5, fontFamily: "var(--font-ibm-plex-sans), sans-serif", wordBreak: "break-word" }}>
            {card.cleanPrompt}
          </p>
          <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
            {card.gpuTier && (
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", color: "var(--color-accent)", background: "var(--color-surface-border)", border: "1px solid var(--color-card-border)", borderRadius: 3, padding: "1px 5px" }}>
                {TIER_LABELS[card.gpuTier] ?? card.gpuTier}
              </span>
            )}
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", color: "var(--color-accent)", background: "var(--color-surface-border)", border: "1px solid var(--color-card-border)", borderRadius: 3, padding: "1px 5px" }}>
              Activation Patch
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
          padding: "7px 10px", borderBottom: "1px solid var(--color-surface-border)",
          display: "flex", alignItems: "center", gap: 6,
          cursor: "grab", userSelect: "none", flexShrink: 0,
          borderRadius: "8px 8px 0 0",
        }}
      >
        <CardDragHandle />
        <span style={{ fontSize: 11, color: "var(--color-text)", fontWeight: 600, flexShrink: 0 }}>
          Activation Patch
        </span>
        <span style={{ fontSize: 10, color: "var(--color-text-muted)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          top {card.k}
        </span>
        {!tutorialMode && (
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={() => onRemove(card.id)}
            style={{ fontSize: 12, color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer", padding: "0 2px", flexShrink: 0, lineHeight: 1 }}
          >
            ×
          </button>
        )}
      </div>

      {/* Loading */}
      {card.status === "loading" && (
        <div style={{ display: "flex", flexDirection: "column", padding: "12px 14px", gap: 10, minHeight: 110 }}>
          <CardLoadingHeader gpuTier={card.gpuTier} elapsedMs={elapsedMs} />
          <CardLoadingState stage={getStageLabel(card.loadingStage, elapsedMs)} />
        </div>
      )}

      {/* Error */}
      {card.status === "error" && <CardErrorState message={card.error ?? undefined} showBuyCredits={card.showBuyCredits} />}

      {/* Result */}
      {card.status === "result" && card.data && (
        <>
          {/* Column headers */}
          {/* borderLeft matches the 3px selection border on rows so columns line up */}
          <div style={{ display: "flex", alignItems: "center", padding: "6px 10px 4px", gap: 6, borderBottom: "1px solid var(--color-surface-border)", borderLeft: "3px solid transparent" }}>
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", color: "var(--color-text-muted)", textTransform: "uppercase", width: 64, flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden" }}>Component</span>
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", color: "var(--color-text-muted)", textTransform: "uppercase", flex: 1 }}>Attribution</span>
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", color: "var(--color-text-muted)", textTransform: "uppercase", flex: 1 }}>Effect</span>
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", color: "var(--color-text-muted)", textTransform: "uppercase", width: 52, flexShrink: 0, textAlign: "right" }}>Match</span>
          </div>

          {/* Rows */}
          <div style={{ overflowY: "auto", overflowX: "hidden", background: "var(--color-card)" }}>
            {card.data.components.map((comp, i) => {
              const match = matchLabel(comp.actual_effect);
              const attrColor = interpolateColorDivergent("rdbu", comp.attribution_score, attrAbsMax);
              const attrFrac = Math.abs(comp.attribution_score) / attrAbsMax;
              const effectFrac = Math.min(1, Math.abs(comp.actual_effect));
              const effectColor = comp.actual_effect < 0 ? "#9333ea" : "#16a34a";
              const label = comp.component_type === "attn_head"
                ? `L${comp.layer}·H${comp.head}`
                : `L${comp.layer}·MLP`;
              const tooltipContent = (
                <>
                  <div style={{ fontWeight: 600, marginBottom: 3 }}>{label}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, fontVariantNumeric: "tabular-nums" }}>
                    <div style={{ display: "flex", gap: 14, justifyContent: "space-between" }}>
                      <span style={{ color: "var(--color-text-muted)" }}>attr</span>
                      <span>{comp.attribution_score >= 0 ? "+" : ""}{comp.attribution_score.toFixed(3)}</span>
                    </div>
                    <div style={{ display: "flex", gap: 14, justifyContent: "space-between" }}>
                      <span style={{ color: "var(--color-text-muted)" }}>effect</span>
                      <span>{(comp.actual_effect * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </>
              );

              const steeringComp: SteeringComponent = {
                layer: comp.layer,
                head: comp.component_type === "attn_head" ? comp.head : null,
                injectionType: comp.component_type === "attn_head" ? "attn_head" : "mlp",
              };
              const isSelected = selectedComponents.some(
                c => c.layer === steeringComp.layer && c.head === steeringComp.head && c.injectionType === steeringComp.injectionType
              );

              return (
                <div
                  key={i}
                  onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, content: tooltipContent })}
                  onMouseLeave={() => setTooltip(null)}
                  onPointerDown={e => e.stopPropagation()}
                  onClick={tutorialMode ? undefined : () => setSelectedComponents(prev =>
                    isSelected
                      ? prev.filter(c => !(c.layer === steeringComp.layer && c.head === steeringComp.head && c.injectionType === steeringComp.injectionType))
                      : [...prev, steeringComp]
                  )}
                  style={{
                    display: "flex", alignItems: "center", padding: "5px 10px", gap: 6,
                    borderBottom: "1px solid var(--color-surface-border)",
                    borderLeft: isSelected ? "3px solid var(--color-accent)" : "3px solid transparent",
                    cursor: "pointer",
                    transition: "border-color 100ms",
                  }}
                >
                  {/* Component label */}
                  <span style={{ fontSize: 9, fontFamily: "var(--font-ibm-plex-sans), sans-serif", color: "var(--color-text)", width: 64, flexShrink: 0, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {label}
                  </span>

                  {/* Attribution bar */}
                  <div style={{ flex: 1, height: 8, background: "var(--color-surface-border)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${attrFrac * 100}%`, height: "100%", background: attrColor, borderRadius: 2 }} />
                  </div>

                  {/* Effect bar */}
                  <div style={{ flex: 1, height: 8, background: "var(--color-surface-border)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${effectFrac * 100}%`, height: "100%", background: effectColor, borderRadius: 2, opacity: 0.7 + effectFrac * 0.3 }} />
                  </div>

                  {/* Match badge */}
                  <span style={{
                    fontSize: 8, fontWeight: 700, letterSpacing: "0.04em",
                    color: match.color, background: match.bg,
                    border: `1px solid ${match.border}`,
                    borderRadius: 3, padding: "1px 4px",
                    width: 52, textAlign: "center", flexShrink: 0,
                  }}>
                    {match.text}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Footer: Spearman correlation + Steer button */}
          {(spearman !== null || selectedComponents.length > 0) && (
            <div style={{ padding: "7px 10px", borderTop: "1px solid var(--color-surface-border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 9, color: "var(--color-text-muted)", flex: 1 }}>
                {spearman !== null ? `Spearman ρ ${spearman >= 0 ? "+" : ""}${spearman.toFixed(2)}` : ""}
              </span>
              {selectedComponents.length > 0 && !tutorialMode && (
                <button
                  onPointerDown={e => e.stopPropagation()}
                  onClick={() => { onSteerComponents(card.id, selectedComponents); setSelectedComponents([]); }}
                  style={{
                    fontSize: 9, fontWeight: 600, padding: "2px 7px",
                    background: "var(--color-accent)", color: "var(--color-accent-fg)",
                    border: "none", borderRadius: 4, cursor: "pointer", whiteSpace: "nowrap",
                  }}
                >
                  Steer {selectedComponents.length} →
                </button>
              )}
            </div>
          )}
        </>
      )}
      {tooltip && <HoverTooltip x={tooltip.x} y={tooltip.y}>{tooltip.content}</HoverTooltip>}
    </div>
  );
}

export default React.memo(ActivationCard);
