"use client";

import { useReducer, useRef, useCallback, useState, useEffect } from "react";
import SandboxCanvas from "../components/SandboxCanvas";
import ConfigPane from "../components/ConfigPane";
import DlaConfigPane from "../components/DlaConfigPane";
import AttributionConfigPane from "../components/AttributionConfigPane";
import SteeringConfigPane from "../components/SteeringConfigPane";
import AttentionConfigPane from "../components/AttentionConfigPane";
import Navbar from "../components/Navbar";
import type { LensCardData, HeatmapData } from "../components/LensCard";
import type { DlaCardData, DlaData } from "../components/DlaCard";
import type { AttributionCardData, AttributionData } from "../components/AttributionCard";
import type { ActivationCardData, ActivationPatchResult } from "../components/ActivationCard";
import type { SteeringCardData, SteeringResult } from "../components/SteeringCard";
import type { AttentionCardData, AttentionData } from "../components/AttentionCard";
import type { AnyCard } from "../components/SandboxCanvas";
import TutorialDrawer from "./TutorialDrawer";
import TutorialWelcomeModal from "./TutorialWelcomeModal";
import TutorialCompleteModal from "./TutorialCompleteModal";
import { TUTORIAL_CONFIGS } from "./steps";
import type { TutorialStep } from "./steps";

type Props = { steps: TutorialStep[] };
import rawTutorialData from "./data.json";

type CanvasState = { panOffset: { x: number; y: number }; zoom: number };
type State = { cards: AnyCard[]; canvas: CanvasState };
type Action =
  | { type: "ADD_CARD"; card: AnyCard }
  | { type: "MOVE_CARD"; id: string; pos: { x: number; y: number } }
  | { type: "SET_CANVAS"; canvas: CanvasState };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD_CARD":   return { ...state, cards: [...state.cards, action.card] };
    case "MOVE_CARD":  return { ...state, cards: state.cards.map(c => c.id === action.id ? { ...c, position: action.pos } : c) };
    case "SET_CANVAS": return { ...state, canvas: action.canvas };
    default:           return state;
  }
}

const INITIAL_STATE: State = {
  cards: [],
  canvas: { panOffset: { x: 0, y: 0 }, zoom: 1 },
};

const WELCOME_KEY = "doppo_tutorial_welcome_seen";
const DRAWER_KEY  = "doppo_tutorial_drawer_open";

export default function TutorialClient({ steps }: Props) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [phase, setPhase] = useState<"welcome" | "active" | "complete" | null>("welcome");
  const [currentStep, setCurrentStep]       = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [drawerOpen, setDrawerOpen]         = useState(true);

  const [openPane, setOpenPane] = useState<"lens" | "dla" | "attribution" | "attention" | "steering" | "activation" | null>(null);
  const [addDropdownOpen, setAddDropdownOpen] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DRAWER_KEY);
      if (stored !== null) setDrawerOpen(stored === "true");
      // if (localStorage.getItem(WELCOME_KEY)) setPhase("active");
    } catch {}
  }, []);

  const handleToggleDrawer = useCallback(() => {
    setDrawerOpen(o => {
      try { localStorage.setItem(DRAWER_KEY, String(!o)); } catch {}
      return !o;
    });
  }, []);

  useEffect(() => {
    if (!addDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (addRef.current && !addRef.current.contains(e.target as Node)) {
        setAddDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [addDropdownOpen]);

  const dataReady = (rawTutorialData as { _ready?: boolean })._ready !== false;
  const tutorialData = (rawTutorialData as { steps: Record<string, unknown> }).steps;

  function panToPosition(position: { x: number; y: number }) {
    const viewW = window.innerWidth - (drawerOpen ? 360 : 0);
    const viewH = window.innerHeight - 50;
    dispatch({
      type: "SET_CANVAS",
      canvas: {
        panOffset: {
          x: viewW / 2 - (position.x + 240),
          y: viewH / 2 - (position.y + 180),
        },
        zoom: 1,
      },
    });
  }

  function advanceStep(stepIndex: number) {
    setCompletedSteps(prev => new Set([...prev, stepIndex]));
    if (stepIndex === 6) {
      setPhase("complete");
    } else {
      setCurrentStep(stepIndex + 1);
    }
  }

  function createCardFromData(stepIndex: number | string): AnyCard | null {
    const dataKey = typeof stepIndex === "string" ? stepIndex : String(Number(stepIndex) - 1);
    const raw = tutorialData[dataKey] as Record<string, unknown>;
    if (!raw || !raw.data) return null;

    const id = `tutorial-${stepIndex}`;
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
          ...base,
          cardType: "logit-lens" as const,
          prompt: raw.prompt as string,
          data: raw.data as HeatmapData,
        } as LensCardData;
      case "attention-pattern":
        return {
          ...base,
          cardType: "attention-pattern" as const,
          prompt: raw.prompt as string,
          data: raw.data as AttentionData,
        } as AttentionCardData;
      case "dla":
        return {
          ...base,
          cardType: "dla" as const,
          prompt: raw.prompt as string,
          targetPosition: raw.targetPosition as number | "last",
          targetToken: raw.targetToken as string | null,
          contrastiveToken: raw.contrastiveToken as string | null,
          data: raw.data as DlaData,
        } as DlaCardData;
      case "attribution":
        return {
          ...base,
          cardType: "attribution" as const,
          cleanPrompt: raw.cleanPrompt as string,
          corruptedPrompt: raw.corruptedPrompt as string,
          targetPosition: raw.targetPosition as number | "last",
          targetToken: raw.targetToken as string | null,
          contrastiveToken: raw.contrastiveToken as string | null,
          verifyStatus: "idle" as const,
          data: raw.data as AttributionData,
        } as AttributionCardData;
      case "activation":
        return {
          ...base,
          cardType: "activation" as const,
          cleanPrompt: raw.cleanPrompt as string,
          k: raw.k as number,
          parentAttributionId: raw.parentAttributionId as string,
          data: raw.data as ActivationPatchResult,
        } as ActivationCardData;
      case "steering":
        return {
          ...base,
          cardType: "steering" as const,
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
          parentCardId: "",
          data: raw.data as SteeringResult,
        } as SteeringCardData;
      default:
        return null;
    }
  }

  function handleSteeringRun() {
    const card1 = createCardFromData(6);
    const card2 = createCardFromData("5b");
    const card3 = createCardFromData("5c");
    if (!card1) return;
    dispatch({ type: "ADD_CARD", card: card1 });
    if (card2) {
      card2.position = { x: card1.position.x + 500, y: card1.position.y };
      dispatch({ type: "ADD_CARD", card: card2 });
    }
    if (card3) {
      card3.position = { x: card1.position.x + 1000, y: card1.position.y };
      dispatch({ type: "ADD_CARD", card: card3 });
    }
    panToPosition(card1.position);
    setOpenPane(null);
    setAddDropdownOpen(false);
    setTimeout(() => advanceStep(6), 300);
  }

  function handleTutorialRun(stepIndex: number) {
    const card = createCardFromData(stepIndex);
    if (!card) return;
    dispatch({ type: "ADD_CARD", card });
    panToPosition(card.position);
    setOpenPane(null);
    setAddDropdownOpen(false);
    setTimeout(() => advanceStep(stepIndex), 300);
  }

  function handleVerifyTopK(attributionCardId: string, _k: number) {
    // In tutorial mode there's no live GPU call — add the pre-computed activation card.
    if (completedSteps.has(5)) return;
    const activationCard = createCardFromData(5);
    if (!activationCard) return;
    const attrCard = state.cards.find(c => c.id === attributionCardId);
    if (attrCard) {
      activationCard.position = { x: attrCard.position.x + 420, y: attrCard.position.y };
    }
    dispatch({ type: "ADD_CARD", card: activationCard });
    setTimeout(() => advanceStep(5), 300);
  }

  const stepToPaneType: Record<number, typeof openPane> = {
    1: "lens",
    2: "attention",
    3: "dla",
    4: "attribution",
    5: "activation",
    6: "steering",
  };

  const TECHNIQUE_LABELS: Record<number, string> = {
    1: "Logit Lens",
    2: "Attention Patterns",
    3: "Direct Logit Attribution",
    4: "Attribution Patching",
    5: "Activation Patching",
    6: "Steering",
  };

  if (!dataReady) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--color-bg)" }}>
        <Navbar />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", fontFamily: "var(--font-ibm-plex-sans), sans-serif", color: "var(--color-text-muted)", fontSize: 13, lineHeight: 1.7 }}>
            <p>Tutorial data not yet generated.</p>
            <p>Run <code style={{ background: "var(--color-surface-border)", padding: "1px 6px", borderRadius: 3 }}>python scripts/generate_tutorial_data.py</code> to populate it.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--color-bg)" }}>
      <Navbar />

      {phase === "welcome" && (
        <TutorialWelcomeModal
          onStart={() => {
            setPhase("active");
            try { localStorage.setItem(WELCOME_KEY, "1"); } catch {}
          }}
        />
      )}

      {phase === "complete" && (
        <TutorialCompleteModal onDismiss={() => setPhase("active")} />
      )}

      <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column" }}>
        <div ref={addRef} style={{ position: "absolute", top: 12, left: 12, zIndex: 35 }}>
          <button
            onClick={() => setAddDropdownOpen(o => !o)}
            style={{
              background: "var(--color-accent)", color: "var(--color-accent-fg)", border: "none",
              borderRadius: 6, padding: "5px 10px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6, letterSpacing: "0.01em",
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1, marginTop: -1 }}>+</span>
            Add
          </button>

          {addDropdownOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, background: "var(--color-card)",
              border: "1px solid var(--color-card-border)", borderRadius: 8,
              boxShadow: "0 4px 16px rgba(0,0,0,0.12)", overflow: "hidden", minWidth: 200, zIndex: 40,
            }}>
              {[1, 2, 3, 4, 6].map((i, listIdx) => {
                const isEnabled = i === 6
                  ? currentStep === 6 && !completedSteps.has(6)
                  : i === currentStep && !completedSteps.has(i);
                return (
                  <button
                    key={i}
                    onClick={() => {
                      if (!isEnabled) return;
                      const pane = stepToPaneType[i];
                      setOpenPane(pane);
                      setAddDropdownOpen(false);
                    }}
                    disabled={!isEnabled}
                    style={{
                      display: "block", width: "100%", padding: "10px 16px", textAlign: "left",
                      background: "var(--color-card)", border: "none",
                      borderBottom: listIdx < 4 ? "1px solid var(--color-surface-border)" : "none",
                      fontSize: 13, fontWeight: 500, cursor: isEnabled ? "pointer" : "default",
                      color: isEnabled ? "var(--color-text)" : "var(--color-text-muted)",
                      opacity: isEnabled ? 1 : 0.45,
                      transition: "background 120ms",
                    }}
                  >
                    {TECHNIQUE_LABELS[i]}
                  </button>
                );
              })}
            </div>
          )}

          <ConfigPane
            isOpen={openPane === "lens"}
            availableModels={[]}
            modelsLoading={false}
            onSubmit={(_config) => handleTutorialRun(1)}
            onClose={() => setOpenPane(null)}
            tutorialMode
            tutorialConfig={TUTORIAL_CONFIGS.lens}
          />
          <AttentionConfigPane
            isOpen={openPane === "attention"}
            availableModels={[]}
            modelsLoading={false}
            onSubmit={(_config) => handleTutorialRun(2)}
            onClose={() => setOpenPane(null)}
            tutorialMode
            tutorialConfig={TUTORIAL_CONFIGS.attention}
          />
          <DlaConfigPane
            isOpen={openPane === "dla"}
            availableModels={[]}
            modelsLoading={false}
            onSubmit={(_config) => handleTutorialRun(3)}
            onClose={() => setOpenPane(null)}
            tutorialMode
            tutorialConfig={TUTORIAL_CONFIGS.dla}
          />
          <AttributionConfigPane
            isOpen={openPane === "attribution"}
            availableModels={[]}
            modelsLoading={false}
            onSubmit={(_config) => handleTutorialRun(4)}
            onClose={() => setOpenPane(null)}
            tutorialMode
            tutorialConfig={TUTORIAL_CONFIGS.attribution}
          />
          {/* Activation step reuses AttributionConfigPane — the extra `k` field is not
              part of that pane's tutorialConfig type, so we cast via unknown. */}
          <AttributionConfigPane
            isOpen={openPane === "activation"}
            availableModels={[]}
            modelsLoading={false}
            onSubmit={(_config) => handleTutorialRun(5)}
            onClose={() => setOpenPane(null)}
            tutorialMode
            tutorialConfig={TUTORIAL_CONFIGS.activation as unknown as {
              modelName: string;
              cleanPrompt: string;
              corruptedPrompt: string;
              gpuTier: string;
              targetPosition: number | "last";
              targetToken: string | null;
              contrastiveToken: string | null;
            }}
          />
          <SteeringConfigPane
            isOpen={openPane === "steering"}
            availableModels={[]}
            modelsLoading={false}
            onSubmit={(_config) => handleSteeringRun()}
            onClose={() => setOpenPane(null)}
            tutorialMode
            tutorialConfig={{
              ...TUTORIAL_CONFIGS.steering,
              extraPairs: (tutorialData["5"] as Record<string, unknown>)?.extraPairs as Array<{ clean: string; corrupted: string }> | undefined,
            }}
          />
        </div>

        <SandboxCanvas
          cards={state.cards}
          canvasState={state.canvas}
          onCanvasChange={canvas => dispatch({ type: "SET_CANVAS", canvas })}
          onMoveCard={(id, pos) => dispatch({ type: "MOVE_CARD", id, pos })}
          onRemoveCard={() => {}}
          onVerifyTopK={handleVerifyTopK}
          onSteerComponents={() => {}}
          onRerunSteering={() => {}}
          onSpawnEntropyCard={() => {}}
          tutorialMode
        />
      </div>

      <TutorialDrawer
        steps={steps}
        isOpen={drawerOpen}
        onToggle={handleToggleDrawer}
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepSelect={() => {}}
        onContinueIntro={() => advanceStep(0)}
      />
    </div>
  );
}
