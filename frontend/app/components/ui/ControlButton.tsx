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
        "chamfer [--c:3px] shrink-0 cursor-pointer bg-surface-border",
        "px-[6px] py-[2px] text-[9px] leading-[1.4] text-muted transition-[color,transform]",
        "hover:enabled:text-foreground active:enabled:translate-y-px",
        "disabled:cursor-default disabled:opacity-40",
        className,
      )}
    />
  );
}
