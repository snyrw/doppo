"use client";

import React from "react";
import { cn } from "../../lib/cn";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    // Two chamfered layers: outer = cut border tone, inner = card surface.
    // The inner clip-path also clips each active segment's fill to the chamfer.
    <div
      className="chamfer [--bw:1px] [--c:4px] shrink-0 bg-card-border p-px"
      onPointerDown={e => e.stopPropagation()}
    >
      <div className="chamfer-inner flex bg-card">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "cursor-pointer border-none px-1.5 py-0.5 text-[9px] leading-[1.4] transition-colors",
              opt.value === value
                ? "bg-surface-border text-foreground"
                : "bg-transparent text-muted hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
