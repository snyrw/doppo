"use client";

import React from "react";
import { interpolateColorDivergent, type DivergingPaletteName } from "../lib/palette";
import { HoverTooltip, type TooltipState } from "../lib/tooltip";
import {
  BORDER_W, HEAD_LABEL_W, LABEL_GAP, headLabelText, headLayout,
} from "./bar-table-geometry";
import { CARD_INSET } from "./card-geometry";

/**
 * Signed layer × head heatmap, shared by DLA and attribution.
 */
function HeadGrid({
  values, xLabels, yLabels, absMax, palette, cell, gap,
}: {
  values: number[][];
  xLabels: string[];
  yLabels: string[];
  absMax: number;
  palette: DivergingPaletteName;
  cell: number;
  gap: number;
}) {
  const [tooltip, setTooltip] = React.useState<TooltipState>(null);
  return (
    <>
      <div className="inline-flex flex-col" style={{ gap }}>
        <div className="flex">
          <div className="shrink-0" style={{ width: HEAD_LABEL_W, marginRight: LABEL_GAP }} />
          <div className="flex" style={{ gap }}>
            {xLabels.map((h, i) => (
              <div
                key={i}
                className="shrink-0 truncate pb-0.5 text-center font-mono text-[7px] text-muted"
                style={{ width: cell }}
              >
                {headLabelText(h, cell)}
              </div>
            ))}
          </div>
        </div>

        {yLabels.map((label, li) => (
          <div key={label} className="flex items-center">
            <div
              className="shrink-0 text-left font-mono text-[9px] text-muted"
              style={{ width: HEAD_LABEL_W, marginRight: LABEL_GAP }}
            >
              {label}
            </div>
            <div className="flex" style={{ gap }}>
              {values[li].map((val, hi) => (
                <div
                  key={hi}
                  onMouseEnter={e => setTooltip({
                    x: e.clientX, y: e.clientY,
                    content: (
                      <>
                        <span className="font-semibold">{label}</span>{" H"}{hi}<br />
                        <span className="font-mono tabular-nums">
                          {val >= 0 ? "+" : ""}{val.toFixed(3)}
                        </span>
                      </>
                    ),
                  })}
                  onMouseLeave={() => setTooltip(null)}
                  className="box-border shrink-0 rounded-sm border-[0.5px] border-surface-border"
                  style={{
                    width: cell,
                    height: cell,
                    backgroundColor: interpolateColorDivergent(palette, val, absMax),
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {tooltip && <HoverTooltip x={tooltip.x} y={tooltip.y}>{tooltip.content}</HoverTooltip>}
    </>
  );
}

/**
 * Frame around `HeadGrid`. Sizes the cells and gap to fill `cardWidth` via
 * headLayout().
 */
export function HeadView({
  values, xLabels, yLabels, absMax, palette, cardWidth,
}: {
  values: number[][];
  xLabels: string[];
  yLabels: string[];
  absMax: number;
  palette: DivergingPaletteName;
  cardWidth: number;
}) {
  const contentW = cardWidth - BORDER_W - CARD_INSET * 2;
  const { cell, gap } = headLayout(xLabels.length, contentW);

  return (
    <div onPointerDown={e => e.stopPropagation()} style={{ paddingInline: CARD_INSET, paddingBlock: 12 }}>
      <HeadGrid values={values} xLabels={xLabels} yLabels={yLabels} absMax={absMax} palette={palette} cell={cell} gap={gap} />
    </div>
  );
}
