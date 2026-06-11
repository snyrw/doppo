import { useCallback } from "react";
import type { Dispatch, RefObject } from "react";
import { updateProject } from "@/app/actions";
import { findSpawnPos, serializeCard } from "../helpers";
import type { AppAction, AppState } from "../types";
import type { AttributionCardData } from "@/app/components/AttributionCard";
import type { ActivationCardData } from "@/app/components/ActivationCard";
import type { SteeringCardData, SteeringResult, SteeringComponent } from "@/app/components/SteeringCard";

type Deps = {
  dispatch: Dispatch<AppAction>;
  projectIdRef: RefObject<string | null>;
  stateRef: RefObject<AppState>;
};

function handleSpawnError(status: number, err: { error?: string }): { error: string; showBuyCredits?: boolean } {
  if (status === 402) return { error: err.error ?? "Insufficient credits", showBuyCredits: true };
  if (status === 401) return { error: err.error ?? "Sign in to run inference" };
  return { error: err.error ?? `Request failed (${status})` };
}

function heuristicStage(elapsed: number): string {
  if (elapsed < 30_000) return "Connecting to GPU…";
  if (elapsed < 90_000) return "Loading model…";
  return "Generating steered text…";
}

async function pollSteering(
  jobId: string,
  cardId: string,
  startedAt: number,
  dispatch: Dispatch<AppAction>,
  onDone: (data: SteeringResult) => void
): Promise<void> {
  const POLL_INTERVAL_MS = 5000;
  while (true) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    dispatch({ type: "CARD_STAGE", id: cardId, stage: heuristicStage(Date.now() - startedAt) });

    let pollRes: Response;
    try {
      pollRes = await fetch(`/api/job/${jobId}`);
    } catch {
      dispatch({ type: "CARD_ERRORED", id: cardId, error: "Lost connection to server" });
      fetch(`/api/job/${jobId}`, { method: "DELETE" }).catch(() => {});
      return;
    }

    if (!pollRes.ok) {
      dispatch({ type: "CARD_ERRORED", id: cardId, error: `Poll failed (${pollRes.status})` });
      return;
    }

    const result = await pollRes.json() as { status: string; data?: SteeringResult; error?: string };
    if (result.status === "done" && result.data) { onDone(result.data); return; }
    if (result.status === "error") { dispatch({ type: "CARD_ERRORED", id: cardId, error: result.error ?? "Unknown error" }); return; }
  }
}

export function useSteeringHandlers({ dispatch, projectIdRef, stateRef }: Deps) {
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

    const steeringId = crypto.randomUUID();
    const startedAt = Date.now();
    const steeringCard: SteeringCardData = {
      id: steeringId, cardType: "steering", status: "loading", modelName,
      cleanPrompt, corruptedPrompt, generationPrompt: undefined,
      targetPosition, targetToken, components,
      alpha: 1.0, temperature: 1.0, repetitionPenalty: 1.3, nTokens: 100, nPairs: 1, extraPairs: [],
      parentCardId: sourceCardId, data: null, error: null,
      position: { x: sourceCard.position.x + 440, y: sourceCard.position.y },
      gpuTier, startedAt,
    };
    dispatch({ type: "ADD_CARD", card: steeringCard });

    (async () => {
      let spawnRes: Response;
      try {
        spawnRes = await fetch("/api/job/spawn-steering", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cleanPrompt, corruptedPrompt, modelName, gpuTier, targetPosition, components, alpha: 1.0, nTokens: 100, temperature: 1.0, repetitionPenalty: 1.3 }),
        });
      } catch (err) {
        dispatch({ type: "CARD_ERRORED", id: steeringId, error: err instanceof Error ? err.message : "Network error" });
        return;
      }
      if (!spawnRes.ok) {
        const err = await spawnRes.json().catch(() => ({})) as { error?: string };
        dispatch({ type: "CARD_ERRORED", id: steeringId, ...handleSpawnError(spawnRes.status, err) });
        return;
      }
      // stateRef lags the dispatch above, so append the new card explicitly
      const persist = (data: SteeringResult) => {
        const pid = projectIdRef.current;
        if (!pid) return;
        const existing = stateRef.current.lensCards.filter(c => c.status === "result" && c.id !== steeringId).map(serializeCard);
        updateProject(pid, [...existing, { id: steeringId, cardType: "steering" as const, modelName, prompt: cleanPrompt, corruptedPrompt, data: data as unknown as Record<string, unknown>, position: steeringCard.position, gpuTier, targetPosition, targetToken, components, alpha: 1.0, temperature: 1.0, repetitionPenalty: 1.3, nTokens: 100, nPairs: 1, extraPairs: [], parentCardId: sourceCardId }], stateRef.current.canvas).catch(console.error);
      };
      const body = await spawnRes.json() as { status?: string; jobId?: string; data?: SteeringResult };
      if (body.status === "cached" && body.data) {
        dispatch({ type: "STEERING_CARD_RESOLVED", id: steeringId, data: body.data });
        persist(body.data);
        return;
      }
      if (!body.jobId) {
        dispatch({ type: "CARD_ERRORED", id: steeringId, error: "Spawn returned no job ID" });
        return;
      }
      await pollSteering(body.jobId, steeringId, startedAt, dispatch, (data) => {
        dispatch({ type: "STEERING_CARD_RESOLVED", id: steeringId, data });
        window.dispatchEvent(new CustomEvent("credits-updated"));
        persist(data);
      });
    })();
  }, [dispatch, projectIdRef, stateRef]);

  const rerunSteering = useCallback((cardId: string, newAlpha: number) => {
    const card = stateRef.current.lensCards.find(c => c.id === cardId && c.cardType === "steering") as SteeringCardData | undefined;
    if (!card || card.status === "loading") return;
    dispatch({ type: "STEERING_CARD_RERUN", id: cardId, alpha: newAlpha });
    const startedAt = Date.now();
    const { modelName, cleanPrompt, corruptedPrompt, generationPrompt, gpuTier, targetPosition, components, temperature, repetitionPenalty, extraPairs, nTokens } = card;

    (async () => {
      let spawnRes: Response;
      try {
        spawnRes = await fetch("/api/job/spawn-steering", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cleanPrompt, corruptedPrompt, generationPrompt, modelName, gpuTier, targetPosition, components, alpha: newAlpha, nTokens, temperature, repetitionPenalty, extraPairs: extraPairs?.length ? extraPairs : null }),
        });
      } catch (err) {
        dispatch({ type: "CARD_ERRORED", id: cardId, error: err instanceof Error ? err.message : "Network error" });
        return;
      }
      if (!spawnRes.ok) {
        const err = await spawnRes.json().catch(() => ({})) as { error?: string };
        dispatch({ type: "CARD_ERRORED", id: cardId, ...handleSpawnError(spawnRes.status, err) });
        return;
      }
      // stateRef still shows this card as "loading" when the result lands, so a plain
      // result-filter would drop it from the save — substitute the updated card explicitly.
      const persist = (data: SteeringResult) => {
        const pid = projectIdRef.current;
        if (!pid) return;
        const others = stateRef.current.lensCards.filter(c => c.status === "result" && c.id !== cardId).map(serializeCard);
        updateProject(pid, [...others, serializeCard({ ...card, status: "result", alpha: newAlpha, data, error: null })], stateRef.current.canvas).catch(console.error);
      };
      const body = await spawnRes.json() as { status?: string; jobId?: string; data?: SteeringResult };
      if (body.status === "cached" && body.data) {
        dispatch({ type: "STEERING_CARD_RESOLVED", id: cardId, data: body.data });
        persist(body.data);
        return;
      }
      if (!body.jobId) {
        dispatch({ type: "CARD_ERRORED", id: cardId, error: "Spawn returned no job ID" });
        return;
      }
      await pollSteering(body.jobId, cardId, startedAt, dispatch, (data) => {
        dispatch({ type: "STEERING_CARD_RESOLVED", id: cardId, data });
        window.dispatchEvent(new CustomEvent("credits-updated"));
        persist(data);
      });
    })();
  }, [dispatch, projectIdRef, stateRef]);

  const addStandaloneSteer = useCallback(({ modelName, cleanPrompt, corruptedPrompt, generationPrompt, gpuTier, targetPosition, injectionLayer, extraPairs, temperature, repetitionPenalty }: {
    modelName: string; cleanPrompt: string; corruptedPrompt: string; generationPrompt: string;
    gpuTier?: string; targetPosition: number | "last"; injectionLayer: number;
    extraPairs?: Array<{ clean: string; corrupted: string }>;
    temperature: number; repetitionPenalty: number;
  }) => {
    const components: SteeringComponent[] = [{ layer: injectionLayer, head: null, injectionType: "residual" }];
    const nPairs = 1 + (extraPairs?.length ?? 0);
    const steeringId = crypto.randomUUID();
    const startedAt = Date.now();
    const steeringCard: SteeringCardData = {
      id: steeringId, cardType: "steering", status: "loading", modelName,
      cleanPrompt, corruptedPrompt, generationPrompt, targetPosition, targetToken: null,
      components, alpha: 1.0, temperature, repetitionPenalty, nTokens: 100, nPairs,
      extraPairs: extraPairs ?? [], parentCardId: "", data: null, error: null,
      position: findSpawnPos(stateRef.current.lensCards),
      gpuTier, startedAt,
    };
    dispatch({ type: "ADD_CARD", card: steeringCard });

    (async () => {
      let spawnRes: Response;
      try {
        spawnRes = await fetch("/api/job/spawn-steering", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cleanPrompt, corruptedPrompt, generationPrompt, modelName, gpuTier, targetPosition, components, alpha: 1.0, nTokens: 100, extraPairs: extraPairs ?? null, temperature, repetitionPenalty }),
        });
      } catch (err) {
        dispatch({ type: "CARD_ERRORED", id: steeringId, error: err instanceof Error ? err.message : "Network error" });
        return;
      }
      if (!spawnRes.ok) {
        const err = await spawnRes.json().catch(() => ({})) as { error?: string };
        dispatch({ type: "CARD_ERRORED", id: steeringId, ...handleSpawnError(spawnRes.status, err) });
        return;
      }
      const persist = (data: SteeringResult) => {
        const pid = projectIdRef.current;
        if (!pid) return;
        const existing = stateRef.current.lensCards.filter(c => c.status === "result" && c.id !== steeringId).map(serializeCard);
        updateProject(pid, [...existing, { id: steeringId, cardType: "steering" as const, modelName, prompt: cleanPrompt, corruptedPrompt, generationPrompt, data: data as unknown as Record<string, unknown>, position: steeringCard.position, gpuTier, targetPosition, targetToken: null, components, alpha: 1.0, temperature, repetitionPenalty, nTokens: 100, nPairs, extraPairs: extraPairs ?? [], parentCardId: "" }], stateRef.current.canvas).catch(console.error);
      };
      const body = await spawnRes.json() as { status?: string; jobId?: string; data?: SteeringResult };
      if (body.status === "cached" && body.data) {
        dispatch({ type: "STEERING_CARD_RESOLVED", id: steeringId, data: body.data });
        persist(body.data);
        return;
      }
      if (!body.jobId) {
        dispatch({ type: "CARD_ERRORED", id: steeringId, error: "Spawn returned no job ID" });
        return;
      }
      await pollSteering(body.jobId, steeringId, startedAt, dispatch, (data) => {
        dispatch({ type: "STEERING_CARD_RESOLVED", id: steeringId, data });
        window.dispatchEvent(new CustomEvent("credits-updated"));
        persist(data);
      });
    })();
  }, [dispatch, projectIdRef, stateRef]);

  return { steerComponents, rerunSteering, addStandaloneSteer };
}
