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
  tutorialMode?: boolean;
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

function EntropyCard({ card, ref, onStartDrag, onDragMove, onDragEnd, onRemove, tutorialMode }: EntropyCardProps) {
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
      className="absolute z-10 flex flex-col rounded-lg border border-card-border bg-card shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
      style={{ left: card.position.x, top: card.position.y, width: CARD_W }}
    >
      <div
        onPointerDown={e => onStartDrag(e, card.id, card.position)}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        className="flex shrink-0 cursor-grab select-none items-center gap-1.5 rounded-t-lg border-b border-surface-border px-2.5 py-[7px]"
      >
        <svg width="8" height="12" viewBox="0 0 8 12" fill="none" className="shrink-0 opacity-30">
          <circle cx="2" cy="2" r="1.2" fill="currentColor" />
          <circle cx="6" cy="2" r="1.2" fill="currentColor" />
          <circle cx="2" cy="6" r="1.2" fill="currentColor" />
          <circle cx="6" cy="6" r="1.2" fill="currentColor" />
          <circle cx="2" cy="10" r="1.2" fill="currentColor" />
          <circle cx="6" cy="10" r="1.2" fill="currentColor" />
        </svg>
        <span className="flex-1 truncate text-[9px] font-semibold text-muted">
          H · {card.modelName.split("/").pop()}
        </span>
        {!tutorialMode && (
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={() => onRemove(card.id)}
            className="shrink-0 cursor-pointer border-none bg-transparent px-0.5 text-xs leading-none text-muted"
          >
            ×
          </button>
        )}
      </div>

      <div className="relative px-1.5 pb-1.5 pt-2">
        <svg
          width={INNER_W + PAD.left + PAD.right}
          height={INNER_H + PAD.top + PAD.bottom}
          className="block overflow-visible"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredLayer(null)}
        >
          <g transform={`translate(${PAD.left},${PAD.top})`}>
            {yTicks.map((val, i) => {
              const y = INNER_H - (val / Math.max(maxEntropy, 0.01)) * INNER_H;
              return (
                <g key={i}>
                  <line x1={-3} y1={y} x2={INNER_W} y2={y} stroke="var(--surface-border)" strokeWidth={0.5} />
                  <text
                    x={-5}
                    y={y + 3}
                    fontSize={7}
                    textAnchor="end"
                    fill="var(--text-muted)"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            <line x1={0} y1={INNER_H} x2={INNER_W} y2={INNER_H} stroke="var(--surface-border)" strokeWidth={0.5} />

            {Array.from({ length: nPos }, (_, pi) => (
              <path
                key={pi}
                d={makePath(entropyData.map(row => row[pi] ?? 0), maxEntropy, INNER_W, INNER_H)}
                fill="none"
                stroke="var(--text)"
                strokeOpacity={0.07}
                strokeWidth={0.8}
              />
            ))}

            <path
              d={makePath(meanEntropy, maxEntropy, INNER_W, INNER_H)}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={1.5}
            />

            {crosshairX !== null && (
              <line
                x1={crosshairX}
                y1={0}
                x2={crosshairX}
                y2={INNER_H}
                stroke="var(--text)"
                strokeOpacity={0.25}
                strokeWidth={0.5}
                strokeDasharray="3,2"
              />
            )}

            <text x={0} y={INNER_H + 12} fontSize={7} textAnchor="middle" fill="var(--text-muted)">0</text>
            <text x={INNER_W} y={INNER_H + 12} fontSize={7} textAnchor="middle" fill="var(--text-muted)">{nLayers - 1}</text>
            <text x={INNER_W / 2} y={INNER_H + 12} fontSize={7} textAnchor="middle" fill="var(--text-muted)">layer</text>

            <text
              x={-PAD.left + 2}
              y={INNER_H / 2}
              fontSize={7}
              textAnchor="middle"
              fill="var(--text-muted)"
              transform={`rotate(-90, ${-PAD.left + 2}, ${INNER_H / 2})`}
            >
              nats
            </text>
          </g>
        </svg>

        {tooltipData && (
          <div className="pointer-events-none absolute right-1 top-1.5 rounded border border-card-border bg-card px-1.5 py-[3px] text-[8px] leading-[1.6] text-muted">
            <span className="font-bold text-accent">
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
