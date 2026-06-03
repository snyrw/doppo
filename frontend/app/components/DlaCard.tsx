"use client";

import React from "react";
import { interpolateColorDivergent } from "../lib/palette";
import { TIER_LABELS } from "../lib/tiers";
import { CardDragHandle, CardLoadingState, CardErrorState } from "./CardShell";
import { HoverTooltip, type TooltipState } from "../lib/tooltip";

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
  position: { x: number; y: number };
  gpuTier?: string;
  startedAt?: number;
  loadingStage?: string;
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
      const vals = [
        ...card.data.layer_attn_dla ?? [],
        ...card.data.layer_mlp_dla ?? [],
        card.data.embed_dla ?? 0,
      ];
      return Math.max(1e-9, ...vals.map(Math.abs));
    }
    return Math.max(1e-9, ...card.data.head_dla.flatMap(row => row.map(Math.abs)));
  }, [card.data, view]);

  // Card width: layer view fixed; head view expands with n_heads
  const cardWidth = React.useMemo(() => {
    if (!card.data || card.status !== "result") return 280;
    if (view === "layer") {
      // split view: two half-bars + 4px gap; single view: one full bar
      const barArea = card.data.layer_attn_dla != null
        ? HALF_BAR_W + 4 + HALF_BAR_W + 2 * COL_GAP
        : LAYER_BAR_W;
      return Y_LABEL_W + barArea + 48 + 12;
    }
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
          <p style={{ fontSize: 11, fontWeight: 600, margin: 0, color: "var(--color-text)", fontFamily: "var(--font-ibm-plex-sans), sans-serif", wordBreak: "break-all" }}>
            {card.modelName}
          </p>
          <p style={{ fontSize: 10, color: "var(--color-text-muted)", margin: "5px 0 0", lineHeight: 1.5, fontFamily: "var(--font-ibm-plex-sans), sans-serif", wordBreak: "break-word" }}>
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

      {/* Header */}
      <div
        onPointerDown={e => onStartDrag(e, card.id, card.position)}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onMouseEnter={() => setHeaderHovered(true)}
        onMouseLeave={() => setHeaderHovered(false)}
        style={{
          borderBottom: "1px solid var(--color-surface-border)",
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
          <span style={{ fontSize: 11, color: "var(--color-text)", fontWeight: 600, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {card.modelName}
          </span>
          <span style={{ fontSize: 10, color: "var(--color-text-muted)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {card.prompt}
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

        {/* Row 2: controls (result only) */}
        {canToggle && (
          <div
            onPointerDown={e => e.stopPropagation()}
            style={{
              padding: "4px 10px",
              borderTop: "1px solid var(--color-surface-border)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {card.data?.target_token && (
              <span style={{
                fontSize: 9, fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontWeight: 600,
                color: "var(--color-accent)", background: "var(--color-surface-border)",
                border: "1px solid var(--color-card-border)", borderRadius: 3, padding: "1px 5px",
                whiteSpace: "nowrap",
              }}>
                {card.data.contrastive_token
                  ? `${JSON.stringify(card.data.target_token)} vs ${JSON.stringify(card.data.contrastive_token)}`
                  : `→ ${JSON.stringify(card.data.target_token)}`}
              </span>
            )}
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", border: "1px solid var(--color-card-border)", borderRadius: 4, overflow: "hidden" }}>
              {(["layer", "head", "top"] as const).map(v => (
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
          </div>
        )}
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
            <span style={{ fontSize: 10, color: "var(--color-text-muted)", fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontVariantNumeric: "tabular-nums" }}>
              {formatElapsed(elapsedMs)}
            </span>
          </div>
          <CardLoadingState
            stage={getStageLabel(card.loadingStage, elapsedMs)}
            elapsed={elapsedMs}
            warmup={!card.loadingStage && elapsedMs > 30_000}
          />
        </div>
      )}

      {/* Error */}
      {card.status === "error" && <CardErrorState message={card.error ?? undefined} showBuyCredits={card.showBuyCredits} />}

      {/* Result */}
      {card.status === "result" && card.data && (
        <div style={{ overflowY: "auto", overflowX: "hidden", padding: 6, background: "var(--color-card)" }}>
          {view === "layer" ? (
            <LayerView data={card.data} absMax={absMax} />
          ) : view === "head" ? (
            <HeadView data={card.data} absMax={absMax} />
          ) : (
            <TopView data={card.data} absMax={absMax} />
          )}
        </div>
      )}
    </div>
  );
}

function DivergingBar({ val, absMax, width = LAYER_BAR_W, height = LAYER_CELL_H, tooltipContent }: {
  val: number; absMax: number; width?: number; height?: number; tooltipContent?: React.ReactNode;
}) {
  const [hover, setHover] = React.useState<{ x: number; y: number } | null>(null);
  const color = interpolateColorDivergent("rdbu", val, absMax);
  const barFrac = Math.abs(val) / absMax;
  const isPositive = val >= 0;
  return (
    <>
    <div
      onMouseEnter={(e) => tooltipContent && setHover({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setHover(null)}
      style={{ width, height, flexShrink: 0, display: "flex", alignItems: "stretch", borderRadius: 2, overflow: "hidden", background: "var(--color-surface-border)", position: "relative" }}
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
    {hover && tooltipContent && <HoverTooltip x={hover.x} y={hover.y}>{tooltipContent}</HoverTooltip>}
    </>
  );
}

const HALF_BAR_W = Math.floor(LAYER_BAR_W / 2) - 2;

function LayerView({ data, absMax }: { data: DlaData; absMax: number }) {
  const hasAttnMlp = data.layer_attn_dla != null && data.layer_mlp_dla != null;

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: COL_GAP }}>
      {/* Column header when split view is active */}
      {hasAttnMlp && (
        <div style={{ display: "flex", alignItems: "center", gap: COL_GAP }}>
          <div style={{ width: Y_LABEL_W, flexShrink: 0 }} />
          <span style={{ width: HALF_BAR_W, flexShrink: 0, fontSize: 8, textAlign: "center", color: "var(--color-text-muted)", fontFamily: "var(--font-ibm-plex-sans), sans-serif", letterSpacing: "0.04em" }}>Attn</span>
          <div style={{ width: 4, flexShrink: 0 }} />
          <span style={{ width: HALF_BAR_W, flexShrink: 0, fontSize: 8, textAlign: "center", color: "var(--color-text-muted)", fontFamily: "var(--font-ibm-plex-sans), sans-serif", letterSpacing: "0.04em" }}>MLP</span>
          <div style={{ width: 44, flexShrink: 0 }} />
        </div>
      )}

      {/* Embed row */}
      {data.embed_dla != null && (
        <div style={{ display: "flex", alignItems: "center", gap: COL_GAP }}>
          <div style={{ width: Y_LABEL_W, flexShrink: 0, fontSize: 9, fontFamily: "var(--font-ibm-plex-sans), sans-serif", paddingRight: 4, textAlign: "right", color: "var(--color-text-muted)", fontStyle: "italic" }}>
            emb
          </div>
          {hasAttnMlp ? (
            <>
              <DivergingBar val={data.embed_dla} absMax={absMax} width={LAYER_BAR_W + 4} tooltipContent={<><span style={{ fontWeight: 600 }}>Embed</span>{" "}<span style={{ fontVariantNumeric: "tabular-nums" }}>{data.embed_dla >= 0 ? "+" : ""}{data.embed_dla.toFixed(3)}</span></>} />
              <span style={{ fontSize: 9, fontFamily: "var(--font-ibm-plex-sans), sans-serif", color: "var(--color-text-muted)", width: 44, flexShrink: 0, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                {data.embed_dla >= 0 ? "+" : ""}{data.embed_dla.toFixed(2)}
              </span>
            </>
          ) : (
            <>
              <DivergingBar val={data.embed_dla} absMax={absMax} tooltipContent={<><span style={{ fontWeight: 600 }}>Embed</span>{" "}<span style={{ fontVariantNumeric: "tabular-nums" }}>{data.embed_dla >= 0 ? "+" : ""}{data.embed_dla.toFixed(3)}</span></>} />
              <span style={{ fontSize: 9, fontFamily: "var(--font-ibm-plex-sans), sans-serif", color: "var(--color-text-muted)", width: 44, flexShrink: 0, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
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
            <div style={{ fontWeight: 600, marginBottom: 3 }}>{label}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, fontVariantNumeric: "tabular-nums" }}>
              <div style={{ display: "flex", gap: 14, justifyContent: "space-between" }}>
                <span style={{ color: "var(--color-text-muted)" }}>Attn</span>
                <span>{attnVal! >= 0 ? "+" : ""}{attnVal!.toFixed(3)}</span>
              </div>
              <div style={{ display: "flex", gap: 14, justifyContent: "space-between" }}>
                <span style={{ color: "var(--color-text-muted)" }}>MLP</span>
                <span>{mlpVal! >= 0 ? "+" : ""}{mlpVal!.toFixed(3)}</span>
              </div>
              <div style={{ borderTop: "1px solid var(--color-surface-border)", paddingTop: 2, marginTop: 1, display: "flex", gap: 14, justifyContent: "space-between" }}>
                <span style={{ color: "var(--color-text-muted)" }}>Total</span>
                <span style={{ fontWeight: 600 }}>{combined >= 0 ? "+" : ""}{combined.toFixed(3)}</span>
              </div>
            </div>
          </>
        ) : (
          <><span style={{ fontWeight: 600 }}>{label}</span>{" "}<span style={{ fontVariantNumeric: "tabular-nums" }}>{combined >= 0 ? "+" : ""}{combined.toFixed(3)}</span></>
        );

        return (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: COL_GAP }}>
            <div style={{ width: Y_LABEL_W, flexShrink: 0, fontSize: 9, fontFamily: "var(--font-ibm-plex-sans), sans-serif", paddingRight: 4, textAlign: "right", color: "var(--color-text-muted)" }}>
              {label}
            </div>

            {hasAttnMlp ? (
              <>
                <DivergingBar val={attnVal!} absMax={absMax} width={HALF_BAR_W} tooltipContent={tooltipContent} />
                <div style={{ width: 4, flexShrink: 0 }} />
                <DivergingBar val={mlpVal!} absMax={absMax} width={HALF_BAR_W} tooltipContent={tooltipContent} />
              </>
            ) : (
              <DivergingBar val={combined} absMax={absMax} tooltipContent={tooltipContent} />
            )}

            <span style={{ fontSize: 9, fontFamily: "var(--font-ibm-plex-sans), sans-serif", color: "var(--color-text-muted)", width: 44, flexShrink: 0, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
              {combined >= 0 ? "+" : ""}{combined.toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function HeadView({ data, absMax }: { data: DlaData; absMax: number }) {
  const [tooltip, setTooltip] = React.useState<TooltipState>(null);
  return (
    <>
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
              fontFamily: "var(--font-ibm-plex-sans), sans-serif",
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
          <div style={{ width: Y_LABEL_W, flexShrink: 0, fontSize: 9, fontFamily: "var(--font-ibm-plex-sans), sans-serif", paddingRight: 4, textAlign: "right", color: "var(--color-text-muted)" }}>
            {label}
          </div>
          {data.head_dla[li].map((val, hi) => {
            const color = interpolateColorDivergent("rdbu", val, absMax);
            return (
              <div
                key={hi}
                onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, content: <><span style={{ fontWeight: 600 }}>{label}</span>{" H"}{hi}<br /><span style={{ fontVariantNumeric: "tabular-nums" }}>{val >= 0 ? "+" : ""}{val.toFixed(3)}</span></> })}
                onMouseLeave={() => setTooltip(null)}
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
    {tooltip && <HoverTooltip x={tooltip.x} y={tooltip.y}>{tooltip.content}</HoverTooltip>}
    </>
  );
}

const TOP_N = 15;
const TOP_BAR_W = 120;

function TopView({ data, absMax }: { data: DlaData; absMax: number }) {
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
    <div style={{ display: "inline-flex", flexDirection: "column", gap: COL_GAP }}>
      {ranked.map(({ label, val }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: COL_GAP }}>
          <div style={{ width: Y_LABEL_W + 14, flexShrink: 0, fontSize: 9, fontFamily: "var(--font-ibm-plex-sans), sans-serif", paddingRight: 4, textAlign: "right", color: "var(--color-text-muted)" }}>
            {label}
          </div>
          <DivergingBar val={val} absMax={absMax} width={TOP_BAR_W} height={LAYER_CELL_H} tooltipContent={<><span style={{ fontWeight: 600 }}>{label}</span>{" "}<span style={{ fontVariantNumeric: "tabular-nums" }}>{val >= 0 ? "+" : ""}{val.toFixed(3)}</span></>} />
          <span style={{ fontSize: 9, fontFamily: "var(--font-ibm-plex-sans), sans-serif", color: "var(--color-text-muted)", width: 44, flexShrink: 0, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
            {val >= 0 ? "+" : ""}{val.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default React.memo(DlaCard);
