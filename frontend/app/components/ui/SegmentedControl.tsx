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
    <div
      className="flex shrink-0 overflow-hidden rounded border border-card-border"
      onPointerDown={e => e.stopPropagation()}
    >
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
  );
}
