"use client";

import { useRef, useEffect, useCallback } from "react";
import LensCard, { type LensCardData } from "./LensCard";
import DlaCard, { type DlaCardData } from "./DlaCard";
import AttributionCard, { type AttributionCardData } from "./AttributionCard";
import ActivationCard, { type ActivationCardData } from "./ActivationCard";
import SteeringCard, { type SteeringCardData, type SteeringComponent } from "./SteeringCard";
import { useCanvasPan } from "../hooks/useCanvasPan";
import { useCardDrag } from "../hooks/useCardDrag";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;

type CanvasState = {
  panOffset: { x: number; y: number };
  zoom: number;
};

export type AnyCard = LensCardData | DlaCardData | AttributionCardData | ActivationCardData | SteeringCardData;

type SandboxCanvasProps = {
  cards: AnyCard[];
  canvasState: CanvasState;
  onCanvasChange: (state: CanvasState) => void;
  onMoveCard: (id: string, pos: { x: number; y: number }) => void;
  onRemoveCard: (id: string) => void;
  onVerifyTopK: (attributionCardId: string, k: number) => void;
  onSteerComponents: (sourceCardId: string, components: SteeringComponent[]) => void;
};

export default function SandboxCanvas({
  cards,
  canvasState,
  onCanvasChange,
  onMoveCard,
  onRemoveCard,
  onVerifyTopK,
  onSteerComponents,
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

  // Smooth wheel zoom — imperative to use { passive: false }
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { zoom, panOffset } = stateRef.current;

      if (e.ctrlKey) {
        // Pinch gesture — zoom keeping canvas point under cursor fixed
        const rect = el.getBoundingClientRect();
        const factor = Math.exp(-e.deltaY * 0.01);
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const canvasX = (mouseX - panOffset.x) / zoom;
        const canvasY = (mouseY - panOffset.y) / zoom;
        onCanvasChange({
          zoom: newZoom,
          panOffset: { x: mouseX - canvasX * newZoom, y: mouseY - canvasY * newZoom },
        });
      } else {
        // Two-finger swipe — pan
        onCanvasChange({
          zoom,
          panOffset: { x: panOffset.x - e.deltaX, y: panOffset.y - e.deltaY },
        });
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []); // reads state via stateRef, registers once

  const setCardRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  }, []);

  const { panOffset, zoom } = canvasState;

  function renderCard(card: AnyCard) {
    const sharedProps = {
      ref: setCardRef(card.id),
      onStartDrag: startDrag,
      onDragMove,
      onDragEnd,
      onRemove: onRemoveCard,
    };
    switch (card.cardType) {
      case "dla":
        return <DlaCard key={card.id} {...sharedProps} card={card} />;
      case "attribution":
        return <AttributionCard key={card.id} {...sharedProps} card={card} onVerifyTopK={onVerifyTopK} onSteerComponents={onSteerComponents} />;
      case "activation":
        return <ActivationCard key={card.id} {...sharedProps} card={card} onSteerComponents={onSteerComponents} />;
      case "steering":
        return <SteeringCard key={card.id} {...sharedProps} card={card} />;
      default:
        return <LensCard key={card.id} {...sharedProps} card={card as LensCardData} />;
    }
  }

  return (
    <div
      ref={viewportRef}
      style={{
        flex: 1,
        overflow: "hidden",
        position: "relative",
        background: "var(--color-bg)",
        cursor: isDragging ? "grabbing" : "grab",
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
        {cards.map(renderCard)}
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

      {/* Zoom level indicator */}
      {zoom !== 1 && (
        <div style={{
          position: "absolute",
          bottom: 12,
          right: 12,
          fontSize: 10,
          color: "var(--color-text-muted)",
          background: "var(--color-card)",
          border: "1px solid var(--color-card-border)",
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
