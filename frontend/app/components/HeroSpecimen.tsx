"use client";

import { useState, useEffect } from "react";
import {
  PALETTE_ORDER,
  PALETTE_META,
  interpolateColor,
  interpolateColorDivergent,
} from "../lib/palette";

// ─── Shared layout constants ───────────────────────────────────────────────
const CELL_H = 20;
const CELL_GAP = 3;

// ─── Logit lens data ───────────────────────────────────────────────────────
const LL_TOKENS = ["The", "Eiffel", "Tower", "is", "located", "in", "the", "city"];
const LL_LAYERS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"];
const LL_CELL_W = 38;
const LL_LABEL_W = 34;
const LL_PROBS: number[][] = [
  [0.07, 0.58, 0.42, 0.31, 0.09, 0.14, 0.22, 0.11],
  [0.09, 0.69, 0.55, 0.38, 0.12, 0.18, 0.28, 0.15],
  [0.12, 0.77, 0.67, 0.46, 0.16, 0.23, 0.35, 0.20],
  [0.16, 0.83, 0.76, 0.55, 0.21, 0.30, 0.43, 0.27],
  [0.21, 0.88, 0.83, 0.63, 0.28, 0.38, 0.52, 0.35],
  [0.27, 0.91, 0.88, 0.70, 0.35, 0.47, 0.61, 0.44],
  [0.33, 0.93, 0.91, 0.76, 0.42, 0.56, 0.69, 0.54],
  [0.39, 0.95, 0.93, 0.81, 0.49, 0.64, 0.76, 0.63],
  [0.45, 0.96, 0.95, 0.85, 0.55, 0.71, 0.82, 0.71],
  [0.50, 0.97, 0.96, 0.88, 0.61, 0.77, 0.87, 0.78],
  [0.54, 0.97, 0.97, 0.90, 0.66, 0.82, 0.90, 0.84],
  [0.58, 0.98, 0.98, 0.92, 0.70, 0.86, 0.93, 0.89],
];

// ─── DLA data ──────────────────────────────────────────────────────────────
// Signed layer attributions for "Paris" as target token, GPT-2 Small.
// Positive = promotes "Paris", negative = suppresses it.
const DLA_LAYERS = ["L0", "L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9", "L10", "L11"];
const DLA_VALUES = [0.31, -0.42, 0.58, -0.28, 0.94, 0.67, -0.51, 1.42, 2.08, 3.14, 2.71, 1.89];
const DLA_ABS_MAX = 3.5;
const DLA_BAR_HALF = 118; // pixels each side from center axis

// ─── Activation patch data ─────────────────────────────────────────────────
const PATCH_COMPONENTS = [
  { label: "L10·H7", attr: 0.85, effect: 0.81, match: "Strong" as const },
  { label: "L9·H2",  attr: 0.72, effect: 0.68, match: "Strong" as const },
  { label: "L8·H3",  attr: 0.61, effect: 0.13, match: "Weak"   as const },
  { label: "L9·MLP", attr: 0.55, effect: 0.48, match: "Partial" as const },
  { label: "L7·H5",  attr: 0.41, effect: 0.39, match: "Partial" as const },
];
const PATCH_BAR_MAX = 190; // pixels for value 1.0

const MATCH_STYLE: Record<"Strong" | "Partial" | "Weak", { color: string; bg: string }> = {
  Strong:  { color: "#4a9e6b", bg: "rgba(74,158,107,0.12)" },
  Partial: { color: "rgba(175,118,32,0.9)", bg: "rgba(175,118,32,0.10)" },
  Weak:    { color: "var(--color-text-muted)", bg: "var(--color-surface-border)" },
};

// ─── Types ─────────────────────────────────────────────────────────────────
export type SpecimenMode = "logit-lens" | "dla" | "activation-patch";

// ─── Root ──────────────────────────────────────────────────────────────────
export default function HeroSpecimen({ mode }: { mode: SpecimenMode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 16 }}>
      {mode === "logit-lens"       && <LogitLensSpecimen />}
      {mode === "dla"              && <DlaSpecimen />}
      {mode === "activation-patch" && <ActivationPatchSpecimen />}
    </div>
  );
}

// ─── Fig label ─────────────────────────────────────────────────────────────
function FigLabel({ n, caption }: { n: number; caption: string }) {
  return (
    <div>
      <p
        style={{
          fontFamily: "var(--font-azeret-mono), monospace",
          fontSize: 9,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--color-text-muted)",
          margin: "0 0 3px",
          opacity: 0.5,
        }}
      >
        Fig. {n}
      </p>
      <p
        style={{
          fontFamily: "var(--font-azeret-mono), monospace",
          fontSize: 10,
          color: "var(--color-text-muted)",
          margin: 0,
          opacity: 0.75,
        }}
      >
        {caption}
      </p>
    </div>
  );
}

// ─── Card shell ────────────────────────────────────────────────────────────
function SpecimenCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--color-bg)",
        border: "1.5px solid var(--color-card-border)",
        borderRadius: 12,
        padding: "22px 22px 18px",
        display: "inline-block",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
      }}
    >
      {children}
    </div>
  );
}

// ─── Logit lens ────────────────────────────────────────────────────────────
function LogitLensSpecimen() {
  const [paletteIdx, setPaletteIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPaletteIdx((i) => (i + 1) % PALETTE_ORDER.length), 2000);
    return () => clearInterval(id);
  }, []);

  const palette = PALETTE_ORDER[paletteIdx];
  const meta = PALETTE_META[palette];

  return (
    <>
      <FigLabel n={1} caption="Token probability by layer — GPT-2 Small" />

      <SpecimenCard>
        <div style={{ display: "flex", flexDirection: "column", gap: CELL_GAP }}>
          {/* Token headers */}
          <div style={{ display: "flex", gap: CELL_GAP }}>
            <div style={{ width: LL_LABEL_W, flexShrink: 0 }} />
            {LL_TOKENS.map((tok, i) => (
              <div
                key={i}
                style={{
                  width: LL_CELL_W,
                  flexShrink: 0,
                  fontSize: 9,
                  textAlign: "center",
                  fontFamily: "var(--font-azeret-mono), monospace",
                  color: "var(--color-text-muted)",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                  paddingBottom: 4,
                }}
              >
                {tok}
              </div>
            ))}
          </div>

          {/* Heatmap rows */}
          {LL_LAYERS.map((layer, yIdx) => (
            <div key={layer} style={{ display: "flex", alignItems: "center", gap: CELL_GAP }}>
              <div
                style={{
                  width: LL_LABEL_W,
                  flexShrink: 0,
                  fontSize: 9,
                  fontFamily: "var(--font-azeret-mono), monospace",
                  paddingRight: 6,
                  textAlign: "right",
                  color: "var(--color-text-muted)",
                  userSelect: "none",
                }}
              >
                {layer}
              </div>
              {LL_PROBS[yIdx].map((prob, xIdx) => (
                <div
                  key={xIdx}
                  style={{
                    width: LL_CELL_W,
                    height: CELL_H,
                    flexShrink: 0,
                    backgroundColor: interpolateColor(palette, prob),
                    borderRadius: 3,
                    transition: "background-color 600ms ease",
                  }}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Palette swatch + name */}
        <div
          style={{
            marginTop: 14,
            paddingTop: 10,
            borderTop: "1px solid var(--color-surface-border)",
            display: "flex",
            flexDirection: "column",
            gap: 5,
          }}
        >
          <div
            key={`swatch-${palette}`}
            style={{
              height: 4,
              borderRadius: 2,
              backgroundImage: meta.swatchCss,
              animation: "hero-swatch-in 380ms ease forwards",
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span
              key={`name-${palette}`}
              style={{
                fontFamily: "var(--font-azeret-mono), monospace",
                fontSize: 10,
                color: "var(--color-text-muted)",
                animation: "hero-label-in 380ms ease forwards",
              }}
            >
              {meta.label}
            </span>
            <span
              style={{
                fontFamily: "var(--font-azeret-mono), monospace",
                fontSize: 9,
                color: "var(--color-text-muted)",
                opacity: 0.5,
                letterSpacing: "0.02em",
              }}
            >
              {meta.description}
            </span>
          </div>
        </div>
      </SpecimenCard>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          paddingLeft: LL_LABEL_W + 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 10,
              backgroundColor: interpolateColor(palette, 0.92),
              borderRadius: 2,
              flexShrink: 0,
              transition: "background-color 600ms ease",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-azeret-mono), monospace",
              fontSize: 10,
              color: "var(--color-text-muted)",
            }}
          >
            High confidence — model predicts next token
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 10,
              backgroundColor: interpolateColor(palette, 0.1),
              borderRadius: 2,
              border: "0.5px solid var(--color-surface-border)",
              flexShrink: 0,
              transition: "background-color 600ms ease",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-azeret-mono), monospace",
              fontSize: 10,
              color: "var(--color-text-muted)",
            }}
          >
            Low confidence — representation still forming
          </span>
        </div>
      </div>
    </>
  );
}

// ─── DLA diverging bars ────────────────────────────────────────────────────
function DlaSpecimen() {
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setGrown(true), 120);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <FigLabel n={2} caption="Layer attribution · target: Paris · GPT-2 Small" />

      <SpecimenCard>
        {/* Axis direction labels */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          <div style={{ width: 36, flexShrink: 0 }} />
          <div
            style={{
              width: DLA_BAR_HALF,
              textAlign: "right",
              paddingRight: 8,
              fontFamily: "var(--font-azeret-mono), monospace",
              fontSize: 8,
              color: "var(--color-text-muted)",
              opacity: 0.55,
              letterSpacing: "0.04em",
            }}
          >
            ← suppresses
          </div>
          <div style={{ width: 1 }} />
          <div
            style={{
              width: DLA_BAR_HALF,
              paddingLeft: 8,
              fontFamily: "var(--font-azeret-mono), monospace",
              fontSize: 8,
              color: "var(--color-text-muted)",
              opacity: 0.55,
              letterSpacing: "0.04em",
            }}
          >
            promotes →
          </div>
          <div style={{ width: 44 }} />
        </div>

        {/* Rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {DLA_LAYERS.map((layer, i) => {
            const value = DLA_VALUES[i];
            const color = interpolateColorDivergent("rdbu", value, DLA_ABS_MAX);
            const barW = grown ? (Math.abs(value) / DLA_ABS_MAX) * DLA_BAR_HALF : 0;
            const delay = `${i * 76}ms`;

            return (
              <div key={layer} style={{ display: "flex", alignItems: "center" }}>
                {/* Layer label */}
                <div
                  style={{
                    width: 36,
                    flexShrink: 0,
                    fontFamily: "var(--font-azeret-mono), monospace",
                    fontSize: 9,
                    textAlign: "right",
                    paddingRight: 8,
                    color: "var(--color-text-muted)",
                  }}
                >
                  {layer}
                </div>

                {/* Left (negative) */}
                <div style={{ width: DLA_BAR_HALF, display: "flex", justifyContent: "flex-end" }}>
                  {value < 0 && (
                    <div
                      style={{
                        width: barW,
                        height: CELL_H,
                        backgroundColor: color,
                        borderRadius: "3px 0 0 3px",
                        flexShrink: 0,
                        transition: `width 1160ms cubic-bezier(0.4,0,0.2,1) ${delay}`,
                      }}
                    />
                  )}
                </div>

                {/* Center axis */}
                <div
                  style={{
                    width: 1,
                    height: CELL_H + 4,
                    backgroundColor: "var(--color-surface-border)",
                    flexShrink: 0,
                  }}
                />

                {/* Right (positive) */}
                <div style={{ width: DLA_BAR_HALF }}>
                  {value > 0 && (
                    <div
                      style={{
                        width: barW,
                        height: CELL_H,
                        backgroundColor: color,
                        borderRadius: "0 3px 3px 0",
                        transition: `width 1160ms cubic-bezier(0.4,0,0.2,1) ${delay}`,
                      }}
                    />
                  )}
                </div>

                {/* Value */}
                <div
                  style={{
                    width: 44,
                    paddingLeft: 8,
                    fontFamily: "var(--font-azeret-mono), monospace",
                    fontSize: 8,
                    color: "var(--color-text-muted)",
                    opacity: grown ? 0.65 : 0,
                    transition: `opacity 600ms ease ${delay}`,
                    flexShrink: 0,
                  }}
                >
                  {value > 0 ? "+" : ""}
                  {value.toFixed(2)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer legend */}
        <div
          style={{
            marginTop: 14,
            paddingTop: 10,
            borderTop: "1px solid var(--color-surface-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 16,
                height: 8,
                borderRadius: 2,
                backgroundColor: interpolateColorDivergent("rdbu", -2.5, DLA_ABS_MAX),
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-azeret-mono), monospace",
                fontSize: 9,
                color: "var(--color-text-muted)",
              }}
            >
              suppresses target
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 16,
                height: 8,
                borderRadius: 2,
                backgroundColor: interpolateColorDivergent("rdbu", 2.8, DLA_ABS_MAX),
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-azeret-mono), monospace",
                fontSize: 9,
                color: "var(--color-text-muted)",
              }}
            >
              promotes target
            </span>
          </div>
        </div>
      </SpecimenCard>
    </>
  );
}

// ─── Activation patch dual bars ────────────────────────────────────────────
function ActivationPatchSpecimen() {
  const [grown, setGrown] = useState(false);
  const [phase, setPhase] = useState<0 | 1>(0);
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setGrown(true), 120);
    const t2 = setTimeout(() => setPhase(1), 1900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    if (phase !== 1 || revealed >= PATCH_COMPONENTS.length) return;
    const t = setTimeout(() => setRevealed((r) => r + 1), 800);
    return () => clearTimeout(t);
  }, [phase, revealed]);

  const verdictVisible = revealed >= PATCH_COMPONENTS.length;

  return (
    <>
      <FigLabel n={3} caption="Attribution vs. causal effect · Top 5 components" />

      <SpecimenCard>
        {/* Column headers */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <div style={{ width: 52, flexShrink: 0 }} />
          <div style={{ width: PATCH_BAR_MAX, display: "flex", flexDirection: "column", gap: 3 }}>
            <span
              style={{
                fontFamily: "var(--font-azeret-mono), monospace",
                fontSize: 8,
                color: "rgba(175,118,32,0.85)",
                letterSpacing: "0.04em",
              }}
            >
              predicted (gradient)
            </span>
            <span
              style={{
                fontFamily: "var(--font-azeret-mono), monospace",
                fontSize: 8,
                letterSpacing: "0.04em",
                color: phase >= 1 ? "#4a9e6b" : "transparent",
                transition: "color 350ms ease",
              }}
            >
              verified (patch)
            </span>
          </div>
          <div style={{ width: 52, flexShrink: 0 }} />
        </div>

        {/* Component rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {PATCH_COMPONENTS.map((comp, i) => {
            const attrW = grown ? comp.attr * PATCH_BAR_MAX : 0;
            const effectW = revealed > i ? comp.effect * PATCH_BAR_MAX : 0;
            const ms = MATCH_STYLE[comp.match];

            return (
              <div key={comp.label} style={{ display: "flex", alignItems: "center", gap: 0 }}>
                {/* Component label */}
                <div
                  style={{
                    width: 52,
                    flexShrink: 0,
                    fontFamily: "var(--font-azeret-mono), monospace",
                    fontSize: 9,
                    color: "var(--color-text-muted)",
                    paddingRight: 8,
                  }}
                >
                  {comp.label}
                </div>

                {/* Bar stack */}
                <div
                  style={{
                    width: PATCH_BAR_MAX,
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                    flexShrink: 0,
                  }}
                >
                  {/* Amber — attribution */}
                  <div
                    style={{
                      width: attrW,
                      height: 7,
                      backgroundColor: "rgba(175,118,32,0.75)",
                      borderRadius: 2,
                      transition: `width 1040ms cubic-bezier(0.4,0,0.2,1) ${i * 80}ms`,
                    }}
                  />
                  {/* Green — actual effect */}
                  <div
                    style={{
                      width: effectW,
                      height: 7,
                      backgroundColor: "#4a9e6b",
                      borderRadius: 2,
                      transition: "width 800ms cubic-bezier(0.4,0,0.2,1)",
                    }}
                  />
                </div>

                {/* Match badge */}
                <div
                  style={{
                    width: 52,
                    paddingLeft: 10,
                    flexShrink: 0,
                    opacity: revealed > i ? 1 : 0,
                    transition: "opacity 250ms ease",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-azeret-mono), monospace",
                      fontSize: 8,
                      color: ms.color,
                      backgroundColor: ms.bg,
                      padding: "2px 5px",
                      borderRadius: 3,
                      letterSpacing: "0.02em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {comp.match}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Verdict footer */}
        <div
          style={{
            marginTop: 16,
            paddingTop: 10,
            borderTop: "1px solid var(--color-surface-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            opacity: verdictVisible ? 1 : 0,
            transition: "opacity 400ms ease",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-azeret-mono), monospace",
              fontSize: 9,
              color: "var(--color-text-muted)",
            }}
          >
            4 of 5 components matched
          </span>
          <span
            style={{
              fontFamily: "var(--font-azeret-mono), monospace",
              fontSize: 9,
              color: "var(--color-text-muted)",
              opacity: 0.55,
            }}
          >
            Spearman ρ = 0.87
          </span>
        </div>
      </SpecimenCard>
    </>
  );
}
