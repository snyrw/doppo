"use client";

import { useRef, useCallback } from "react";

export type PanOffset = { x: number; y: number };

type UseCanvasPanOptions = {
  onPanChange: (offset: PanOffset) => void;
  getCurrentPan: () => PanOffset;
};

export function useCanvasPan({ onPanChange, getCurrentPan }: UseCanvasPanOptions) {
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ px: number; py: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Only left-click pans. Card headers call stopPropagation so they never reach here.
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isPanningRef.current = true;
    const pan = getCurrentPan();
    panStartRef.current = {
      px: e.clientX - pan.x,
      py: e.clientY - pan.y,
    };
  }, [getCurrentPan]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanningRef.current || !panStartRef.current) return;
    onPanChange({
      x: e.clientX - panStartRef.current.px,
      y: e.clientY - panStartRef.current.py,
    });
  }, [onPanChange]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanningRef.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    isPanningRef.current = false;
    panStartRef.current = null;
  }, []);

  return {
    panHandlers: { onPointerDown, onPointerMove, onPointerUp },
    isPanningRef,
  };
}
