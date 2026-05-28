"use client";

import React from "react";

export type EntropyCardData = {
  id: string;
  cardType: "entropy";
  status: "result";
  modelName: string;
  prompt: string;
  position: { x: number; y: number };
  parentLensId: string;
  entropyData: number[][];
  yLabels: string[];
  xLabels: string[];
};

type EntropyCardProps = {
  card: EntropyCardData;
  ref?: React.Ref<HTMLDivElement>;
  onStartDrag: (e: React.PointerEvent<HTMLDivElement>, cardId: string, pos: { x: number; y: number }) => void;
  onDragMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDragEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
  onRemove: (id: string) => void;
};

const INNER_W = 210;
const INNER_H = 72;
const PAD = { top: 8, right: 10, bottom: 18, left: 26 };
const CARD_W = INNER_W + PAD.left + PAD.right + 12;

function makePath(vals: number[], maxVal: number, w: number, h: number): string {
  if (vals.length < 2 || maxVal <= 0) return "";
  return vals
    .map((v, i) => {
      const x = (i / (vals.length - 1)) * w;
      const y = h - Math.max(0, Math.min(1, v / maxVal)) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function EntropyCard({ card, ref, onStartDrag, onDragMove, onDragEnd, onRemove }: EntropyCardProps) {
  const [hoveredLayer, setHoveredLayer] = React.useState<number | null>(null);

  const { entropyData, yLabels, xLabels } = card;
  const nLayers = entropyData.length;
  const nPos = entropyData[0]?.length ?? 0;

  const meanEntropy = React.useMemo(
    () => entropyData.map(row => (row.length > 0 ? row.reduce((a, b) => a + b, 0) / row.length : 0)),
    [entropyData]
  );

  const maxEntropy = React.useMemo(
    () => Math.max(...entropyData.flat(), 0.01),
    [entropyData]
  );

  const yTicks = React.useMemo(() => {
    const top = Math.ceil(maxEntropy);
    return [0, Math.round(top / 2), top];
  }, [maxEntropy]);

  const tooltipData = hoveredLayer !== null ? {
    layerLabel: yLabels[hoveredLayer] ?? String(hoveredLayer),
    mean: meanEntropy[hoveredLayer] ?? 0,
  } : null;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left - PAD.left;
    if (relX < 0 || relX > INNER_W || nLayers < 2) { setHoveredLayer(null); return; }
    setHoveredLayer(Math.max(0, Math.min(nLayers - 1, Math.round((relX / INNER_W) * (nLayers - 1)))));
  };

  const crosshairX = hoveredLayer !== null && nLayers > 1
    ? (hoveredLayer / (nLayers - 1)) * INNER_W
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
        background: "var(--color-card)",
        borderRadius: 8,
        border: "1px solid var(--color-card-border)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        display: "flex",
        flexDirection: "column",
        width: CARD_W,
      }}
    >
      <div
        onPointerDown={e => onStartDrag(e, card.id, card.position)}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
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
        <span style={{
          fontSize: 9,
          fontWeight: 600,
          color: "var(--color-text-muted)",
          fontFamily: "var(--font-ibm-plex-mono), monospace",
          flex: 1,
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }}>
          H · {card.modelName.split("/").pop()}
        </span>
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={() => onRemove(card.id)}
          style={{ fontSize: 12, color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer", padding: "0 2px", flexShrink: 0, lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      <div style={{ padding: "8px 6px 6px", position: "relative" }}>
        <svg
          width={INNER_W + PAD.left + PAD.right}
          height={INNER_H + PAD.top + PAD.bottom}
          style={{ display: "block", overflow: "visible" }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredLayer(null)}
        >
          <g transform={`translate(${PAD.left},${PAD.top})`}>
            {yTicks.map((val, i) => {
              const y = INNER_H - (val / Math.max(maxEntropy, 0.01)) * INNER_H;
              return (
                <g key={i}>
                  <line x1={-3} y1={y} x2={INNER_W} y2={y} stroke="var(--color-surface-border)" strokeWidth={0.5} />
                  <text
                    x={-5}
                    y={y + 3}
                    fontSize={7}
                    textAnchor="end"
                    fill="var(--color-text-muted)"
                    style={{ fontFamily: "var(--font-ibm-plex-mono), monospace" }}
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            <line x1={0} y1={INNER_H} x2={INNER_W} y2={INNER_H} stroke="var(--color-surface-border)" strokeWidth={0.5} />

            {Array.from({ length: nPos }, (_, pi) => (
              <path
                key={pi}
                d={makePath(entropyData.map(row => row[pi] ?? 0), maxEntropy, INNER_W, INNER_H)}
                fill="none"
                stroke="var(--color-text)"
                strokeOpacity={0.07}
                strokeWidth={0.8}
              />
            ))}

            <path
              d={makePath(meanEntropy, maxEntropy, INNER_W, INNER_H)}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={1.5}
            />

            {crosshairX !== null && (
              <line
                x1={crosshairX}
                y1={0}
                x2={crosshairX}
                y2={INNER_H}
                stroke="var(--color-text)"
                strokeOpacity={0.25}
                strokeWidth={0.5}
                strokeDasharray="3,2"
              />
            )}

            <text x={0} y={INNER_H + 12} fontSize={7} textAnchor="middle" fill="var(--color-text-muted)" style={{ fontFamily: "var(--font-ibm-plex-mono), monospace" }}>0</text>
            <text x={INNER_W} y={INNER_H + 12} fontSize={7} textAnchor="middle" fill="var(--color-text-muted)" style={{ fontFamily: "var(--font-ibm-plex-mono), monospace" }}>{nLayers - 1}</text>
            <text x={INNER_W / 2} y={INNER_H + 12} fontSize={7} textAnchor="middle" fill="var(--color-text-muted)" style={{ fontFamily: "var(--font-ibm-plex-mono), monospace" }}>layer</text>

            <text
              x={-PAD.left + 2}
              y={INNER_H / 2}
              fontSize={7}
              textAnchor="middle"
              fill="var(--color-text-muted)"
              transform={`rotate(-90, ${-PAD.left + 2}, ${INNER_H / 2})`}
              style={{ fontFamily: "var(--font-ibm-plex-mono), monospace" }}
            >
              nats
            </text>
          </g>
        </svg>

        {tooltipData && (
          <div style={{
            position: "absolute",
            top: 6,
            right: 4,
            background: "var(--color-card)",
            border: "1px solid var(--color-card-border)",
            borderRadius: 4,
            padding: "3px 6px",
            fontSize: 8,
            fontFamily: "var(--font-ibm-plex-mono), monospace",
            color: "var(--color-text-muted)",
            pointerEvents: "none",
            lineHeight: 1.6,
          }}>
            <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>
              {tooltipData.layerLabel}
            </span>
            <br />
            H̄ = {tooltipData.mean.toFixed(2)}
            {xLabels.length > 0 && (
              <><br />{xLabels.length} positions</>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(EntropyCard);
