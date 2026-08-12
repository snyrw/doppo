"use client";

import { useReducer, useEffect, useMemo, useState } from "react";
import { cn } from "../lib/cn";
import SandboxCanvas from "../components/SandboxCanvas";
import Navbar from "../components/Navbar";
import { TactileButton } from "../components/ui/TactileButton";
import { TOP_BAR_PAD, TOP_BAR_FACE_CLS } from "../components/ui/control-metrics";
import type { LensCardData, HeatmapData } from "../components/LensCard";
import type { DlaCardData, DlaData } from "../components/DlaCard";
import type { AttributionCardData, AttributionData } from "../components/AttributionCard";
import type { ActivationCardData, ActivationPatchResult } from "../components/ActivationCard";
import type { SteeringCardData, SteeringResult } from "../components/SteeringCard";
import type { AttentionCardData, AttentionData } from "../components/AttentionCard";
import type { AnyCard, CanvasState } from "../components/SandboxCanvas";
import TutorialWelcomeModal from "./TutorialWelcomeModal";
import { explainSectionsByCardType } from "./explain-content";
import type { TutorialStep } from "./steps";
import rawTutorialData from "./data.json";

type Props = { steps: TutorialStep[] };

type State = { cards: AnyCard[]; canvas: CanvasState };
type Action =
  | { type: "MOVE_CARD"; id: string; pos: { x: number; y: number } }
  | { type: "SET_CANVAS"; canvas: CanvasState };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "MOVE_CARD":  return { ...state, cards: state.cards.map(c => c.id === action.id ? { ...c, position: action.pos } : c) };
    case "SET_CANVAS": return { ...state, canvas: action.canvas };
    default:           return state;
  }
}

const dataReady = (rawTutorialData as { _ready?: boolean })._ready !== false;
const tutorialData = (rawTutorialData as { steps: Record<string, unknown> }).steps;

/**
 * Builds one demo card from a data.json entry. Activation's target and
 * contrastive tokens are read off the attribution card built earlier in the
 * same pass, since there's exactly one attribution card in the demo and its
 * fields aren't duplicated in data.json's own activation entry.
 */
function createCardFromData(dataKey: string, cardsSoFar: AnyCard[]): AnyCard | null {
  const raw = tutorialData[dataKey] as Record<string, unknown>;
  if (!raw || !raw.data) return null;

  const id = `tutorial-${dataKey}`;
  const base = {
    id,
    status: "result" as const,
    modelName: raw.modelName as string,
    position: raw.position as { x: number; y: number },
    gpuTier: raw.gpuTier as string,
    error: null,
  };

  switch (raw.cardType) {
    case "logit-lens":
      return {
        ...base, cardType: "logit-lens" as const,
        prompt: raw.prompt as string, data: raw.data as HeatmapData,
      } as LensCardData;
    case "attention-pattern":
      return {
        ...base, cardType: "attention-pattern" as const,
        prompt: raw.prompt as string, data: raw.data as AttentionData,
      } as AttentionCardData;
    case "dla":
      return {
        ...base, cardType: "dla" as const,
        prompt: raw.prompt as string,
        targetPosition: raw.targetPosition as number | "last",
        targetToken: raw.targetToken as string | null,
        contrastiveToken: raw.contrastiveToken as string | null,
        data: raw.data as DlaData,
      } as DlaCardData;
    case "attribution":
      return {
        ...base, cardType: "attribution" as const,
        cleanPrompt: raw.cleanPrompt as string,
        corruptedPrompt: raw.corruptedPrompt as string,
        targetPosition: raw.targetPosition as number | "last",
        targetToken: raw.targetToken as string | null,
        contrastiveToken: raw.contrastiveToken as string | null,
        verifyStatus: "done" as const,
        data: raw.data as AttributionData,
      } as AttributionCardData;
    case "activation": {
      const parent = cardsSoFar.find(c => c.cardType === "attribution");
      const parentData = parent?.cardType === "attribution" ? parent.data : null;
      return {
        ...base, cardType: "activation" as const,
        cleanPrompt: raw.cleanPrompt as string,
        k: raw.k as number,
        parentAttributionId: raw.parentAttributionId as string,
        targetToken: parentData?.target_token ?? null,
        contrastiveToken: parentData?.contrastive_token ?? null,
        data: raw.data as ActivationPatchResult,
      } as ActivationCardData;
    }
    case "steering":
      return {
        ...base, cardType: "steering" as const,
        cleanPrompt: raw.cleanPrompt as string,
        corruptedPrompt: raw.corruptedPrompt as string,
        generationPrompt: raw.generationPrompt as string | undefined,
        targetPosition: "last" as const,
        targetToken: null,
        components: raw.components as SteeringCardData["components"],
        alpha: raw.alpha as number,
        temperature: raw.temperature as number,
        repetitionPenalty: raw.repetitionPenalty as number,
        nTokens: raw.nTokens as number,
        nPairs: raw.nPairs as number,
        data: raw.data as SteeringResult,
      } as SteeringCardData;
    default:
      return null;
  }
}

/**
 * All 8 demo cards (steps "0"-"5" plus steering variants "5b"/"5c"), built at
 * once from their stored positions with no step gating. `Object.keys` on this
 * JSON object yields "0".."5" in numeric order before "5b"/"5c", which puts
 * attribution ("3") before activation ("4") as required: activation reads
 * its target token off the already-built attribution card.
 */
function buildInitialCards(): AnyCard[] {
  return Object.keys(tutorialData).reduce<AnyCard[]>((acc, key) => {
    const card = createCardFromData(key, acc);
    return card ? [...acc, card] : acc;
  }, []);
}

export default function TutorialClient({ steps }: Props) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    cards: buildInitialCards(),
    canvas: { panOffset: { x: 0, y: 0 }, zoom: 1 },
  }));
  const [showWelcome, setShowWelcome] = useState(true);

  const explainContent = useMemo(() => explainSectionsByCardType(steps), [steps]);

  // Dev-only: Alt+P logs each card's current on-screen position as JSON, for
  // hand-arranging the layout (drag cards, then paste the coordinates into
  // data.json's `position` fields). Not wired to anything in production.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "p") {
        const dump = Object.fromEntries(state.cards.map(c => [c.id, c.position]));
        console.log(JSON.stringify(dump, null, 2));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.cards]);

  if (!dataReady) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center text-[13px] leading-[1.7] text-muted">
            <p>Demo data not yet generated.</p>
            <p>Run <code className="rounded-[3px] bg-surface-border px-1.5 py-px">python scripts/generate_tutorial_data.py</code> to populate it.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />

      {showWelcome && <TutorialWelcomeModal onStart={() => setShowWelcome(false)} />}

      <div className="relative flex flex-1 flex-col">
        {/* Grayed-out, non-interactive preview of the real /projects top bar.
            Shows what the real tool's chrome looks like without it doing
            anything. */}
        <div className="absolute left-3 top-3 z-[35] flex gap-2">
          <TactileButton
            variant="primary"
            disabled
            style={TOP_BAR_PAD}
            faceClassName={cn("gap-1.5 cursor-default opacity-45", TOP_BAR_FACE_CLS)}
          >
            <span className="-mt-px text-base leading-none">+</span>
            Add
          </TactileButton>
          <TactileButton
            variant="ghost"
            disabled
            style={TOP_BAR_PAD}
            faceClassName={cn("cursor-default opacity-45", TOP_BAR_FACE_CLS)}
          >
            Projects
          </TactileButton>
        </div>

        <SandboxCanvas
          cards={state.cards}
          canvasState={state.canvas}
          onCanvasChange={canvas => dispatch({ type: "SET_CANVAS", canvas })}
          onMoveCard={(id, pos) => dispatch({ type: "MOVE_CARD", id, pos })}
          onRemoveCard={() => {}}
          onVerifyTopK={() => {}}
          onRerunSteering={() => {}}
          explainContent={explainContent}
          tutorialMode
        />
      </div>
    </div>
  );
}
