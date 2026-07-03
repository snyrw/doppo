import { useCallback } from "react";
import type { Dispatch, RefObject } from "react";
import { updateProject } from "@/app/actions";
import { findSpawnPos, serializeCard } from "../helpers";
import { runJob } from "./job-runner";
import type { AppAction, AppState } from "../types";
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
      onResolve: (data) => {
        dispatch({ type: "CARD_RESOLVED", id: card.id, cardType: "steering", data: data as SteeringResult });
        persist(card.id, serializeCard({ ...card, status: "result", alpha, data: data as SteeringResult, error: null }));
      },
    });
  }, [dispatch, persist]);

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
      extraPairs: extraPairs ?? [], data: null, error: null,
      position: findSpawnPos(stateRef.current.lensCards),
      gpuTier, startedAt: Date.now(),
    };
    dispatch({ type: "ADD_CARD", card });
    runSteeringJob(card, 1.0);
  }, [dispatch, runSteeringJob, stateRef]);

  return { rerunSteering, addStandaloneSteer };
}
