"use client";

import React from "react";
import { interpolateColorDivergent, type DivergingPaletteName } from "../lib/palette";
import { HoverTooltip, type TooltipState } from "../lib/tooltip";
import {
  BORDER_W, HEAD_GAP, HEAD_LABEL_W, LABEL_GAP, headCellSize, headGridWidth,
} from "./bar-table-geometry";
import { CARD_INNER_RADIUS, CARD_INSET } from "./card-geometry";

/**
 * Signed layer × head heatmap, shared by DLA and attribution.
 *
 * Cells size to fill the column; the gap is fixed at the tables' COL_GAP and the
 * label gutter at their LAYER_LABEL_W, so the cells begin at exactly the x where
 * a bar table's first zone begins. Toggling Layer↔Head leaves the label column
 * and the data's left edge in place.
 *
 * Past the cell floor the caller lets the grid overflow and scroll rather than
 * shrinking cells into specks too small to hover.
 */
function HeadGrid({
  values, xLabels, yLabels, absMax, palette, cell,
}: {
  values: number[][];
  xLabels: string[];
  yLabels: string[];
  absMax: number;
  palette: DivergingPaletteName;
  cell: number;
}) {
  const [tooltip, setTooltip] = React.useState<TooltipState>(null);
  return (
    <>
      <div className="inline-flex flex-col" style={{ gap: HEAD_GAP }}>
        <div className="flex">
          <div className="shrink-0" style={{ width: HEAD_LABEL_W, marginRight: LABEL_GAP }} />
          <div className="flex" style={{ gap: HEAD_GAP }}>
            {xLabels.map((h, i) => (
              <div
                key={i}
                className="shrink-0 truncate pb-0.5 text-center font-mono text-[7px] text-muted"
                style={{ width: cell }}
              >
                {h}
              </div>
            ))}
          </div>
        </div>

        {yLabels.map((label, li) => (
          <div key={label} className="flex items-center">
            <div
              className="shrink-0 pr-1 text-right font-mono text-[9px] text-muted"
              style={{ width: HEAD_LABEL_W, marginRight: LABEL_GAP }}
            >
              {label}
            </div>
            <div className="flex" style={{ gap: HEAD_GAP }}>
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
 * Scrolling frame around `HeadGrid`. Sizes the cells to fit `cardWidth`,
 * centers any leftover space, and scrolls on both axes once the grid is
 * bigger than the card.
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
  const cell = headCellSize(xLabels.length, contentW);
  const slack = Math.max(0, contentW - headGridWidth(xLabels.length, cell));
  const offset = slack / 2;

  return (
    <div
      className="min-h-0 flex-1 overflow-auto"
      style={{
        borderBottomLeftRadius: CARD_INNER_RADIUS,
        borderBottomRightRadius: CARD_INNER_RADIUS,
      }}
      onPointerDown={e => e.stopPropagation()}
      onWheel={e => {
        const el = e.currentTarget;
        if (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth) {
          e.stopPropagation();
        }
      }}
    >
      <div style={{ paddingInline: CARD_INSET, paddingBlock: 12 }}>
        {/* Centers whatever space is left when even the widest gap can't fill the row. */}
        <div style={{ marginLeft: offset }}>
          <HeadGrid values={values} xLabels={xLabels} yLabels={yLabels} absMax={absMax} palette={palette} cell={cell} />
        </div>
      </div>
    </div>
  );
}
