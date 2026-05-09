"use client";

import { useState, useEffect } from "react";
import { PALETTE_ORDER, PALETTE_META, interpolateColor } from "../lib/palette";

const TOKENS = ["The", "Eiffel", "Tower", "is", "located", "in", "the", "city"];
const LAYERS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"];

const PROBS: number[][] = [
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

const CELL_W = 38;
const CELL_H = 20;
const LABEL_W = 34;
const CELL_GAP = 3;
const CYCLE_MS = 3500;

export default function HeroSpecimen() {
  const [paletteIdx, setPaletteIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setPaletteIdx((i) => (i + 1) % PALETTE_ORDER.length);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  const palette = PALETTE_ORDER[paletteIdx];
  const meta = PALETTE_META[palette];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 16 }}>
      {/* Fig. 1 label */}
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
          Fig. 1
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
          Token probability by layer — GPT-2 Small
        </p>
      </div>

      {/* Heatmap card */}
      <div
        style={{
          background: "var(--color-bg)",
          border: "1.5px solid var(--color-card-border)",
          borderRadius: 12,
          padding: "22px 22px 14px",
          display: "inline-block",
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: CELL_GAP }}>
          {/* Token column headers */}
          <div style={{ display: "flex", gap: CELL_GAP }}>
            <div style={{ width: LABEL_W, flexShrink: 0 }} />
            {TOKENS.map((tok, i) => (
              <div
                key={i}
                style={{
                  width: CELL_W,
                  flexShrink: 0,
                  fontSize: 9,
                  textAlign: "center",
                  fontFamily: "var(--font-geist-mono), monospace",
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
          {LAYERS.map((layer, yIdx) => (
            <div key={layer} style={{ display: "flex", alignItems: "center", gap: CELL_GAP }}>
              <div
                style={{
                  width: LABEL_W,
                  flexShrink: 0,
                  fontSize: 9,
                  fontFamily: "var(--font-geist-mono), monospace",
                  paddingRight: 6,
                  textAlign: "right",
                  color: "var(--color-text-muted)",
                  userSelect: "none",
                }}
              >
                {layer}
              </div>
              {PROBS[yIdx].map((prob, xIdx) => (
                <div
                  key={xIdx}
                  style={{
                    width: CELL_W,
                    height: CELL_H,
                    flexShrink: 0,
                    backgroundColor: interpolateColor(palette, prob),
                    borderRadius: 3,
                    boxSizing: "border-box",
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
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          paddingLeft: LABEL_W + 24,
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
    </div>
  );
}
