"use client";

import React from "react";
import { cn } from "../../lib/cn";

/**
 * Square chamfered icon button with the same tactile sink as TactileButton.
 * Pass the icon (svg / glyph) as children.
 */
export function IconTile({
  className,
  innerClassName,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { innerClassName?: string }) {
  return (
    <button {...rest} className={cn("tactile icon-tile", className)}>
      <span className="tactile__base chamfer" aria-hidden="true" />
      <span className="tactile__face chamfer">
        <span className={cn("tactile__inner chamfer-inner", innerClassName)}>{children}</span>
      </span>
    </button>
  );
}
