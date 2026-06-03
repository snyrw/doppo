"use client";
import { createPortal } from "react-dom";

export function HoverTooltip({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div style={{
      position: "fixed",
      left: x + 14,
      top: y - 4,
      pointerEvents: "none",
      zIndex: 99999,
      background: "var(--color-card)",
      border: "1px solid var(--color-card-border)",
      borderRadius: 6,
      boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
      padding: "6px 9px",
      fontSize: 9,
      fontFamily: "var(--font-ibm-plex-sans), sans-serif",
      color: "var(--color-text)",
      lineHeight: 1.7,
      whiteSpace: "nowrap",
    }}>
      {children}
    </div>,
    document.body
  );
}

export type TooltipState = { x: number; y: number; content: React.ReactNode } | null;
