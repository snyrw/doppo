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

  const stateRef = useRef(canvasState);
  stateRef.current = canvasState;

  const { startDrag, onDragMove, onDragEnd, isDragging } = useCardDrag({
    getCurrentZoom: () => stateRef.current.zoom,
    onCommit: onMoveCard,
    cardRefs,
  });

  const { panHandlers } = useCanvasPan({
    onPanChange: (offset) => {
      onCanvasChange({ ...stateRef.current, panOffset: offset });
    },
    getCurrentPan: () => stateRef.current.panOffset,
  });

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { zoom, panOffset } = stateRef.current;
      const rect = el.getBoundingClientRect();

      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));

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
  }, []);

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
        background: "#0d1117",
        backgroundImage: "radial-gradient(circle, #21262d 1px, transparent 1px)",
        backgroundSize: "24px 24px",
        cursor: isDragging ? "grabbing" : "default",
      }}
      {...panHandlers}
    >
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
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ opacity: 0.2 }}>
            <circle cx="20" cy="20" r="18" stroke="#58a6ff" strokeWidth="1.5" />
            <circle cx="20" cy="20" r="10" stroke="#58a6ff" strokeWidth="1.5" />
            <circle cx="20" cy="20" r="2" fill="#58a6ff" />
            <line x1="20" y1="2" x2="20" y2="8" stroke="#58a6ff" strokeWidth="1.5" />
            <line x1="20" y1="32" x2="20" y2="38" stroke="#58a6ff" strokeWidth="1.5" />
            <line x1="2" y1="20" x2="8" y2="20" stroke="#58a6ff" strokeWidth="1.5" />
            <line x1="32" y1="20" x2="38" y2="20" stroke="#58a6ff" strokeWidth="1.5" />
          </svg>
          <p style={{ fontSize: 12, color: "#484f58", letterSpacing: "0.05em" }}>Add a lens to get started</p>
        </div>
      )}

      {zoom !== 1 && (
        <div style={{
          position: "absolute",
          bottom: 12,
          right: 12,
          fontSize: 10,
          color: "#7d8590",
          background: "rgba(22, 27, 34, 0.9)",
          border: "1px solid #30363d",
          borderRadius: 4,
          padding: "3px 7px",
          pointerEvents: "none",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "0.05em",
        }}>
          {Math.round(zoom * 100)}%
        </div>
      )}
    </div>
  );
}
