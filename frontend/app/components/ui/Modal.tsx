"use client";

import React from "react";
import { cn } from "../../lib/cn";

/**
 * Overlay + centered panel scaffold. Clicking the overlay closes; clicking the
 * panel does not. Callers MUST supply the panel width via `className` (the
 * primitive sets no width, so there is no utility-merge conflict).
 */
export function Modal({
  onClose,
  className,
  children,
}: {
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={cn(
          "max-h-[85vh] overflow-y-auto rounded-xl border border-card-border",
          "bg-card p-6 shadow-[0_8px_32px_rgba(0,0,0,0.18)]",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}