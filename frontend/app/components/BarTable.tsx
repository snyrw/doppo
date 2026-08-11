"use client";

import React from "react";
import { interpolateColorDivergent, type DivergingPaletteName } from "../lib/palette";
import { HoverTooltip, type TooltipState } from "../lib/tooltip";
import { cn } from "../lib/cn";
import {
  BAR_H, COL_GAP, HEADER_ROW_H, LABEL_GAP, ROW_H, TICK_H, TICK_W, VALUE_W, barRect,
} from "./bar-table-geometry";

/* The ruled bar table shared by DLA, attribution and activation. */

type BarSpec = {
  val: number;
  /** Per bar, not per table: activation scales its two columns independently. */
  absMax: number;
  /** Columns this bar covers, including the gaps between them. Defaults to 1. */
  span?: number;
};

export type BarColumn = {
  /** Empty for a single-column table, where there is nothing to distinguish. */
  header: string;
  width: number;
};

export type BarTableRow = {
  key: string;
  label: string;
  labelItalic?: boolean;
  bars: BarSpec[];
  value: string;
  tooltip: React.ReactNode;
};

/** Width of a bar spanning `span` columns from index `i`, gaps included. */
function spanWidth(columns: BarColumn[], i: number, span: number): number {
  let w = 0;
  for (let n = 0; n < span && i + n < columns.length; n++) {
    w += columns[i + n].width + (n > 0 ? COL_GAP : 0);
  }
  return w;
}

function DlaBar({
  val, absMax, palette, width,
}: {
  val: number;
  absMax: number;
  palette: DivergingPaletteName;
  width: number;
}) {
  const rect = barRect(val, absMax, width);
  return (
    <div data-dla-bar className="relative shrink-0" style={{ width, height: ROW_H }}>
      {rect.width > 0 && (
        <div
          className="absolute top-1/2 -translate-y-1/2"
          style={{
            left: rect.left,
            width: rect.width,
            height: BAR_H,
            backgroundColor: interpolateColorDivergent(palette, val, absMax),
          }}
        />
      )}
      {/* Drawn after the bar so the baseline always reads as an unbroken line.
          barRect already keeps them from overlapping; this is the backstop. */}
      <div
        className="absolute left-1/2 top-1/2 -translate-y-1/2 bg-card-border"
        style={{ width: TICK_W, height: TICK_H }}
      />
    </div>
  );
}

export function BarTable({
  labelW, columns, labelHeader, valueHeader, rows, palette, valueW = VALUE_W,
}: {
  labelW: number;
  columns: BarColumn[];
  labelHeader: string;
  valueHeader: string;
  rows: BarTableRow[];
  palette: DivergingPaletteName;
  /** Widen for a value column that carries percentages rather than `+0.30`. */
  valueW?: number;
}) {
  const [tooltip, setTooltip] = React.useState<TooltipState>(null);

  return (
    <>
      <div
        className="sticky top-0 z-10 box-border flex items-center border-b border-card-border bg-card"
        style={{ height: HEADER_ROW_H }}
      >
        <div
          className="shrink-0 text-[11px] leading-none text-foreground"
          style={{ width: labelW + LABEL_GAP }}
        >
          {labelHeader}
        </div>
        {columns.map((col, i) => (
          <div
            key={i}
            className="shrink-0 text-center text-[11px] leading-none text-foreground"
            style={{ width: col.width, marginLeft: i > 0 ? COL_GAP : 0 }}
          >
            {col.header}
          </div>
        ))}
        <div
          className="shrink-0 text-right text-[11px] leading-none text-foreground"
          style={{ width: valueW, marginLeft: COL_GAP }}
        >
          {valueHeader}
        </div>
      </div>

      {rows.map((row, ri) => {
        // Bars are positional: each consumes `span` columns starting where the
        // previous one left off.
        const cells: React.ReactNode[] = [];
        let col = 0;
        row.bars.forEach((bar, bi) => {
          const span = bar.span ?? 1;
          const width = spanWidth(columns, col, span);
          cells.push(
            <div key={bi} className="shrink-0" style={{ marginLeft: col > 0 ? COL_GAP : 0 }}>
              <DlaBar val={bar.val} absMax={bar.absMax} palette={palette} width={width} />
            </div>,
          );
          col += span;
        });

        return (
          <div
            key={row.key}
            data-dla-row
            onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, content: row.tooltip })}
            onMouseLeave={() => setTooltip(null)}
            className={cn(
              "box-border flex items-center",
              // No rule under the last row.
              ri < rows.length - 1 && "border-b border-card-border",
            )}
            style={{ height: ROW_H }}
          >
            <div
              className={cn(
                "shrink-0 pr-1 text-right font-mono text-[9px] text-muted",
                row.labelItalic && "italic",
              )}
              style={{ width: labelW, marginRight: LABEL_GAP }}
            >
              {row.label}
            </div>
            {cells}
            <div
              className="shrink-0 text-right font-mono text-[9px] tabular-nums text-muted"
              style={{ width: valueW, marginLeft: COL_GAP }}
            >
              {row.value}
            </div>
          </div>
        );
      })}

      {tooltip && <HoverTooltip x={tooltip.x} y={tooltip.y}>{tooltip.content}</HoverTooltip>}
    </>
  );
}
