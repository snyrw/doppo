"use client";

import { useState } from "react";
import SandboxCanvas, { type AnyCard, type CanvasState } from "../../components/SandboxCanvas";

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
      onSpawnEntropyCard={() => {}}
    />
  );
}
