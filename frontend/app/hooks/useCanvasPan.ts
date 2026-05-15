"use client";

import { useRef, useCallback } from "react";

export type PanOffset = { x: number; y: number };

type UseCanvasPanOptions = {
  getWorldEl: () => HTMLDivElement | null;
  getState: () => { panOffset: PanOffset; zoom: number };
  onCommit: (offset: PanOffset) => void;
};

export function useCanvasPan({ getWorldEl, getState, onCommit }: UseCanvasPanOptions) {
  const isPanningRef = useRef(false);
  const startRef = useRef<{ px: number; py: number } | null>(null);
  const currentOffsetRef = useRef<PanOffset>({ x: 0, y: 0 });
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { panOffset } = getState();
    currentOffsetRef.current = panOffset;
    startRef.current = {
      px: e.clientX - panOffset.x,
      py: e.clientY - panOffset.y,
    };
    isPanningRef.current = true;
  }, [getState]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanningRef.current || !startRef.current) return;
    const offset = {
      x: e.clientX - startRef.current.px,
      y: e.clientY - startRef.current.py,
    };
    currentOffsetRef.current = offset;
    const world = getWorldEl();
    if (!world) return;
    const { zoom } = getState();
    world.style.transform = `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`;
  }, [getWorldEl, getState]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanningRef.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    isPanningRef.current = false;
    startRef.current = null;
    onCommitRef.current(currentOffsetRef.current);
  }, []);

  return {
    panHandlers: { onPointerDown, onPointerMove, onPointerUp },
    isPanningRef,
  };
}
