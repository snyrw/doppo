"use client";

import { useRef, useEffect, useCallback, useState, useLayoutEffect } from "react";
import LensCard, { type LensCardData } from "./LensCard";
import DlaCard, { type DlaCardData } from "./DlaCard";
import AttributionCard, { type AttributionCardData } from "./AttributionCard";
import ActivationCard, { type ActivationCardData } from "./ActivationCard";
import SteeringCard, { type SteeringCardData, type SteeringComponent } from "./SteeringCard";
import EntropyCard, { type EntropyCardData } from "./EntropyCard";
import AttentionCard, { type AttentionCardData } from "./AttentionCard";
import { useCanvasPan } from "../hooks/useCanvasPan";
import { useCardDrag } from "../hooks/useCardDrag";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;

type CanvasState = {
  panOffset: { x: number; y: number };
  zoom: number;
};

export type AnyCard = LensCardData | DlaCardData | AttributionCardData | ActivationCardData | SteeringCardData | EntropyCardData | AttentionCardData;

type SandboxCanvasProps = {
  cards: AnyCard[];
  canvasState: CanvasState;
  onCanvasChange: (state: CanvasState) => void;
  onMoveCard: (id: string, pos: { x: number; y: number }) => void;
  onRemoveCard: (id: string) => void;
  onVerifyTopK: (attributionCardId: string, k: number) => void;
  onSteerComponents: (sourceCardId: string, components: SteeringComponent[]) => void;
  onRerunSteering: (cardId: string, newAlpha: number) => void;
  onSpawnEntropyCard: (lensCardId: string) => void;
  onBuyCredits?: () => void;
};

export default function SandboxCanvas({
  cards,
  canvasState,
  onCanvasChange,
  onMoveCard,
  onRemoveCard,
  onVerifyTopK,
  onSteerComponents,
  onRerunSteering,
  onSpawnEntropyCard,
  onBuyCredits,
}: SandboxCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // localStateRef is the single source of truth for the current visual canvas state.
  // It's updated by both useLayoutEffect (on React commits) and imperative gesture handlers,
  // so it's always current even during active pan/zoom before the commit dispatch fires.
  const localStateRef = useRef(canvasState);
  const onCanvasChangeRef = useRef(onCanvasChange);
  onCanvasChangeRef.current = onCanvasChange;
  const [displayZoom, setDisplayZoom] = useState(canvasState.zoom);

  const { startDrag, onDragMove, onDragEnd, isDragging } = useCardDrag({
    getCurrentZoom: () => localStateRef.current.zoom,
    onCommit: onMoveCard,
    cardRefs,
  });

  const { panHandlers } = useCanvasPan({
    getWorldEl: () => worldRef.current,
    getState: () => localStateRef.current,
    onCommit: (panOffset) => {
      const next = { ...localStateRef.current, panOffset };
      localStateRef.current = next;
      onCanvasChangeRef.current(next);
    },
  });

  // Sync committed React state → DOM. canvasState only changes on explicit commits
  // (pan end, scroll settle, LOAD_PROJECT), never during an active gesture, so this
  // never fights the imperative updates made during pan/zoom.
  useLayoutEffect(() => {
    localStateRef.current = canvasState;
    if (worldRef.current) {
      worldRef.current.style.transform = `translate(${canvasState.panOffset.x}px, ${canvasState.panOffset.y}px) scale(${canvasState.zoom})`;
    }
    setDisplayZoom(canvasState.zoom);
  }, [canvasState]);

  // Smooth wheel zoom/pan — must be { passive: false } to call preventDefault.
  // Applies transforms directly to the DOM; debounces the React state commit so
  // wheel events don't trigger full re-renders on every scroll tick.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    let commitTimer: ReturnType<typeof setTimeout> | null = null;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { zoom, panOffset } = localStateRef.current;
      let newState: CanvasState;

      if (e.ctrlKey) {
        const rect = el.getBoundingClientRect();
        const factor = Math.exp(-e.deltaY * 0.01);
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const canvasX = (mouseX - panOffset.x) / zoom;
        const canvasY = (mouseY - panOffset.y) / zoom;
        newState = {
          zoom: newZoom,
          panOffset: { x: mouseX - canvasX * newZoom, y: mouseY - canvasY * newZoom },
        };
      } else {
        newState = {
          zoom,
          panOffset: { x: panOffset.x - e.deltaX, y: panOffset.y - e.deltaY },
        };
      }

      localStateRef.current = newState;
      if (worldRef.current) {
        worldRef.current.style.transform = `translate(${newState.panOffset.x}px, ${newState.panOffset.y}px) scale(${newState.zoom})`;
      }
      setDisplayZoom(newState.zoom);

      if (commitTimer) clearTimeout(commitTimer);
      commitTimer = setTimeout(() => {
        onCanvasChangeRef.current(localStateRef.current);
      }, 150);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (commitTimer) clearTimeout(commitTimer);
    };
  }, []); // stable: all state read via refs, registered once

  const setCardRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  }, []);

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
        return <DlaCard key={card.id} {...sharedProps} card={card} onBuyCredits={onBuyCredits} />;
      case "attribution":
        return <AttributionCard key={card.id} {...sharedProps} card={card} onVerifyTopK={onVerifyTopK} onSteerComponents={onSteerComponents} onBuyCredits={onBuyCredits} />;
      case "activation":
        return <ActivationCard key={card.id} {...sharedProps} card={card} onSteerComponents={onSteerComponents} onBuyCredits={onBuyCredits} />;
      case "steering":
        return <SteeringCard key={card.id} {...sharedProps} card={card} onRerun={onRerunSteering} onBuyCredits={onBuyCredits} />;
      case "entropy":
        return <EntropyCard key={card.id} {...sharedProps} card={card as EntropyCardData} />;
      case "attention-pattern":
        return <AttentionCard key={card.id} {...sharedProps} card={card as AttentionCardData} onBuyCredits={onBuyCredits} />;
      default:
        return <LensCard key={card.id} {...sharedProps} card={card as LensCardData} onSpawnEntropy={() => onSpawnEntropyCard(card.id)} onBuyCredits={onBuyCredits} />;
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
          // Transform is managed imperatively via useLayoutEffect and gesture handlers.
          // This static placeholder prevents React from clearing the property on re-renders.
          transform: "translate(0px, 0px) scale(1)",
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
          <p style={{ fontSize: 13, color: "#9ca3af" }}>Add a card to get started</p>
        </div>
      )}

      {/* Zoom level indicator */}
      {displayZoom !== 1 && (
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
          {Math.round(displayZoom * 100)}%
        </div>
      )}
    </div>
  );
}
