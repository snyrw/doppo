"use client";

import React from "react";
import { interpolateColorDivergent } from "../lib/palette";
import { TIER_LABELS } from "../lib/tiers";
import type { SteeringComponent } from "./SteeringCard";
import { CardDragHandle, CardLoadingState, CardErrorState, CardLoadingHeader, useElapsedMs, stageLabel } from "./CardShell";
import { HoverTooltip, type TooltipState } from "../lib/tooltip";

export type TopKComponent = {
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
  showBuyCredits?: boolean;
  position: { x: number; y: number };
  gpuTier?: string;
  startedAt?: number;
  loadingStage?: string;
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
  onSteerComponents: (cardId: string, components: SteeringComponent[]) => void;
  tutorialMode?: boolean;
};

const COL_GAP = 2;
const Y_LABEL_W = 28;
const LAYER_CELL_H = 14;
const HEAD_CELL_SIZE = 14;
const LAYER_BAR_W = 160;
const K_OPTIONS = [5, 10, 20] as const;

const STAGE_LABELS: Record<string, string> = {
  tokenizing:                 "Tokenizing…",
  clean_forward_pass:         "Running reference forward pass",
  corrupted_forward_backward: "Running counterfactual pass + backward",
  computing_attribution:      "Computing attributions",
};

function AttributionCard({
  card,
  ref,
  onStartDrag,
  onDragMove,
  onDragEnd,
  onRemove,
  onVerifyTopK,
  onSteerComponents,
  tutorialMode,
}: AttributionCardProps) {
  const [view, setView] = React.useState<"layer" | "head">("head");
  const [selectedK, setSelectedK] = React.useState<5 | 10 | 20>(10);
  const elapsedMs = useElapsedMs(card.status, card.startedAt);
  const [headerHovered, setHeaderHovered] = React.useState(false);
  const [selectedComponents, setSelectedComponents] = React.useState<SteeringComponent[]>([]);

  const canToggle = card.status === "result" && card.data != null;

  const absMax = React.useMemo(() => {
    if (!card.data) return 1;
    if (view === "layer") {
      return Math.max(1e-9, ...card.data.layer_attribution.map(Math.abs));
    }
    return Math.max(1e-9, ...card.data.head_attribution.flatMap(row => row.map(Math.abs)));
  }, [card.data, view]);

  const cardWidth = React.useMemo(() => {
    if (!card.data || card.status !== "result") return 280;
    if (view === "layer") return Y_LABEL_W + LAYER_BAR_W + 48 + 12;
    return Y_LABEL_W + (HEAD_CELL_SIZE + COL_GAP) * card.data.x_labels.length + 12;
  }, [card.data, card.status, view]);

  const topLayer = React.useMemo(() => {
    if (!card.data) return 0;
    return card.data.layer_attribution.reduce(
      (best, v, i, arr) => (Math.abs(v) > Math.abs(arr[best]) ? i : best),
      0
    );
  }, [card.data]);

  function toggleComponent(comp: SteeringComponent) {
    setSelectedComponents(prev => {
      const exists = prev.some(c => c.layer === comp.layer && c.head === comp.head);
      return exists
        ? prev.filter(c => !(c.layer === comp.layer && c.head === comp.head))
        : [...prev, comp];
    });
  }

  const isVerifying = card.verifyStatus === "loading";
  const isVerified = card.verifyStatus === "done";

  return (
    <div
      ref={ref}
      data-card-id={card.id}
      style={{
        position: "absolute",
        left: card.position.x,
        top: card.position.y,
        zIndex: 10,
        background: "var(--card)",
        borderRadius: 8,
        border: "1px solid var(--card-border)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        display: "flex",
        flexDirection: "column",
        ...(card.status === "loading" ? { width: 280, height: 200 } : {}),
        ...(card.status === "error" ? { width: 280 } : {}),
        ...(card.status === "result" ? { width: cardWidth } : {}),
      }}
    >
      {/* Hover popup */}
      {headerHovered && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: 0,
          background: "var(--card)", border: "1px solid var(--card-border)",
          borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          padding: "10px 12px", zIndex: 100, pointerEvents: "none",
          minWidth: 220, maxWidth: 340, animation: "fadeUp 120ms ease-out",
        }}>
          <p style={{ fontSize: 11, fontWeight: 600, margin: 0, color: "var(--text)", fontFamily: "var(--font-ibm-plex-sans), sans-serif", wordBreak: "break-all" }}>
            {card.modelName}
          </p>
          <p style={{ fontSize: 10, color: "var(--text-muted)", margin: "5px 0 2px", lineHeight: 1.5, fontFamily: "var(--font-ibm-plex-sans), sans-serif", wordBreak: "break-word" }}>
            <span style={{ opacity: 0.6 }}>ref: </span>{card.cleanPrompt}
          </p>
          <p style={{ fontSize: 10, color: "var(--text-muted)", margin: "0", lineHeight: 1.5, fontFamily: "var(--font-ibm-plex-sans), sans-serif", wordBreak: "break-word" }}>
            <span style={{ opacity: 0.6 }}>∼: </span>{card.corruptedPrompt}
          </p>
          <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
            {card.gpuTier && (
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", color: "var(--accent)", background: "var(--surface-border)", border: "1px solid var(--card-border)", borderRadius: 3, padding: "1px 5px" }}>
                {TIER_LABELS[card.gpuTier] ?? card.gpuTier}
              </span>
            )}
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", color: "var(--accent)", background: "var(--surface-border)", border: "1px solid var(--card-border)", borderRadius: 3, padding: "1px 5px" }}>
              Attribution
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
          borderBottom: "1px solid var(--surface-border)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          borderRadius: "8px 8px 0 0",
          cursor: "grab",
          userSelect: "none",
        }}
      >
        {/* Row 1: drag strip */}
        <div style={{ padding: "7px 10px", display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
          <CardDragHandle />
          <span style={{ fontSize: 11, color: "var(--text)", fontWeight: 600, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {card.modelName}
          </span>
          <span style={{ fontSize: 10, color: "var(--text-muted)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {card.cleanPrompt}
          </span>
          {!tutorialMode && (
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={() => onRemove(card.id)}
              style={{ fontSize: 12, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: "0 2px", flexShrink: 0, lineHeight: 1 }}
            >
              ×
            </button>
          )}
        </div>

        {/* Row 2: token badge + view toggle (result only) */}
        {canToggle && (
          <div
            onPointerDown={e => e.stopPropagation()}
            style={{
              padding: "4px 10px",
              borderTop: "1px solid var(--surface-border)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {card.data?.target_token && (
              <span style={{
                fontSize: 9, fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontWeight: 600,
                color: "var(--accent)", background: "var(--surface-border)",
                border: "1px solid var(--card-border)", borderRadius: 3, padding: "1px 5px",
                whiteSpace: "nowrap",
              }}>
                {card.data.contrastive_token
                  ? `${JSON.stringify(card.data.target_token)} vs ${JSON.stringify(card.data.contrastive_token)}`
                  : `→ ${JSON.stringify(card.data.target_token)}`}
              </span>
            )}
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", border: "1px solid var(--card-border)", borderRadius: 4, overflow: "hidden" }}>
              {(["layer", "head"] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{
                    fontSize: 9, padding: "2px 6px",
                    background: view === v ? "var(--accent)" : "transparent",
                    color: view === v ? "var(--accent-fg)" : "var(--text-muted)",
                    border: "none", cursor: "pointer", lineHeight: 1.4, textTransform: "capitalize",
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Row 3: verify controls (result only) */}
        {canToggle && (
          <div
            onPointerDown={e => e.stopPropagation()}
            style={{
              padding: "4px 10px",
              borderTop: "1px solid var(--surface-border)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 9, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              Verify top-K
            </span>
            <div style={{ flex: 1 }} />
            {isVerified ? (
              <span style={{
                fontSize: 9, fontWeight: 600, color: "#16a34a",
                background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.25)",
                borderRadius: 3, padding: "2px 6px", whiteSpace: "nowrap",
              }}>
                ✓ Verified
              </span>
            ) : (
              <>
                <div style={{ display: "flex", border: "1px solid var(--card-border)", borderRadius: 4, overflow: "hidden" }}>
                  {K_OPTIONS.map(k => (
                    <button
                      key={k}
                      onClick={() => setSelectedK(k)}
                      style={{
                        fontSize: 9, padding: "2px 5px",
                        background: selectedK === k ? "var(--surface-border)" : "transparent",
                        color: selectedK === k ? "var(--text)" : "var(--text-muted)",
                        border: "none", cursor: "pointer", lineHeight: 1.4,
                      }}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => onVerifyTopK(card.id, selectedK)}
                  disabled={isVerifying}
                  style={{
                    fontSize: 9, fontWeight: 600, padding: "2px 7px",
                    background: isVerifying ? "var(--surface-border)" : "var(--accent)",
                    color: isVerifying ? "var(--text-muted)" : "var(--accent-fg)",
                    border: "none", borderRadius: 4, cursor: isVerifying ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
                    transition: "background 120ms",
                  }}
                >
                  {isVerifying ? (
                    <>
                      <div style={{ width: 8, height: 8, border: "1.5px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                      Verifying…
                    </>
                  ) : (
                    `Verify →`
                  )}
                </button>
              </>
            )}
            {/* Steer buttons */}
            {!tutorialMode && (
              <>
                <button
                  onPointerDown={e => e.stopPropagation()}
                  onClick={() => onSteerComponents(card.id, [{ layer: topLayer, head: null, injectionType: "residual" }])}
                  style={{
                    fontSize: 9, fontWeight: 600, padding: "2px 7px",
                    background: "var(--accent)", color: "var(--accent-fg)",
                    border: "none", borderRadius: 4, cursor: "pointer", whiteSpace: "nowrap",
                    transition: "background 120ms",
                  }}
                >
                  Steer →
                </button>
                {view === "head" && selectedComponents.length > 0 && (
                  <button
                    onPointerDown={e => e.stopPropagation()}
                    onClick={() => { onSteerComponents(card.id, selectedComponents); setSelectedComponents([]); }}
                    style={{
                      fontSize: 9, fontWeight: 600, padding: "2px 7px",
                      background: "var(--accent)", color: "var(--accent-fg)",
                      border: "none", borderRadius: 4, cursor: "pointer", whiteSpace: "nowrap",
                      transition: "background 120ms",
                    }}
                  >
                    Steer {selectedComponents.length} →
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Loading */}
      {card.status === "loading" && (
        <div style={{ display: "flex", flexDirection: "column", padding: "12px 14px", gap: 10, minHeight: 110 }}>
          <CardLoadingHeader gpuTier={card.gpuTier} elapsedMs={elapsedMs} />
          <CardLoadingState
            stage={stageLabel(card.loadingStage, elapsedMs, STAGE_LABELS)}
            warmup={!card.loadingStage && elapsedMs > 30_000}
          />
        </div>
      )}

      {/* Error */}
      {card.status === "error" && <CardErrorState message={card.error ?? undefined} showBuyCredits={card.showBuyCredits} />}

      {/* Result */}
      {card.status === "result" && card.data && (
        <div style={{ overflowY: "auto", overflowX: "hidden", padding: 6, background: "var(--card)" }}>
          {view === "layer" ? (
            <LayerView data={card.data} absMax={absMax} />
          ) : (
            <HeadView data={card.data} absMax={absMax} selectedComponents={selectedComponents} onToggleComponent={toggleComponent} tutorialMode={tutorialMode} />
          )}
        </div>
      )}
    </div>
  );
}

function LayerView({ data, absMax }: { data: AttributionData; absMax: number }) {
  const [tooltip, setTooltip] = React.useState<TooltipState>(null);
  return (
    <>
    <div style={{ display: "inline-flex", flexDirection: "column", gap: COL_GAP }}>
      {data.y_labels.map((label, i) => {
        const val = data.layer_attribution[i];
        const color = interpolateColorDivergent("rdbu", val, absMax);
        const barFrac = Math.abs(val) / absMax;
        const isPositive = val >= 0;

        return (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: COL_GAP }}>
            <div style={{ width: Y_LABEL_W, flexShrink: 0, fontSize: 9, fontFamily: "var(--font-ibm-plex-sans), sans-serif", paddingRight: 4, textAlign: "right", color: "var(--text-muted)" }}>
              {label}
            </div>
            <div
              onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, content: <><span style={{ fontWeight: 600 }}>{label}</span>{" "}<span style={{ fontVariantNumeric: "tabular-nums" }}>{val >= 0 ? "+" : ""}{val.toFixed(3)}</span></> })}
              onMouseLeave={() => setTooltip(null)}
              style={{ width: LAYER_BAR_W, height: LAYER_CELL_H, flexShrink: 0, display: "flex", alignItems: "stretch", borderRadius: 2, overflow: "hidden", background: "var(--surface-border)", position: "relative" }}
            >
              <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "var(--card-border)", zIndex: 1 }} />
              {isPositive ? (
                <>
                  <div style={{ width: "50%" }} />
                  <div style={{ width: `${barFrac * 50}%`, background: color, borderRadius: "0 2px 2px 0" }} />
                </>
              ) : (
                <>
                  <div style={{ flex: 1 }} />
                  <div style={{ width: `${barFrac * 50}%`, background: color, borderRadius: "2px 0 0 2px", alignSelf: "stretch" }} />
                  <div style={{ width: "50%" }} />
                </>
              )}
            </div>
            <span style={{ fontSize: 9, fontFamily: "var(--font-ibm-plex-sans), sans-serif", color: "var(--text-muted)", width: 44, flexShrink: 0, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
              {val >= 0 ? "+" : ""}{val.toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
    {tooltip && <HoverTooltip x={tooltip.x} y={tooltip.y}>{tooltip.content}</HoverTooltip>}
    </>
  );
}

function HeadView({
  data, absMax, selectedComponents, onToggleComponent, tutorialMode,
}: {
  data: AttributionData;
  absMax: number;
  selectedComponents: SteeringComponent[];
  onToggleComponent: (comp: SteeringComponent) => void;
  tutorialMode?: boolean;
}) {
  const [tooltip, setTooltip] = React.useState<TooltipState>(null);
  return (
    <>
    <div style={{ display: "inline-flex", flexDirection: "column", gap: COL_GAP }}>
      <div style={{ display: "flex", gap: COL_GAP }}>
        <div style={{ width: Y_LABEL_W, flexShrink: 0 }} />
        {data.x_labels.map((h, i) => (
          <div
            key={i}
            style={{
              width: HEAD_CELL_SIZE, flexShrink: 0, fontSize: 7, textAlign: "center",
              fontFamily: "var(--font-ibm-plex-sans), sans-serif", color: "var(--text-muted)",
              overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", paddingBottom: 2,
            }}
          >
            {h}
          </div>
        ))}
      </div>
      {data.y_labels.map((label, li) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: COL_GAP }}>
          <div style={{ width: Y_LABEL_W, flexShrink: 0, fontSize: 9, fontFamily: "var(--font-ibm-plex-sans), sans-serif", paddingRight: 4, textAlign: "right", color: "var(--text-muted)" }}>
            {label}
          </div>
          {data.head_attribution[li].map((val, hi) => {
            const color = interpolateColorDivergent("rdbu", val, absMax);
            const isSelected = selectedComponents.some(c => c.layer === li && c.head === hi);
            return (
              <div
                key={hi}
                onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, content: <><span style={{ fontWeight: 600 }}>{label}</span>{" H"}{hi}<br /><span style={{ fontVariantNumeric: "tabular-nums" }}>{val >= 0 ? "+" : ""}{val.toFixed(3)}</span></> })}
                onMouseLeave={() => setTooltip(null)}
                onPointerDown={e => e.stopPropagation()}
                onClick={tutorialMode ? undefined : () => onToggleComponent({ layer: li, head: hi, injectionType: "attn_head" })}
                style={{
                  width: HEAD_CELL_SIZE, height: HEAD_CELL_SIZE, flexShrink: 0,
                  backgroundColor: color,
                  border: isSelected ? "1.5px solid var(--text)" : "0.5px solid var(--surface-border)",
                  borderRadius: 2, boxSizing: "border-box", cursor: "pointer",
                  outline: isSelected ? "1px solid var(--accent)" : "none",
                  outlineOffset: 1,
                }}
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

export default React.memo(AttributionCard);
