"use client";

import React from "react";
import { cn } from "../../lib/cn";

/**
 * Small in-card control button. Bakes in the canvas invariant: stops
 * pointer-down propagation so clicking it never pans the canvas.
 */
export function ControlButton({
  className,
  onPointerDown,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      onPointerDown={e => {
        e.stopPropagation();
        onPointerDown?.(e);
      }}
      className={cn(
        "shrink-0 cursor-pointer rounded border border-card-border bg-surface-border",
        "px-[5px] py-px text-[9px] leading-[1.4] text-muted transition-colors",
        "hover:enabled:text-foreground disabled:cursor-default disabled:opacity-40",
        className,
      )}
    />
  );
}
