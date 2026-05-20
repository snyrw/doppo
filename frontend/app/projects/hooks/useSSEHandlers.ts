import { useCallback } from "react";
import type { Dispatch, RefObject } from "react";
import { readSSEStream } from "@/app/lib/stream-sse";
import { updateProject } from "@/app/actions";
import { autoArrangePos, serializeCard } from "../helpers";
import type { AppAction, AppState, HeatmapData } from "../types";
import type { LensCardData } from "@/app/components/LensCard";
import type { DlaCardData, DlaData } from "@/app/components/DlaCard";
import type { AttributionCardData, AttributionData } from "@/app/components/AttributionCard";
import type { ActivationCardData, ActivationPatchResult } from "@/app/components/ActivationCard";
import type { EntropyCardData } from "@/app/components/EntropyCard";

type Deps = {
  dispatch: Dispatch<AppAction>;
  projectIdRef: RefObject<string | null>;
  stateRef: RefObject<AppState>;
};

function handleFetchError(response: Response, err: { error?: string; detail?: string }): string {
  if (response.status === 401) return err.error ?? "Sign in to use medium and large models";
  return err.detail ?? err.error ?? `Request failed (${response.status})`;
}

export function useSSEHandlers({ dispatch, projectIdRef, stateRef }: Deps) {
  const addLens = useCallback(({ modelName, prompt, gpuTier, topK }: {
    modelName: string; prompt: string; gpuTier?: string; topK: number;
  }) => {
    const id = crypto.randomUUID();
    const card: LensCardData = {
      id, cardType: "logit-lens", status: "loading", modelName, prompt, topK,
      data: null, error: null,
      position: autoArrangePos(stateRef.current.lensCards.length),
      gpuTier, startedAt: Date.now(),
    };
    dispatch({ type: "ADD_CARD", card });
    fetch("/api/run-lens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, modelName, gpuTier, topK }),
    })
      .then(async (response) => {
        if (!response.ok || !response.body) {
          const err = await response.json().catch(() => ({})) as { error?: string; detail?: string };
          dispatch({ type: "CARD_ERRORED", id, error: handleFetchError(response, err) });
          return;
        }
        for await (const event of readSSEStream(response)) {
          if (event.stage === "done" && event.data) {
            const data = event.data as HeatmapData;
            dispatch({ type: "CARD_RESOLVED", id, data });
            const pid = projectIdRef.current;
            if (pid) {
              const existing = stateRef.current.lensCards.filter(c => c.status === "result").map(serializeCard);
              updateProject(pid, [...existing, { id, cardType: "logit-lens" as const, modelName, prompt, topK, data: data as Record<string, unknown>, position: card.position, gpuTier }], stateRef.current.canvas).catch(console.error);
            }
          } else if (event.stage === "error") {
            dispatch({ type: "CARD_ERRORED", id, error: event.error ?? "Unknown error" });
          } else {
            dispatch({ type: "CARD_STAGE", id, stage: event.stage });
          }
        }
      })
      .catch(err => dispatch({ type: "CARD_ERRORED", id, error: err instanceof Error ? err.message : "Unknown error" }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, projectIdRef, stateRef]);

  const addDla = useCallback(({ modelName, prompt, gpuTier, targetPosition, targetToken, contrastiveToken }: {
    modelName: string; prompt: string; gpuTier?: string;
    targetPosition: number | "last"; targetToken: string | null; contrastiveToken: string | null;
  }) => {
    const id = crypto.randomUUID();
    const card: DlaCardData = {
      id, cardType: "dla", status: "loading", modelName, prompt,
      data: null, error: null,
      position: autoArrangePos(stateRef.current.lensCards.length),
      gpuTier, startedAt: Date.now(), targetPosition, targetToken, contrastiveToken,
    };
    dispatch({ type: "ADD_CARD", card });
    fetch("/api/run-dla", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, modelName, gpuTier, targetPosition, targetToken, contrastiveToken }),
    })
      .then(async (response) => {
        if (!response.ok || !response.body) {
          const err = await response.json().catch(() => ({})) as { error?: string; detail?: string };
          dispatch({ type: "CARD_ERRORED", id, error: handleFetchError(response, err) });
          return;
        }
        for await (const event of readSSEStream(response)) {
          if (event.stage === "done" && event.data) {
            const data = event.data as DlaData;
            dispatch({ type: "DLA_CARD_RESOLVED", id, data });
            const pid = projectIdRef.current;
            if (pid) {
              const existing = stateRef.current.lensCards.filter(c => c.status === "result").map(serializeCard);
              updateProject(pid, [...existing, { id, cardType: "dla" as const, modelName, prompt, data: data as Record<string, unknown>, position: card.position, gpuTier, targetPosition, targetToken, contrastiveToken }], stateRef.current.canvas).catch(console.error);
            }
          } else if (event.stage === "error") {
            dispatch({ type: "CARD_ERRORED", id, error: event.error ?? "Unknown error" });
          } else {
            dispatch({ type: "CARD_STAGE", id, stage: event.stage });
          }
        }
      })
      .catch(err => dispatch({ type: "CARD_ERRORED", id, error: err instanceof Error ? err.message : "Unknown error" }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, projectIdRef, stateRef]);

  const addAttribution = useCallback(({ modelName, cleanPrompt, corruptedPrompt, gpuTier, targetPosition, targetToken, contrastiveToken }: {
    modelName: string; cleanPrompt: string; corruptedPrompt: string; gpuTier?: string;
    targetPosition: number | "last"; targetToken: string | null; contrastiveToken: string | null;
  }) => {
    const id = crypto.randomUUID();
    const card: AttributionCardData = {
      id, cardType: "attribution", status: "loading", modelName, cleanPrompt, corruptedPrompt,
      data: null, error: null,
      position: autoArrangePos(stateRef.current.lensCards.length),
      gpuTier, startedAt: Date.now(), targetPosition, targetToken, contrastiveToken, verifyStatus: "idle",
    };
    dispatch({ type: "ADD_CARD", card });
    fetch("/api/run-attribution", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cleanPrompt, corruptedPrompt, modelName, gpuTier, targetPosition, targetToken, contrastiveToken }),
    })
      .then(async (response) => {
        if (!response.ok || !response.body) {
          const err = await response.json().catch(() => ({})) as { error?: string; detail?: string };
          dispatch({ type: "CARD_ERRORED", id, error: handleFetchError(response, err) });
          return;
        }
        for await (const event of readSSEStream(response)) {
          if (event.stage === "done" && event.data) {
            const data = event.data as AttributionData;
            dispatch({ type: "ATTRIBUTION_CARD_RESOLVED", id, data });
            const pid = projectIdRef.current;
            if (pid) {
              const existing = stateRef.current.lensCards.filter(c => c.status === "result").map(serializeCard);
              updateProject(pid, [...existing, { id, cardType: "attribution" as const, modelName, prompt: cleanPrompt, corruptedPrompt, data: data as Record<string, unknown>, position: card.position, gpuTier, targetPosition, targetToken, contrastiveToken }], stateRef.current.canvas).catch(console.error);
            }
          } else if (event.stage === "error") {
            dispatch({ type: "CARD_ERRORED", id, error: event.error ?? "Unknown error" });
          } else {
            dispatch({ type: "CARD_STAGE", id, stage: event.stage });
          }
        }
      })
      .catch(err => dispatch({ type: "CARD_ERRORED", id, error: err instanceof Error ? err.message : "Unknown error" }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, projectIdRef, stateRef]);

  const verifyTopK = useCallback((attributionCardId: string, k: number) => {
    const attrCard = stateRef.current.lensCards.find(c => c.id === attributionCardId && c.cardType === "attribution") as AttributionCardData | undefined;
    if (!attrCard?.data) return;
    const activationId = crypto.randomUUID();
    const activationCard: ActivationCardData = {
      id: activationId, cardType: "activation", status: "loading",
      modelName: attrCard.modelName, cleanPrompt: attrCard.cleanPrompt, k,
      parentAttributionId: attributionCardId,
      data: null, error: null,
      position: { x: attrCard.position.x + 420, y: attrCard.position.y },
      gpuTier: attrCard.gpuTier, startedAt: Date.now(),
    };
    dispatch({ type: "ADD_CARD", card: activationCard });
    dispatch({ type: "ATTRIBUTION_VERIFY_STARTED", id: attributionCardId, k, verifyCardId: activationId });
    const components = attrCard.data.top_k_components;
    const targetTokenIdx = attrCard.data.target_token_idx;
    const contrastiveTokenIdx = attrCard.data.contrastive_token_idx ?? null;
    fetch("/api/run-activation-patch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cleanPrompt: attrCard.cleanPrompt, corruptedPrompt: attrCard.corruptedPrompt, modelName: attrCard.modelName, gpuTier: attrCard.gpuTier, targetPosition: attrCard.targetPosition, targetTokenIdx, contrastiveTokenIdx, components, k }),
    })
      .then(async (response) => {
        if (!response.ok || !response.body) {
          const err = await response.json().catch(() => ({})) as { error?: string; detail?: string };
          dispatch({ type: "CARD_ERRORED", id: activationId, error: handleFetchError(response, err) });
          dispatch({ type: "ATTRIBUTION_VERIFY_DONE", id: attributionCardId });
          return;
        }
        for await (const event of readSSEStream(response)) {
          if (event.stage === "done" && event.data) {
            const data = event.data as ActivationPatchResult;
            dispatch({ type: "ACTIVATION_CARD_RESOLVED", id: activationId, data, parentAttributionId: attributionCardId });
            const pid = projectIdRef.current;
            if (pid) {
              const existing = stateRef.current.lensCards.filter(c => c.status === "result").map(serializeCard);
              updateProject(pid, [...existing, { id: activationId, cardType: "activation" as const, modelName: attrCard.modelName, prompt: attrCard.cleanPrompt, data: data as Record<string, unknown>, position: activationCard.position, gpuTier: attrCard.gpuTier, parentAttributionId: attributionCardId }], stateRef.current.canvas).catch(console.error);
            }
          } else if (event.stage === "error") {
            dispatch({ type: "CARD_ERRORED", id: activationId, error: event.error ?? "Unknown error" });
            dispatch({ type: "ATTRIBUTION_VERIFY_DONE", id: attributionCardId });
          } else {
            dispatch({ type: "CARD_STAGE", id: activationId, stage: event.stage });
          }
        }
      })
      .catch(err => {
        dispatch({ type: "CARD_ERRORED", id: activationId, error: err instanceof Error ? err.message : "Unknown error" });
        dispatch({ type: "ATTRIBUTION_VERIFY_DONE", id: attributionCardId });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, projectIdRef, stateRef]);

  const spawnEntropyCard = useCallback((lensCardId: string) => {
    const lensCard = stateRef.current.lensCards.find(c => c.id === lensCardId) as LensCardData | undefined;
    if (!lensCard?.data?.entropy_data) return;
    const entropyCard: EntropyCardData = {
      id: crypto.randomUUID(), cardType: "entropy", status: "result",
      modelName: lensCard.modelName, prompt: lensCard.prompt,
      position: { x: lensCard.position.x + 320, y: lensCard.position.y - 140 },
      parentLensId: lensCardId,
      entropyData: lensCard.data.entropy_data,
      yLabels: lensCard.data.y_labels,
      xLabels: lensCard.data.x_labels,
    };
    dispatch({ type: "SPAWN_ENTROPY_CARD", card: entropyCard });
    const pid = projectIdRef.current;
    if (pid) {
      const existing = stateRef.current.lensCards.filter(c => c.status === "result").map(serializeCard);
      updateProject(pid, [...existing, { id: entropyCard.id, cardType: "entropy" as const, modelName: entropyCard.modelName, prompt: entropyCard.prompt, data: {}, position: entropyCard.position, parentLensId: lensCardId, entropyData: entropyCard.entropyData, xLabels: entropyCard.xLabels, yLabels: entropyCard.yLabels }], stateRef.current.canvas).catch(console.error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, projectIdRef, stateRef]);

  return { addLens, addDla, addAttribution, verifyTopK, spawnEntropyCard };
}
