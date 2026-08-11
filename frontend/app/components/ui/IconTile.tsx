"use client";

import React from "react";
import { cn } from "../../lib/cn";

/**
 * Square icon button matching the app's shared tactile control style (see TactileButton).
 * Use for any standalone icon action instead of a one-off styled button.
 */
export function IconTile({
  className,
  innerClassName,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { innerClassName?: string }) {
  return (
    <button {...rest} className={cn("tactile icon-tile", className)}>
      <span className="tactile__base" aria-hidden="true" />
      <span className="tactile__face">
        <span className={cn("tactile__inner", innerClassName)}>{children}</span>
      </span>
    </button>
  );
}
