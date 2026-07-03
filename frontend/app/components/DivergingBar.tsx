"use client";

import React from "react";
import { interpolateColorDivergent, type DivergingPaletteName } from "../lib/palette";
import { HoverTooltip } from "../lib/tooltip";

const DEFAULT_WIDTH = 160;
const DEFAULT_HEIGHT = 14;

export function DivergingBar({
  val, absMax, palette, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT, tooltipContent,
}: {
  val: number;
  absMax: number;
  palette: DivergingPaletteName;
  width?: number | string;
  height?: number | string;
  tooltipContent?: React.ReactNode;
}) {
  const [hover, setHover] = React.useState<{ x: number; y: number } | null>(null);
  const color = interpolateColorDivergent(palette, val, absMax);
  const barFrac = Math.abs(val) / absMax;
  const isPositive = val >= 0;
  return (
    <>
    <div
      onMouseEnter={(e) => tooltipContent && setHover({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setHover(null)}
      className="relative flex shrink-0 items-stretch overflow-hidden rounded-sm bg-surface-border"
      style={{ width, height }}
    >
      <div className="absolute bottom-0 left-1/2 top-0 z-[1] w-px bg-card-border" />
      {isPositive ? (
        <>
          <div className="w-1/2" />
          <div className="rounded-r-sm" style={{ width: `${barFrac * 50}%`, background: color }} />
        </>
      ) : (
        <>
          <div className="flex-1" />
          <div className="self-stretch rounded-l-sm" style={{ width: `${barFrac * 50}%`, background: color }} />
          <div className="w-1/2" />
        </>
      )}
    </div>
    {hover && tooltipContent && <HoverTooltip x={hover.x} y={hover.y}>{tooltipContent}</HoverTooltip>}
    </>
  );
}
