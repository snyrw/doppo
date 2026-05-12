"use client";

import React from "react";
import { interpolateColorDivergent, getContrastColor } from "../lib/palette";
import { TIER_LABELS } from "../lib/tiers";

export type TopKComponent = {
  layer: number;
  head: number;
  component_type: "attn_head" | "mlp";
  attribution_score: number;
};

export type AttributionData = {
  target_token: string;
  target_token_idx: number;
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
  position: { x: number; y: number };
  gpuTier?: string;
  startedAt?: number;
  loadingStage?: string;
  targetPosition: number | "last";
  targetToken: string | null;
  verifyStatus?: "idle" | "loading" | "done";
  verifyK?: number;
  verifyCardId?: string;
};

type AttributionCardProps = {
  card: AttributionCardData;
  ref?: React.Ref<HTMLDivElement>;
  onStartDrag: (e: React.PointerEvent<HTMLDivElement>, cardId: string, pos: { x: number; y: number }) => void;
  onDragMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDragEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
  onRemove: (id: string) => void;
  onVerifyTopK: (cardId: string, k: number) => void;
};

const COL_GAP = 2;
const Y_LABEL_W = 28;
const LAYER_CELL_H = 14;
const HEAD_CELL_SIZE = 14;
const LAYER_BAR_W = 160;
const K_OPTIONS = [5, 10, 20] as const;

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function getStageLabel(stage: string | undefined, elapsedMs: number): string {
  switch (stage) {
    case "tokenizing":               return "Tokenizing…";
    case "clean_forward_pass":       return "Running reference forward pass";
    case "corrupted_forward_backward": return "Running counterfactual pass + backward";
    case "computing_attribution":    return "Computing attributions";
  }
  return elapsedMs > 30_000 ? "GPU container is starting…" : "Connecting to GPU…";
}

export default function AttributionCard({
  card,
  ref,
  onStartDrag,
  onDragMove,
  onDragEnd,
  onRemove,
  onVerifyTopK,
}: AttributionCardProps) {
  const [view, setView] = React.useState<"layer" | "head">("head");
  const [selectedK, setSelectedK] = React.useState<5 | 10 | 20>(10);
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [headerHovered, setHeaderHovered] = React.useState(false);

  React.useEffect(() => {
    if (card.status !== "loading") return;
    const start = card.startedAt ?? Date.now();
    setElapsedMs(Date.now() - start);
    const id = setInterval(() => setElapsedMs(Date.now() - start), 1000);
    return () => clearInterval(id);
  }, [card.status, card.startedAt]);

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
        background: "var(--color-card)",
        borderRadius: 8,
        border: "1px solid var(--color-card-border)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        display: "flex",
        flexDirection: "column",
        ...(card.status === "loading" ? { width: 280, height: 200 } : {}),
        ...(card.status === "error" ? { width: 280 } : {}),
        ...(card.status === "result" ? { width: cardWidth } : {}),
      }}
    >
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Hover popup */}
      {headerHovered && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: 0,
          background: "var(--color-card)", border: "1px solid var(--color-card-border)",
          borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          padding: "10px 12px", zIndex: 100, pointerEvents: "none",
          minWidth: 220, maxWidth: 340, animation: "fadeUp 120ms ease-out",
        }}>
          <p style={{ fontSize: 11, fontWeight: 600, margin: 0, color: "var(--color-text)", fontFamily: "var(--font-azeret-mono), monospace", wordBreak: "break-all" }}>
            {card.modelName}
          </p>
          <p style={{ fontSize: 10, color: "var(--color-text-muted)", margin: "5px 0 2px", lineHeight: 1.5, fontFamily: "var(--font-azeret-mono), monospace", wordBreak: "break-word" }}>
            <span style={{ opacity: 0.6 }}>ref: </span>{card.cleanPrompt}
          </p>
          <p style={{ fontSize: 10, color: "var(--color-text-muted)", margin: "0", lineHeight: 1.5, fontFamily: "var(--font-azeret-mono), monospace", wordBreak: "break-word" }}>
            <span style={{ opacity: 0.6 }}>∼: </span>{card.corruptedPrompt}
          </p>
          <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
            {card.gpuTier && (
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", color: "var(--color-accent)", background: "var(--color-surface-border)", border: "1px solid var(--color-card-border)", borderRadius: 3, padding: "1px 5px" }}>
                {TIER_LABELS[card.gpuTier] ?? card.gpuTier}
              </span>
            )}
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", color: "var(--color-accent)", background: "var(--color-surface-border)", border: "1px solid var(--color-card-border)", borderRadius: 3, padding: "1px 5px" }}>
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
          padding: "7px 10px", borderBottom: "1px solid var(--color-surface-border)",
          display: "flex", alignItems: "center", gap: 6,
          cursor: "grab", userSelect: "none", flexShrink: 0,
          borderRadius: "8px 8px 0 0", minWidth: 0, overflow: "hidden",
        }}
      >
        <svg width="8" height="12" viewBox="0 0 8 12" fill="none" style={{ opacity: 0.3, flexShrink: 0 }}>
          <circle cx="2" cy="2" r="1.2" fill="currentColor" />
          <circle cx="6" cy="2" r="1.2" fill="currentColor" />
          <circle cx="2" cy="6" r="1.2" fill="currentColor" />
          <circle cx="6" cy="6" r="1.2" fill="currentColor" />
          <circle cx="2" cy="10" r="1.2" fill="currentColor" />
          <circle cx="6" cy="10" r="1.2" fill="currentColor" />
        </svg>
        <span style={{ fontSize: 11, color: "var(--color-text)", fontWeight: 600, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {card.modelName}
        </span>
        <span style={{ fontSize: 10, color: "var(--color-text-muted)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {card.cleanPrompt}
        </span>

        {/* Target token badge */}
        {card.data?.target_token && (
          <span
            onPointerDown={e => e.stopPropagation()}
            style={{
              fontSize: 9, fontFamily: "var(--font-azeret-mono), monospace", fontWeight: 600,
              color: "var(--color-accent)", background: "var(--color-surface-border)",
              border: "1px solid var(--color-card-border)", borderRadius: 3, padding: "1px 5px",
              flexShrink: 0, whiteSpace: "nowrap",
            }}
          >
            → {JSON.stringify(card.data.target_token)}
          </span>
        )}

        {/* Layer / Head toggle */}
        {canToggle && (
          <div
            onPointerDown={e => e.stopPropagation()}
            style={{ display: "flex", border: "1px solid var(--color-card-border)", borderRadius: 4, overflow: "hidden", flexShrink: 0 }}
          >
            {(["layer", "head"] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  fontSize: 9, padding: "2px 6px",
                  background: view === v ? "var(--color-accent)" : "transparent",
                  color: view === v ? "var(--color-accent-fg)" : "var(--color-text-muted)",
                  border: "none", cursor: "pointer", lineHeight: 1.4, textTransform: "capitalize",
                }}
              >
                {v}
              </button>
            ))}
          </div>
        )}

        {/* Verify top K controls */}
        {canToggle && (
          <div onPointerDown={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            {/* K pill group */}
            {!isVerified && (
              <div style={{ display: "flex", border: "1px solid var(--color-card-border)", borderRadius: 4, overflow: "hidden" }}>
                {K_OPTIONS.map(k => (
                  <button
                    key={k}
                    onClick={() => setSelectedK(k)}
                    style={{
                      fontSize: 9, padding: "2px 5px",
                      background: selectedK === k ? "var(--color-surface-border)" : "transparent",
                      color: selectedK === k ? "var(--color-text)" : "var(--color-text-muted)",
                      border: "none", cursor: "pointer", lineHeight: 1.4,
                    }}
                  >
                    {k}
                  </button>
                ))}
              </div>
            )}

            {isVerified ? (
              <span style={{
                fontSize: 9, fontWeight: 600, color: "#16a34a",
                background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.25)",
                borderRadius: 3, padding: "2px 6px", whiteSpace: "nowrap",
              }}>
                ✓ Verified
              </span>
            ) : (
              <button
                onClick={() => onVerifyTopK(card.id, selectedK)}
                disabled={isVerifying}
                style={{
                  fontSize: 9, fontWeight: 600, padding: "2px 7px",
                  background: isVerifying ? "var(--color-surface-border)" : "var(--color-accent)",
                  color: isVerifying ? "var(--color-text-muted)" : "var(--color-accent-fg)",
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
                  `Verify top ${selectedK} →`
                )}
              </button>
            )}
          </div>
        )}

        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={() => onRemove(card.id)}
          style={{ fontSize: 12, color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer", padding: "0 2px", flexShrink: 0, lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      {/* Loading */}
      {card.status === "loading" && (
        <div style={{ display: "flex", flexDirection: "column", padding: "12px 14px", gap: 10, minHeight: 110 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {card.gpuTier ? (
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", color: "var(--color-accent)", background: "var(--color-surface-border)", border: "1px solid var(--color-card-border)", borderRadius: 3, padding: "1px 5px" }}>
                {TIER_LABELS[card.gpuTier] ?? card.gpuTier}
              </span>
            ) : <span />}
            <span style={{ fontSize: 10, color: "var(--color-text-muted)", fontFamily: "var(--font-azeret-mono), monospace", fontVariantNumeric: "tabular-nums" }}>
              {formatElapsed(elapsedMs)}
            </span>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <div style={{ width: 20, height: 20, border: "2px solid var(--color-surface-border)", borderTopColor: "var(--color-accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: 0 }}>
              {getStageLabel(card.loadingStage, elapsedMs)}
            </p>
          </div>
          {!card.loadingStage && elapsedMs > 30_000 && (
            <p style={{ fontSize: 10, color: "var(--color-text-muted)", margin: 0, textAlign: "center", lineHeight: 1.5 }}>
              First run warms the GPU container — large models can take up to 2 min.
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {card.status === "error" && (
        <div style={{ padding: "12px 14px" }}>
          <p style={{ fontSize: 11, color: "#dc2626" }}>✗ {card.error ?? "Unknown error"}</p>
        </div>
      )}

      {/* Result */}
      {card.status === "result" && card.data && (
        <div style={{ overflow: "auto", padding: 6 }}>
          {view === "layer" ? (
            <LayerView data={card.data} absMax={absMax} />
          ) : (
            <HeadView data={card.data} absMax={absMax} />
          )}
        </div>
      )}
    </div>
  );
}

function LayerView({ data, absMax }: { data: AttributionData; absMax: number }) {
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: COL_GAP }}>
      {data.y_labels.map((label, i) => {
        const val = data.layer_attribution[i];
        const color = interpolateColorDivergent("rdbu", val, absMax);
        const barFrac = Math.abs(val) / absMax;
        const isPositive = val >= 0;
        const tooltip = `${label}: ${val >= 0 ? "+" : ""}${val.toFixed(3)}`;

        return (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: COL_GAP }}>
            <div style={{ width: Y_LABEL_W, flexShrink: 0, fontSize: 9, fontFamily: "var(--font-azeret-mono), monospace", paddingRight: 4, textAlign: "right", color: "var(--color-text-muted)" }}>
              {label}
            </div>
            <div
              title={tooltip}
              style={{ width: LAYER_BAR_W, height: LAYER_CELL_H, flexShrink: 0, display: "flex", alignItems: "stretch", borderRadius: 2, overflow: "hidden", background: "var(--color-surface-border)", position: "relative" }}
            >
              <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "var(--color-card-border)", zIndex: 1 }} />
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
            <span style={{ fontSize: 9, fontFamily: "var(--font-azeret-mono), monospace", color: "var(--color-text-muted)", width: 44, flexShrink: 0, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
              {val >= 0 ? "+" : ""}{val.toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function HeadView({ data, absMax }: { data: AttributionData; absMax: number }) {
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: COL_GAP }}>
      <div style={{ display: "flex", gap: COL_GAP }}>
        <div style={{ width: Y_LABEL_W, flexShrink: 0 }} />
        {data.x_labels.map((h, i) => (
          <div
            key={i}
            style={{
              width: HEAD_CELL_SIZE, flexShrink: 0, fontSize: 7, textAlign: "center",
              fontFamily: "var(--font-azeret-mono), monospace", color: "var(--color-text-muted)",
              overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", paddingBottom: 2,
            }}
          >
            {h}
          </div>
        ))}
      </div>
      {data.y_labels.map((label, li) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: COL_GAP }}>
          <div style={{ width: Y_LABEL_W, flexShrink: 0, fontSize: 9, fontFamily: "var(--font-azeret-mono), monospace", paddingRight: 4, textAlign: "right", color: "var(--color-text-muted)" }}>
            {label}
          </div>
          {data.head_attribution[li].map((val, hi) => {
            const color = interpolateColorDivergent("rdbu", val, absMax);
            const tooltip = `${label} H${hi}: ${val >= 0 ? "+" : ""}${val.toFixed(3)}`;
            return (
              <div
                key={hi}
                title={tooltip}
                style={{
                  width: HEAD_CELL_SIZE, height: HEAD_CELL_SIZE, flexShrink: 0,
                  backgroundColor: color, border: "0.5px solid var(--color-surface-border)",
                  borderRadius: 2, boxSizing: "border-box",
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
