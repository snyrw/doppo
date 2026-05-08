"use client";

import { useRef, useEffect, useCallback } from "react";
import SnapGrid from "./SnapGrid";
import LensCard, { type LensCardData } from "./LensCard";
import { useCanvasPan } from "../hooks/useCanvasPan";
import { useCardDrag } from "../hooks/useCardDrag";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;

type CanvasState = {
  panOffset: { x: number; y: number };
  zoom: number;
};

type SandboxCanvasProps = {
  cards: LensCardData[];
  canvasState: CanvasState;
  onCanvasChange: (state: CanvasState) => void;
  onMoveCard: (id: string, pos: { x: number; y: number }) => void;
  onRemoveCard: (id: string) => void;
};

export default function SandboxCanvas({
  cards,
  canvasState,
  onCanvasChange,
  onMoveCard,
  onRemoveCard,
}: SandboxCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Keep a ref to current canvas state for use inside event handlers
  const stateRef = useRef(canvasState);
  stateRef.current = canvasState;

  // Card drag
  const { startDrag, onDragMove, onDragEnd, isDragging } = useCardDrag({
    getCurrentZoom: () => stateRef.current.zoom,
    onCommit: onMoveCard,
    cardRefs,
  });

  // Canvas pan
  const { panHandlers } = useCanvasPan({
    onPanChange: (offset) => {
      onCanvasChange({ ...stateRef.current, panOffset: offset });
    },
    getCurrentPan: () => stateRef.current.panOffset,
  });

  // Wheel zoom — must be imperative to use { passive: false }
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { zoom, panOffset } = stateRef.current;
      const rect = el.getBoundingClientRect();

      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));

      // Focal-point correction: keep the point under the cursor fixed in canvas space
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const canvasX = (mouseX - panOffset.x) / zoom;
      const canvasY = (mouseY - panOffset.y) / zoom;
      const newPanX = mouseX - canvasX * newZoom;
      const newPanY = mouseY - canvasY * newZoom;

      onCanvasChange({ zoom: newZoom, panOffset: { x: newPanX, y: newPanY } });
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []); // empty — reads state via stateRef, registers once

  const setCardRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  }, []);

  const { panOffset, zoom } = canvasState;

  return (
    <div
      ref={viewportRef}
      style={{
        flex: 1,
        overflow: "hidden",
        position: "relative",
        background: "var(--color-bg)",
        cursor: isDragging ? "grabbing" : "default",
      }}
      {...panHandlers}
    >
      {/* World — everything inside here is in canvas-space coordinates */}
      <div
        ref={worldRef}
        style={{
          position: "absolute",
          transformOrigin: "0 0",
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
          width: 4000,
          height: 4000,
        }}
      >
        <SnapGrid isDragging={isDragging} />

        {cards.map(card => (
          <LensCard
            key={card.id}
            card={card}
            ref={setCardRef(card.id)}
            onStartDrag={startDrag}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
            onRemove={onRemoveCard}
          />
        ))}
      </div>

      {/* Empty state */}
      {cards.length === 0 && (
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          pointerEvents: "none",
        }}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ opacity: 0.15 }}>
            <circle cx="20" cy="20" r="18" stroke="#374151" strokeWidth="1.5" />
            <circle cx="20" cy="20" r="10" stroke="#374151" strokeWidth="1.5" />
            <circle cx="20" cy="20" r="2" fill="#374151" />
            <line x1="20" y1="2" x2="20" y2="8" stroke="#374151" strokeWidth="1.5" />
            <line x1="20" y1="32" x2="20" y2="38" stroke="#374151" strokeWidth="1.5" />
            <line x1="2" y1="20" x2="8" y2="20" stroke="#374151" strokeWidth="1.5" />
            <line x1="32" y1="20" x2="38" y2="20" stroke="#374151" strokeWidth="1.5" />
          </svg>
          <p style={{ fontSize: 13, color: "#9ca3af" }}>Add a lens to get started</p>
        </div>
      )}

      {/* Zoom indicator */}
      {zoom !== 1 && (
        <div style={{
          position: "absolute",
          bottom: 12,
          right: 12,
          fontSize: 10,
          color: "#9ca3af",
          background: "rgba(255,255,255,0.8)",
          border: "1px solid #e5e7eb",
          borderRadius: 4,
          padding: "3px 7px",
          pointerEvents: "none",
          fontVariantNumeric: "tabular-nums",
        }}>
          {Math.round(zoom * 100)}%
        </div>
      )}
    </div>
  );
}
