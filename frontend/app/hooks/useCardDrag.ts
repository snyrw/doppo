"use client";

import { useRef, useState, useCallback } from "react";

const GRID_SIZE = 40;

type Position = { x: number; y: number };

type DragState = {
  cardId: string;
  startPointer: Position;
  startCardPos: Position;
  pointerId: number;
};

type UseCardDragOptions = {
  getCurrentZoom: () => number;
  onCommit: (cardId: string, snappedPos: Position) => void;
  cardRefs: React.RefObject<Map<string, HTMLDivElement>>;
};

export function useCardDrag({ getCurrentZoom, onCommit, cardRefs }: UseCardDragOptions) {
  const dragStateRef = useRef<DragState | null>(null);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

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

    const cardEl = cardRefs.current?.get(drag.cardId);
    if (cardEl) {
      cardEl.style.left = `${rawX}px`;
      cardEl.style.top = `${rawY}px`;
    }
  }, [getCurrentZoom, cardRefs]);

  const handleDragEnd = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    e.currentTarget.releasePointerCapture(e.pointerId);

    const zoom = getCurrentZoom();
    const rawX = drag.startCardPos.x + (e.clientX - drag.startPointer.x) / zoom;
    const rawY = drag.startCardPos.y + (e.clientY - drag.startPointer.y) / zoom;

    const snappedX = Math.round(rawX / GRID_SIZE) * GRID_SIZE;
    const snappedY = Math.round(rawY / GRID_SIZE) * GRID_SIZE;

    const cardEl = cardRefs.current?.get(drag.cardId);
    if (cardEl) {
      cardEl.style.left = `${snappedX}px`;
      cardEl.style.top = `${snappedY}px`;
      cardEl.style.zIndex = "10";
    }

    onCommitRef.current(drag.cardId, { x: snappedX, y: snappedY });
    dragStateRef.current = null;
    setIsDragging(false);
  }, [getCurrentZoom, cardRefs]);

  return { startDrag, onDragMove: handleDragMove, onDragEnd: handleDragEnd, isDragging };
}
