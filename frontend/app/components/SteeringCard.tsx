"use client";

import React from "react";
import { TIER_LABELS } from "../lib/tiers";
import { CardDragHandle, CardErrorState } from "./CardShell";

export type SteeringComponent = {
  layer: number;
  head: number | null;
  injectionType: "attn_head" | "mlp" | "residual";
};

export type SteeringResult = {
  steered_text: string;
  baseline_text: string;
  top_k_steered: Array<{ token: string; prob: number }>;
  top_k_baseline: Array<{ token: string; prob: number }>;
  logit_diff: number;
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
  parentCardId: string;
  data: SteeringResult | null;
  error: string | null;
  showBuyCredits?: boolean;
  position: { x: number; y: number };
  gpuTier?: string;
  startedAt?: number;
  loadingStage?: string;
  streamingText?: string;
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
};

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function componentLabel(c: SteeringComponent): string {
  if (c.injectionType === "attn_head" && c.head !== null) return `L${c.layer}·H${c.head}`;
  if (c.injectionType === "mlp") return `L${c.layer}·MLP`;
  return `L${c.layer}·residual`;
}

function SteeringCard({
  card,
  ref,
  onStartDrag,
  onDragMove,
  onDragEnd,
  onRemove,
  onRerun,
  tutorialMode,
}: SteeringCardProps) {
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [headerHovered, setHeaderHovered] = React.useState(false);
  const [localAlpha, setLocalAlpha] = React.useState(card.alpha);
  const [debouncing, setDebouncing] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local alpha if the card is re-run externally (alpha stored in card updates).
  React.useEffect(() => { setLocalAlpha(card.alpha); }, [card.alpha]);
  // Cancel any pending debounce on unmount.
  React.useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  React.useEffect(() => {
    if (card.status !== "loading") return;
    const start = card.startedAt ?? Date.now();
    setElapsedMs(Date.now() - start);
    const id = setInterval(() => setElapsedMs(Date.now() - start), 1000);
    return () => clearInterval(id);
  }, [card.status, card.startedAt]);

  const logitDiffStr = card.data
    ? (card.data.logit_diff >= 0 ? "+" : "") + card.data.logit_diff.toFixed(2)
    : null;

  return (
    <div
      ref={ref}
      data-card-id={card.id}
      style={{
        position: "absolute",
        left: card.position.x,
        top: card.position.y,
        zIndex: 10,
        width: 360,
        background: "var(--color-card)",
        borderRadius: 8,
        border: "1px solid var(--color-card-border)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Hover popup */}
      {headerHovered && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: 0,
          background: "var(--color-card)", border: "1px solid var(--color-card-border)",
          borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          padding: "10px 12px", zIndex: 100, pointerEvents: "none",
          minWidth: 200, maxWidth: 320,
        }}>
          <p style={{ fontSize: 11, fontWeight: 600, margin: 0, color: "var(--color-text)", fontFamily: "var(--font-ibm-plex-sans), sans-serif", wordBreak: "break-all" }}>
            {card.modelName}
          </p>
          <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: "8px 0 3px" }}>
            DIM pair
          </p>
          <p style={{ fontSize: 10, color: "var(--color-text-muted)", margin: "0", lineHeight: 1.5, fontFamily: "var(--font-ibm-plex-sans), sans-serif", wordBreak: "break-word" }}>
            clean: {card.cleanPrompt}
          </p>
          <p style={{ fontSize: 10, color: "var(--color-text-muted)", margin: "3px 0 0", lineHeight: 1.5, fontFamily: "var(--font-ibm-plex-sans), sans-serif", wordBreak: "break-word" }}>
            corrupted: {card.corruptedPrompt}
          </p>
          <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: "8px 0 3px" }}>
            generation prompt
          </p>
          <p style={{ fontSize: 10, color: "var(--color-text)", margin: "0", lineHeight: 1.5, fontFamily: "var(--font-ibm-plex-sans), sans-serif", wordBreak: "break-word" }}>
            {card.generationPrompt && card.generationPrompt.trim() !== "" ? card.generationPrompt : <span style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>↳ defaults to clean prompt</span>}
          </p>
          <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
            {card.gpuTier && (
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", color: "var(--color-accent)", background: "var(--color-surface-border)", border: "1px solid var(--color-card-border)", borderRadius: 3, padding: "1px 5px" }}>
                {TIER_LABELS[card.gpuTier] ?? card.gpuTier}
              </span>
            )}
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", color: "var(--color-accent)", background: "var(--color-surface-border)", border: "1px solid var(--color-card-border)", borderRadius: 3, padding: "1px 5px" }}>
              Steering
            </span>
            <span style={{ fontSize: 9, fontFamily: "var(--font-ibm-plex-sans), sans-serif", color: "var(--color-text-muted)", background: "var(--color-surface-border)", border: "1px solid var(--color-card-border)", borderRadius: 3, padding: "1px 5px" }}>
              T={card.temperature.toFixed(1)}  rep={card.repetitionPenalty.toFixed(2)}
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
          Steering
        </span>
        {card.nPairs > 1 && (
          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.05em", color: "var(--color-accent)", background: "var(--color-surface-border)", border: "1px solid var(--color-card-border)", borderRadius: 3, padding: "1px 5px", flexShrink: 0 }}>
            {card.nPairs}p
          </span>
        )}
        <span style={{ fontSize: 10, color: "var(--color-text-muted)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {card.components.map(componentLabel).join(" + ") || "residual"}
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

      {/* Injection info + alpha slider row */}
      <div
        onPointerDown={e => e.stopPropagation()}
        style={{
          padding: "5px 10px",
          borderBottom: "1px solid var(--color-surface-border)",
          display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
        }}
      >
        {card.components.map((c, i) => (
          <span
            key={i}
            style={{
              fontSize: 9, fontWeight: 600, fontFamily: "var(--font-ibm-plex-sans), sans-serif",
              color: "var(--color-accent)", background: "var(--color-surface-border)",
              border: "1px solid var(--color-card-border)", borderRadius: 3, padding: "1px 5px",
              flexShrink: 0,
            }}
          >
            {componentLabel(c)}
          </span>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 9, color: "var(--color-text-muted)", fontFamily: "var(--font-ibm-plex-sans), sans-serif", width: 36, textAlign: "right" }}>
            α={localAlpha >= 0 ? localAlpha.toFixed(2) : localAlpha.toFixed(2)}
          </span>
          <input
            type="range"
            min={-50} max={50} step={1}
            value={localAlpha}
            disabled={tutorialMode}
            onChange={e => {
              const val = parseFloat(e.target.value);
              setLocalAlpha(val);
              if (debounceRef.current) clearTimeout(debounceRef.current);
              if (card.status !== "loading") {
                setDebouncing(true);
                debounceRef.current = setTimeout(() => {
                  debounceRef.current = null;
                  setDebouncing(false);
                  onRerun(card.id, val);
                }, 2000);
              }
            }}
            style={{ width: 80, accentColor: "var(--color-accent)", cursor: tutorialMode ? "not-allowed" : "pointer", ...(tutorialMode ? { opacity: 0.45 } : {}) }}
          />
          {debouncing && (
            <span style={{ fontSize: 9, color: "var(--color-text-muted)", fontFamily: "var(--font-ibm-plex-sans), sans-serif", userSelect: "none" }}>⋯</span>
          )}
          {!tutorialMode && card.status !== "loading" && localAlpha !== card.alpha && (
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={() => {
                if (debounceRef.current) clearTimeout(debounceRef.current);
                debounceRef.current = null;
                setDebouncing(false);
                onRerun(card.id, localAlpha);
              }}
              style={{
                fontSize: 9, fontWeight: 600, padding: "2px 7px",
                background: "var(--color-accent)", color: "var(--color-accent-fg)",
                border: "none", borderRadius: 4, cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              Re-run →
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {card.status === "loading" && (
        <div style={{ display: "flex", flexDirection: "column", padding: "10px 12px", gap: 8 }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 16, height: 16, border: "2px solid var(--color-surface-border)", borderTopColor: "var(--color-accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
            <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: 0 }}>
              {card.loadingStage === "computing" ? "Computing DIM vectors…" : "Generating…"}
            </p>
          </div>
          {/* Live streaming text */}
          {card.streamingText !== undefined && card.streamingText !== "" && (
            <div
              onPointerDown={e => e.stopPropagation()}
              style={{
                fontSize: 11, fontFamily: "var(--font-ibm-plex-sans), sans-serif",
                color: "var(--color-text)", lineHeight: 1.6,
                maxHeight: 100, overflowY: "auto", background: "var(--color-card)",
                border: "1px solid var(--color-surface-border)", borderRadius: 4,
                padding: "6px 8px", whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}
            >
              {card.streamingText}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {card.status === "error" && <CardErrorState message={card.error ?? undefined} showBuyCredits={card.showBuyCredits} />}

      {/* Result */}
      {card.status === "result" && card.data && (
        <div onPointerDown={e => e.stopPropagation()} style={{ display: "flex", flexDirection: "column" }}>
          {/* Steered text */}
          <div style={{ padding: "8px 10px 4px" }}>
            <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: "0 0 4px" }}>
              Steered
            </p>
            <div style={{
              fontSize: 11, fontFamily: "var(--font-ibm-plex-sans), sans-serif", color: "var(--color-text)",
              lineHeight: 1.6, maxHeight: 100, overflowY: "auto", background: "var(--color-card)",
              border: "1px solid var(--color-surface-border)", borderRadius: 4,
              padding: "6px 8px", whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              {card.data.steered_text}
            </div>
          </div>

          {/* Baseline text */}
          <div style={{ padding: "4px 10px 8px" }}>
            <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: "0 0 4px" }}>
              Baseline
            </p>
            <div style={{
              fontSize: 11, fontFamily: "var(--font-ibm-plex-sans), sans-serif", color: "var(--color-text-muted)",
              lineHeight: 1.6, maxHeight: 100, overflowY: "auto", background: "var(--color-card)",
              border: "1px solid var(--color-surface-border)", borderRadius: 4,
              padding: "6px 8px", whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              {card.data.baseline_text}
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--color-surface-border)" }} />

          {/* Next-token comparison */}
          <div style={{ padding: "8px 10px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: 0 }}>
                Next token
              </p>
              <span style={{
                fontSize: 9, fontWeight: 600, fontFamily: "var(--font-ibm-plex-sans), sans-serif",
                color: card.data.logit_diff >= 0 ? "#16a34a" : "#dc2626",
                background: card.data.logit_diff >= 0 ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)",
                border: `1px solid ${card.data.logit_diff >= 0 ? "rgba(22,163,74,0.25)" : "rgba(220,38,38,0.25)"}`,
                borderRadius: 3, padding: "1px 5px",
              }}>
                Δ logit {logitDiffStr}
              </span>
            </div>

            {/* Two-column token table */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {/* Steered column */}
              <div>
                <p style={{ fontSize: 8, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: "0 0 4px" }}>
                  Steered
                </p>
                {card.data.top_k_steered.map((t, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
                    <span style={{ fontSize: 9, fontFamily: "var(--font-ibm-plex-sans), sans-serif", color: "var(--color-text)", width: 60, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {JSON.stringify(t.token)}
                    </span>
                    <div style={{ flex: 1, height: 6, background: "var(--color-surface-border)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ width: `${t.prob * 100}%`, height: "100%", background: "var(--color-accent)", borderRadius: 2, opacity: 0.8 }} />
                    </div>
                    <span style={{ fontSize: 8, color: "var(--color-text-muted)", fontFamily: "var(--font-ibm-plex-sans), sans-serif", width: 26, textAlign: "right", flexShrink: 0 }}>
                      {(t.prob * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>

              {/* Baseline column */}
              <div>
                <p style={{ fontSize: 8, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: "0 0 4px" }}>
                  Baseline
                </p>
                {card.data.top_k_baseline.map((t, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
                    <span style={{ fontSize: 9, fontFamily: "var(--font-ibm-plex-sans), sans-serif", color: "var(--color-text-muted)", width: 60, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {JSON.stringify(t.token)}
                    </span>
                    <div style={{ flex: 1, height: 6, background: "var(--color-surface-border)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ width: `${t.prob * 100}%`, height: "100%", background: "var(--color-text-muted)", borderRadius: 2, opacity: 0.5 }} />
                    </div>
                    <span style={{ fontSize: 8, color: "var(--color-text-muted)", fontFamily: "var(--font-ibm-plex-sans), sans-serif", width: 26, textAlign: "right", flexShrink: 0 }}>
                      {(t.prob * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(SteeringCard);
