import { useCallback, startTransition } from "react";
import type { Dispatch, RefObject } from "react";
import { readSSEStream } from "@/app/lib/stream-sse";
import { updateProject } from "@/app/actions";
import { autoArrangePos, serializeCard } from "../helpers";
import type { AppAction, AppState } from "../types";
import type { AttributionCardData } from "@/app/components/AttributionCard";
import type { ActivationCardData } from "@/app/components/ActivationCard";
import type { SteeringCardData, SteeringResult, SteeringComponent } from "@/app/components/SteeringCard";

type Deps = {
  dispatch: Dispatch<AppAction>;
  projectIdRef: RefObject<string | null>;
  stateRef: RefObject<AppState>;
};

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
    const steeringCard: SteeringCardData = {
      id: steeringId, cardType: "steering", status: "loading", modelName,
      cleanPrompt, corruptedPrompt, generationPrompt: undefined,
      targetPosition, targetToken, components,
      alpha: 1.0, temperature: 1.0, repetitionPenalty: 1.3, nTokens: 50, nPairs: 1, extraPairs: [],
      parentCardId: sourceCardId, data: null, error: null,
      position: { x: sourceCard.position.x + 440, y: sourceCard.position.y },
      gpuTier, startedAt: Date.now(),
    };
    dispatch({ type: "ADD_CARD", card: steeringCard });
    fetch("/api/run-steering", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cleanPrompt, corruptedPrompt, modelName, gpuTier, targetPosition, components, alpha: 1.0, nTokens: 50, temperature: 1.0, repetitionPenalty: 1.3 }),
    })
      .then(async (response) => {
        if (!response.ok || !response.body) {
          const err = await response.json().catch(() => ({})) as { error?: string; detail?: string };
          const message = response.status === 401 ? (err.error ?? "Sign in to use medium and large models") : (err.detail ?? err.error ?? `Request failed (${response.status})`);
          dispatch({ type: "CARD_ERRORED", id: steeringId, error: message });
          return;
        }
        for await (const event of readSSEStream(response)) {
          const evData = event.data as (SteeringResult & { token?: string; index?: number }) | undefined;
          if (event.stage === "token" && evData?.token !== undefined) {
            startTransition(() => dispatch({ type: "STEERING_CARD_TOKEN", id: steeringId, token: evData.token! }));
          } else if (event.stage === "done" && evData) {
            dispatch({ type: "STEERING_CARD_RESOLVED", id: steeringId, data: evData as SteeringResult });
            const pid = projectIdRef.current;
            if (pid) {
              const existing = stateRef.current.lensCards.filter(c => c.status === "result").map(serializeCard);
              updateProject(pid, [...existing, { id: steeringId, cardType: "steering" as const, modelName, prompt: cleanPrompt, corruptedPrompt, data: evData as Record<string, unknown>, position: steeringCard.position, gpuTier, targetPosition, targetToken, components, alpha: 1.0, temperature: 1.0, repetitionPenalty: 1.3, nTokens: 50, nPairs: 1, extraPairs: [], parentCardId: sourceCardId }], stateRef.current.canvas).catch(console.error);
            }
          } else if (event.stage === "error") {
            dispatch({ type: "CARD_ERRORED", id: steeringId, error: event.error ?? "Unknown error" });
          } else {
            dispatch({ type: "CARD_STAGE", id: steeringId, stage: event.stage });
          }
        }
      })
      .catch(err => dispatch({ type: "CARD_ERRORED", id: steeringId, error: err instanceof Error ? err.message : "Unknown error" }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, projectIdRef, stateRef]);

  const rerunSteering = useCallback((cardId: string, newAlpha: number) => {
    const card = stateRef.current.lensCards.find(c => c.id === cardId && c.cardType === "steering") as SteeringCardData | undefined;
    if (!card || card.status === "loading") return;
    dispatch({ type: "STEERING_CARD_RERUN", id: cardId, alpha: newAlpha });
    const { modelName, cleanPrompt, corruptedPrompt, generationPrompt, gpuTier, targetPosition, components, temperature, repetitionPenalty, extraPairs } = card;
    fetch("/api/run-steering", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cleanPrompt, corruptedPrompt, generationPrompt, modelName, gpuTier, targetPosition, components, alpha: newAlpha, nTokens: card.nTokens, temperature, repetitionPenalty, extraPairs: extraPairs?.length ? extraPairs : null }),
    })
      .then(async (response) => {
        if (!response.ok || !response.body) {
          const err = await response.json().catch(() => ({})) as { error?: string; detail?: string };
          const message = response.status === 401 ? (err.error ?? "Sign in to use medium and large models") : (err.detail ?? err.error ?? `Request failed (${response.status})`);
          dispatch({ type: "CARD_ERRORED", id: cardId, error: message });
          return;
        }
        for await (const event of readSSEStream(response)) {
          const evData = event.data as (SteeringResult & { token?: string }) | undefined;
          if (event.stage === "token" && evData?.token !== undefined) {
            startTransition(() => dispatch({ type: "STEERING_CARD_TOKEN", id: cardId, token: evData.token! }));
          } else if (event.stage === "done" && evData) {
            dispatch({ type: "STEERING_CARD_RESOLVED", id: cardId, data: evData as SteeringResult });
            const pid = projectIdRef.current;
            if (pid) {
              const updated = stateRef.current.lensCards.filter(c => c.status === "result").map(serializeCard);
              updateProject(pid, updated, stateRef.current.canvas).catch(console.error);
            }
          } else if (event.stage === "error") {
            dispatch({ type: "CARD_ERRORED", id: cardId, error: event.error ?? "Unknown error" });
          } else {
            dispatch({ type: "CARD_STAGE", id: cardId, stage: event.stage });
          }
        }
      })
      .catch(err => dispatch({ type: "CARD_ERRORED", id: cardId, error: err instanceof Error ? err.message : "Unknown error" }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const steeringCard: SteeringCardData = {
      id: steeringId, cardType: "steering", status: "loading", modelName,
      cleanPrompt, corruptedPrompt, generationPrompt, targetPosition, targetToken: null,
      components, alpha: 1.0, temperature, repetitionPenalty, nTokens: 50, nPairs,
      extraPairs: extraPairs ?? [], parentCardId: "", data: null, error: null,
      position: autoArrangePos(stateRef.current.lensCards.length),
      gpuTier, startedAt: Date.now(),
    };
    dispatch({ type: "ADD_CARD", card: steeringCard });
    fetch("/api/run-steering", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cleanPrompt, corruptedPrompt, generationPrompt, modelName, gpuTier, targetPosition, components, alpha: 1.0, nTokens: 50, extraPairs: extraPairs ?? null, temperature, repetitionPenalty }),
    })
      .then(async (response) => {
        if (!response.ok || !response.body) {
          const err = await response.json().catch(() => ({})) as { error?: string; detail?: string };
          const message = response.status === 401 ? (err.error ?? "Sign in to use medium and large models") : (err.detail ?? err.error ?? `Request failed (${response.status})`);
          dispatch({ type: "CARD_ERRORED", id: steeringId, error: message });
          return;
        }
        for await (const event of readSSEStream(response)) {
          const evData = event.data as (SteeringResult & { token?: string; index?: number }) | undefined;
          if (event.stage === "token" && evData?.token !== undefined) {
            startTransition(() => dispatch({ type: "STEERING_CARD_TOKEN", id: steeringId, token: evData.token! }));
          } else if (event.stage === "done" && evData) {
            dispatch({ type: "STEERING_CARD_RESOLVED", id: steeringId, data: evData as SteeringResult });
            const pid = projectIdRef.current;
            if (pid) {
              const existing = stateRef.current.lensCards.filter(c => c.status === "result").map(serializeCard);
              updateProject(pid, [...existing, { id: steeringId, cardType: "steering" as const, modelName, prompt: cleanPrompt, corruptedPrompt, generationPrompt, data: evData as Record<string, unknown>, position: steeringCard.position, gpuTier, targetPosition, targetToken: null, components, alpha: 1.0, temperature, repetitionPenalty, nTokens: 50, nPairs, extraPairs: extraPairs ?? [], parentCardId: "" }], stateRef.current.canvas).catch(console.error);
            }
          } else if (event.stage === "error") {
            dispatch({ type: "CARD_ERRORED", id: steeringId, error: event.error ?? "Unknown error" });
          } else {
            dispatch({ type: "CARD_STAGE", id: steeringId, stage: event.stage });
          }
        }
      })
      .catch(err => dispatch({ type: "CARD_ERRORED", id: steeringId, error: err instanceof Error ? err.message : "Unknown error" }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, projectIdRef, stateRef]);

  return { steerComponents, rerunSteering, addStandaloneSteer };
}
