"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const GRID_SIZE = 20;
const CARD_GAP = 6; // minimum pixel gap maintained between cards

type Position = { x: number; y: number };

type DragState = {
  cardId: string;
  startPointer: Position;
  startCardPos: Position;
  pointerId: number;
};

type UseCardDragOptions = {
  getCurrentZoom: () => number;
  onCommit: (cardId: string, pos: Position) => void;
  cardRefs: React.RefObject<Map<string, HTMLDivElement>>;
};

/**
 * Pushes (x, y) out of any overlapping cards using iterative AABB separation.
 * Chooses the minimum-displacement axis at each overlap.
 */
function resolveCollisions(
  draggedId: string,
  x: number,
  y: number,
  cardRefs: Map<string, HTMLDivElement>
): Position {
  const draggedEl = cardRefs.get(draggedId);
  if (!draggedEl) return { x, y };

  const dw = draggedEl.offsetWidth;
  const dh = draggedEl.offsetHeight;

  for (let iter = 0; iter < 8; iter++) {
    let anyOverlap = false;

    for (const [id, el] of cardRefs) {
      if (id === draggedId) continue;

      const bx = parseFloat(el.style.left) || 0;
      const by = parseFloat(el.style.top) || 0;
      const bw = el.offsetWidth;
      const bh = el.offsetHeight;

      // AABB overlap test with gap
      if (
        x < bx + bw + CARD_GAP &&
        x + dw + CARD_GAP > bx &&
        y < by + bh + CARD_GAP &&
        y + dh + CARD_GAP > by
      ) {
        anyOverlap = true;

        // Amount to push in each direction to clear the gap
        const pushRight = bx + bw + CARD_GAP - x;
        const pushLeft  = x + dw + CARD_GAP - bx;
        const pushDown  = by + bh + CARD_GAP - y;
        const pushUp    = y + dh + CARD_GAP - by;

        const min = Math.min(pushRight, pushLeft, pushDown, pushUp);
        if      (min === pushRight) x += pushRight;
        else if (min === pushLeft)  x -= pushLeft;
        else if (min === pushDown)  y += pushDown;
        else                        y -= pushUp;
      }
    }

    if (!anyOverlap) break;
  }

  return { x, y };
}

export function useCardDrag({ getCurrentZoom, onCommit, cardRefs }: UseCardDragOptions) {
  const dragStateRef = useRef<DragState | null>(null);
  const onCommitRef = useRef(onCommit);
  useEffect(() => { onCommitRef.current = onCommit; });

  const [isDragging, setIsDragging] = useState(false);

  const startDrag = useCallback((
    e: React.PointerEvent<HTMLElement>,
    cardId: string,
    currentPos: Position
  ) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      cardId,
      startPointer: { x: e.clientX, y: e.clientY },
      startCardPos: { ...currentPos },
      pointerId: e.pointerId,
    };
    setIsDragging(true);
    const cardEl = cardRefs.current?.get(cardId);
    if (cardEl) cardEl.style.zIndex = "20";
  }, [cardRefs]);

  const handleDragMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const zoom = getCurrentZoom();
    const rawX = drag.startCardPos.x + (e.clientX - drag.startPointer.x) / zoom;
    const rawY = drag.startCardPos.y + (e.clientY - drag.startPointer.y) / zoom;

    const resolved = resolveCollisions(drag.cardId, rawX, rawY, cardRefs.current!);

    const cardEl = cardRefs.current?.get(drag.cardId);
    if (cardEl) {
      cardEl.style.left = `${resolved.x}px`;
      cardEl.style.top  = `${resolved.y}px`;
    }
  }, [getCurrentZoom, cardRefs]);

  const handleDragEnd = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    e.currentTarget.releasePointerCapture(e.pointerId);

    const zoom = getCurrentZoom();
    const rawX = drag.startCardPos.x + (e.clientX - drag.startPointer.x) / zoom;
    const rawY = drag.startCardPos.y + (e.clientY - drag.startPointer.y) / zoom;

    // Snap to grid first, then resolve any collisions the snap may have introduced
    const snappedX = Math.round(rawX / GRID_SIZE) * GRID_SIZE;
    const snappedY = Math.round(rawY / GRID_SIZE) * GRID_SIZE;
    const finalPos = resolveCollisions(drag.cardId, snappedX, snappedY, cardRefs.current!);

    const cardEl = cardRefs.current?.get(drag.cardId);
    if (cardEl) {
      cardEl.style.left  = `${finalPos.x}px`;
      cardEl.style.top   = `${finalPos.y}px`;
      cardEl.style.zIndex = "10";
    }

    onCommitRef.current(drag.cardId, finalPos);
    dragStateRef.current = null;
    setIsDragging(false);
  }, [getCurrentZoom, cardRefs]);

  return { startDrag, onDragMove: handleDragMove, onDragEnd: handleDragEnd, isDragging };
}
