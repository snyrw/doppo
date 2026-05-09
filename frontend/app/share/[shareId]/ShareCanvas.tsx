"use client";

import { useState } from "react";
import SandboxCanvas from "../../components/SandboxCanvas";
import type { LensCardData } from "../../components/LensCard";

type CanvasState = { panOffset: { x: number; y: number }; zoom: number };

export default function ShareCanvas({
  cards,
  canvas,
}: {
  cards: LensCardData[];
  canvas: CanvasState;
}) {
  const [canvasState, setCanvasState] = useState(canvas);

  return (
    <SandboxCanvas
      cards={cards}
      canvasState={canvasState}
      onCanvasChange={setCanvasState}
      onMoveCard={() => {}}
      onRemoveCard={() => {}}
    />
  );
}
