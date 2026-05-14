"use client";

import { useState } from "react";
import SandboxCanvas, { type AnyCard } from "../../components/SandboxCanvas";

type CanvasState = { panOffset: { x: number; y: number }; zoom: number };

export default function ShareCanvas({
  cards,
  canvas,
}: {
  cards: AnyCard[];
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
      onVerifyTopK={() => {}}
      onSteerComponents={() => {}}
      onRerunSteering={() => {}}
    />
  );
}
