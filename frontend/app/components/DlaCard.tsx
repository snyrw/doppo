"use client";

import React from "react";
import { interpolateColorDivergent, getContrastColor } from "../lib/palette";
import { TIER_LABELS } from "../lib/tiers";

export type DlaData = {
  target_token: string;
  target_position: number;
  y_labels: string[];     // ["L0","L1",...] one per layer
  x_labels: string[];     // ["H0","H1",...] one per head
  layer_dla: number[];    // [n_layers] signed floats
  head_dla: number[][];   // [n_layers][n_heads] signed floats
};

export type DlaCardData = {
  id: string;
  cardType: "dla";
  status: "loading" | "result" | "error";
  modelName: string;
  prompt: string;
  data: DlaData | null;
  error: string | null;
  position: { x: number; y: number };
  gpuTier?: string;
  startedAt?: number;
  loadingStage?: string;
  targetPosition: number | "last";
  targetToken: string | null;
};

type DlaCardProps = {
  card: DlaCardData;
  ref?: React.Ref<HTMLDivElement>;
  onStartDrag: (e: React.PointerEvent<HTMLDivElement>, cardId: string, pos: { x: number; y: number }) => void;
  onDragMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDragEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
  onRemove: (id: string) => void;
};


const COL_GAP = 2;
const Y_LABEL_W = 28;
const LAYER_CELL_H = 14;
const HEAD_CELL_SIZE = 14;
const LAYER_BAR_W = 160;

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function getStageLabel(stage: string | undefined, elapsedMs: number): string {
  switch (stage) {
    case "tokenizing":   return "Tokenizing…";
    case "forward_pass": return "Running forward pass";
    case "computing":    return "Computing attributions";
  }
  return elapsedMs > 30_000 ? "GPU container is starting…" : "Connecting to GPU…";
}

export default function DlaCard({
  card,
  ref,
  onStartDrag,
  onDragMove,
  onDragEnd,
  onRemove,
}: DlaCardProps) {
  const [view, setView] = React.useState<"layer" | "head">("layer");
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

  // Compute the symmetric max for rdbu anchoring
  const absMax = React.useMemo(() => {
    if (!card.data) return 1;
    if (view === "layer") {
      return Math.max(1e-9, ...card.data.layer_dla.map(Math.abs));
    }
    return Math.max(1e-9, ...card.data.head_dla.flatMap(row => row.map(Math.abs)));
  }, [card.data, view]);

  // Card width: layer view is fixed narrow; head view expands with n_heads
  const cardWidth = React.useMemo(() => {
    if (!card.data || card.status !== "result") return 280;
    if (view === "layer") return Y_LABEL_W + LAYER_BAR_W + 48 + 12; // label + bar + value text + padding
    return Y_LABEL_W + (HEAD_CELL_SIZE + COL_GAP) * card.data.x_labels.length + 12;
  }, [card.data, card.status, view]);

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
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(3px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Hover popup */}
      {headerHovered && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: 0,
            background: "var(--color-card)",
            border: "1px solid var(--color-card-border)",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            padding: "10px 12px",
            zIndex: 100,
            pointerEvents: "none",
            minWidth: 200,
            maxWidth: 320,
            animation: "fadeUp 120ms ease-out",
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 600, margin: 0, color: "var(--color-text)", fontFamily: "var(--font-azeret-mono), monospace", wordBreak: "break-all" }}>
            {card.modelName}
          </p>
          <p style={{ fontSize: 10, color: "var(--color-text-muted)", margin: "5px 0 0", lineHeight: 1.5, fontFamily: "var(--font-azeret-mono), monospace", wordBreak: "break-word" }}>
            {card.prompt}
          </p>
          <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
            {card.gpuTier && (
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", color: "var(--color-accent)", background: "var(--color-surface-border)", border: "1px solid var(--color-card-border)", borderRadius: 3, padding: "1px 5px" }}>
                {TIER_LABELS[card.gpuTier] ?? card.gpuTier}
              </span>
            )}
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", color: "var(--color-accent)", background: "var(--color-surface-border)", border: "1px solid var(--color-card-border)", borderRadius: 3, padding: "1px 5px" }}>
              DLA
            </span>
          </div>
        </div>
      )}

      {/* Drag handle / header */}
      <div
        onPointerDown={e => onStartDrag(e, card.id, card.position)}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onMouseEnter={() => setHeaderHovered(true)}
        onMouseLeave={() => setHeaderHovered(false)}
        style={{
          padding: "7px 10px",
          borderBottom: "1px solid var(--color-surface-border)",
          display: "flex",
          alignItems: "center",
          gap: 6,
          cursor: "grab",
          userSelect: "none",
          flexShrink: 0,
          borderRadius: "8px 8px 0 0",
          minWidth: 0,
          overflow: "hidden",
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
          {card.prompt}
        </span>

        {/* Resolved target token badge */}
        {card.data?.target_token && (
          <span
            onPointerDown={e => e.stopPropagation()}
            style={{
              fontSize: 9,
              fontFamily: "var(--font-azeret-mono), monospace",
              fontWeight: 600,
              color: "var(--color-accent)",
              background: "var(--color-surface-border)",
              border: "1px solid var(--color-card-border)",
              borderRadius: 3,
              padding: "1px 5px",
              flexShrink: 0,
              whiteSpace: "nowrap",
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
                  fontSize: 9,
                  padding: "2px 6px",
                  background: view === v ? "var(--color-accent)" : "transparent",
                  color: view === v ? "var(--color-accent-fg)" : "var(--color-text-muted)",
                  border: "none",
                  cursor: "pointer",
                  lineHeight: 1.4,
                  textTransform: "capitalize",
                }}
              >
                {v}
              </button>
            ))}
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
        <div style={{ overflow: "auto", padding: 6, background: "var(--color-card)" }}>
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

function LayerView({ data, absMax }: { data: DlaData; absMax: number }) {
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: COL_GAP }}>
      {data.y_labels.map((label, i) => {
        const val = data.layer_dla[i];
        const color = interpolateColorDivergent("rdbu", val, absMax);
        const barFrac = Math.abs(val) / absMax;
        const isPositive = val >= 0;
        const tooltip = `${label}: ${val >= 0 ? "+" : ""}${val.toFixed(3)}`;

        return (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: COL_GAP }}>
            {/* Layer label */}
            <div style={{ width: Y_LABEL_W, flexShrink: 0, fontSize: 9, fontFamily: "var(--font-azeret-mono), monospace", paddingRight: 4, textAlign: "right", color: "var(--color-text-muted)" }}>
              {label}
            </div>

            {/* Diverging bar: negative fills left half, positive fills right half */}
            <div
              title={tooltip}
              style={{ width: LAYER_BAR_W, height: LAYER_CELL_H, flexShrink: 0, display: "flex", alignItems: "stretch", borderRadius: 2, overflow: "hidden", background: "var(--color-surface-border)", position: "relative" }}
            >
              {/* Center line */}
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

            {/* Value label */}
            <span style={{ fontSize: 9, fontFamily: "var(--font-azeret-mono), monospace", color: "var(--color-text-muted)", width: 44, flexShrink: 0, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
              {val >= 0 ? "+" : ""}{val.toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function HeadView({ data, absMax }: { data: DlaData; absMax: number }) {
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: COL_GAP }}>
      {/* X-axis: head labels */}
      <div style={{ display: "flex", gap: COL_GAP }}>
        <div style={{ width: Y_LABEL_W, flexShrink: 0 }} />
        {data.x_labels.map((h, i) => (
          <div
            key={i}
            style={{
              width: HEAD_CELL_SIZE,
              flexShrink: 0,
              fontSize: 7,
              textAlign: "center",
              fontFamily: "var(--font-azeret-mono), monospace",
              color: "var(--color-text-muted)",
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
              paddingBottom: 2,
            }}
          >
            {h}
          </div>
        ))}
      </div>

      {/* Heatmap rows */}
      {data.y_labels.map((label, li) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: COL_GAP }}>
          <div style={{ width: Y_LABEL_W, flexShrink: 0, fontSize: 9, fontFamily: "var(--font-azeret-mono), monospace", paddingRight: 4, textAlign: "right", color: "var(--color-text-muted)" }}>
            {label}
          </div>
          {data.head_dla[li].map((val, hi) => {
            const color = interpolateColorDivergent("rdbu", val, absMax);
            const contrastColor = getContrastColor("rdbu", (val + absMax) / (2 * absMax));
            const tooltip = `${label} H${hi}: ${val >= 0 ? "+" : ""}${val.toFixed(3)}`;
            return (
              <div
                key={hi}
                title={tooltip}
                style={{
                  width: HEAD_CELL_SIZE,
                  height: HEAD_CELL_SIZE,
                  flexShrink: 0,
                  backgroundColor: color,
                  border: "0.5px solid var(--color-surface-border)",
                  borderRadius: 2,
                  boxSizing: "border-box",
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
