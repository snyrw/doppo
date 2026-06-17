import { useCallback } from "react";
import type { Dispatch, RefObject } from "react";
import { updateProject } from "@/app/actions";
import { findSpawnPos, serializeCard } from "../helpers";
import { runJob } from "./job-runner";
import type { AppAction, AppState } from "../types";
import type { AttributionCardData } from "@/app/components/AttributionCard";
import type { ActivationCardData } from "@/app/components/ActivationCard";
import type { SteeringCardData, SteeringResult, SteeringComponent } from "@/app/components/SteeringCard";

type Deps = {
  dispatch: Dispatch<AppAction>;
  stateRef: RefObject<AppState>;
  ensureProject: () => Promise<string>;
};

/** Maps a steering card's fields to the spawn-steering request body. */
function spawnBody(card: SteeringCardData, alpha: number) {
  return {
    cleanPrompt: card.cleanPrompt, corruptedPrompt: card.corruptedPrompt,
    generationPrompt: card.generationPrompt, modelName: card.modelName, gpuTier: card.gpuTier,
    targetPosition: card.targetPosition, components: card.components, alpha,
    nTokens: card.nTokens, temperature: card.temperature, repetitionPenalty: card.repetitionPenalty,
    extraPairs: card.extraPairs?.length ? card.extraPairs : null,
  };
}

export function useSteeringHandlers({ dispatch, stateRef, ensureProject }: Deps) {
  // stateRef lags the dispatch that created/re-ran the card, so the resolved
  // card is substituted explicitly instead of relying on the snapshot. ensureProject
  // lazily materializes the draft row on this first save (awaited so the row
  // exists before the UPDATE writes the card).
  const persist = useCallback(async (cardId: string, serialized: ReturnType<typeof serializeCard>) => {
    const pid = await ensureProject();
    const others = stateRef.current.lensCards.filter(c => c.status === "result" && c.id !== cardId).map(serializeCard);
    updateProject(pid, [...others, serialized], stateRef.current.canvas).catch(console.error);
  }, [ensureProject, stateRef]);

  const runSteeringJob = useCallback((card: SteeringCardData, alpha: number) => {
    void runJob({
      endpoint: "/api/job/spawn-steering",
      body: spawnBody(card, alpha),
      cardId: card.id, startedAt: card.startedAt ?? Date.now(), dispatch,
      finalStage: "Generating steered text…",
      onResolve: (data) => {
        dispatch({ type: "CARD_RESOLVED", id: card.id, cardType: "steering", data: data as SteeringResult });
        persist(card.id, serializeCard({ ...card, status: "result", alpha, data: data as SteeringResult, error: null }));
      },
    });
  }, [dispatch, persist]);

  const steerComponents = useCallback((sourceCardId: string, components: SteeringComponent[]) => {
    const sourceCard = stateRef.current.lensCards.find(c => c.id === sourceCardId);
    if (!sourceCard) return;
    let cleanPrompt: string, corruptedPrompt: string, targetPosition: number | "last",
        targetToken: string | null, modelName: string, gpuTier: string | undefined;
    if (sourceCard.cardType === "attribution") {
      ({ cleanPrompt, corruptedPrompt, targetPosition, targetToken, modelName, gpuTier } = sourceCard);
    } else if (sourceCard.cardType === "activation") {
      const parentAttr = stateRef.current.lensCards.find(
        c => c.id === (sourceCard as ActivationCardData).parentAttributionId && c.cardType === "attribution"
      ) as AttributionCardData | undefined;
      if (!parentAttr) return;
      cleanPrompt = sourceCard.cleanPrompt;
      corruptedPrompt = parentAttr.corruptedPrompt;
      targetPosition = parentAttr.targetPosition;
      targetToken = parentAttr.targetToken;
      modelName = sourceCard.modelName;
      gpuTier = sourceCard.gpuTier;
    } else { return; }

    const card: SteeringCardData = {
      id: crypto.randomUUID(), cardType: "steering", status: "loading", modelName,
      cleanPrompt, corruptedPrompt, generationPrompt: undefined,
      targetPosition, targetToken, components,
      alpha: 1.0, temperature: 1.0, repetitionPenalty: 1.3, nTokens: 100, nPairs: 1, extraPairs: [],
      parentCardId: sourceCardId, data: null, error: null,
      position: { x: sourceCard.position.x + 440, y: sourceCard.position.y },
      gpuTier, startedAt: Date.now(),
    };
    dispatch({ type: "ADD_CARD", card });
    runSteeringJob(card, 1.0);
  }, [dispatch, runSteeringJob, stateRef]);

  const rerunSteering = useCallback((cardId: string, newAlpha: number) => {
    const card = stateRef.current.lensCards.find(c => c.id === cardId && c.cardType === "steering") as SteeringCardData | undefined;
    if (!card || card.status === "loading") return;
    dispatch({ type: "STEERING_CARD_RERUN", id: cardId, alpha: newAlpha });
    runSteeringJob({ ...card, startedAt: Date.now() }, newAlpha);
  }, [dispatch, runSteeringJob, stateRef]);

  const addStandaloneSteer = useCallback(({ modelName, cleanPrompt, corruptedPrompt, generationPrompt, gpuTier, targetPosition, injectionLayer, extraPairs, temperature, repetitionPenalty }: {
    modelName: string; cleanPrompt: string; corruptedPrompt: string; generationPrompt: string;
    gpuTier?: string; targetPosition: number | "last"; injectionLayer: number;
    extraPairs?: Array<{ clean: string; corrupted: string }>;
    temperature: number; repetitionPenalty: number;
  }) => {
    const components: SteeringComponent[] = [{ layer: injectionLayer, head: null, injectionType: "residual" }];
    const card: SteeringCardData = {
      id: crypto.randomUUID(), cardType: "steering", status: "loading", modelName,
      cleanPrompt, corruptedPrompt, generationPrompt, targetPosition, targetToken: null,
      components, alpha: 1.0, temperature, repetitionPenalty, nTokens: 100,
      nPairs: 1 + (extraPairs?.length ?? 0),
      extraPairs: extraPairs ?? [], parentCardId: "", data: null, error: null,
      position: findSpawnPos(stateRef.current.lensCards),
      gpuTier, startedAt: Date.now(),
    };
    dispatch({ type: "ADD_CARD", card });
    runSteeringJob(card, 1.0);
  }, [dispatch, runSteeringJob, stateRef]);

  return { steerComponents, rerunSteering, addStandaloneSteer };
}
