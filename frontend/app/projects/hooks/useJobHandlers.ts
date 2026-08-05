import { useCallback } from "react";
import type { Dispatch, RefObject } from "react";
import { upsertProjectCard } from "@/app/actions";
import { findSpawnPos, serializeCard } from "../helpers";
import { runJob } from "./job-runner";
import type { AppAction, AppState, HeatmapData } from "../types";
import type { LensCardData } from "@/app/components/LensCard";
import type { DlaCardData, DlaData } from "@/app/components/DlaCard";
import type { AttributionCardData, AttributionData } from "@/app/components/AttributionCard";
import type { ActivationCardData, ActivationPatchResult } from "@/app/components/ActivationCard";
import type { AttentionCardData, AttentionData } from "@/app/components/AttentionCard";

type Deps = {
  dispatch: Dispatch<AppAction>;
  stateRef: RefObject<AppState>;
  ensureProject: () => Promise<string>;
  onSaveError: (message: string) => void;
};

export function useJobHandlers({ dispatch, stateRef, ensureProject, onSaveError }: Deps) {
  // upsertProjectCard merges this one card into the DB row atomically, so
  // concurrent resolves (e.g. lens + DLA + attention finishing close together)
  // can't overwrite each other via a stale stateRef snapshot the way a
  // full-list save would. ensureProject lazily materializes the draft row on
  // this first save (awaited so the row exists before the upsert runs).
  const persist = useCallback(async (serialized: ReturnType<typeof serializeCard>) => {
    const pid = await ensureProject();
    upsertProjectCard(pid, serialized, stateRef.current.canvas).catch(err => {
      console.error(err);
      onSaveError(`Couldn't save "${serialized.prompt.slice(0, 40)}" — try again or it may be lost on refresh.`);
    });
  }, [ensureProject, stateRef, onSaveError]);

  const addLens = useCallback(({ modelName, prompt, gpuTier, topK }: {
    modelName: string; prompt: string; gpuTier?: string; topK: number;
  }) => {
    const id = crypto.randomUUID();
    const startedAt = Date.now();
    const card: LensCardData = {
      id, cardType: "logit-lens", status: "loading", modelName, prompt, topK,
      data: null, error: null,
      position: findSpawnPos(stateRef.current.lensCards),
      gpuTier, startedAt,
    };
    dispatch({ type: "ADD_CARD", card });

    void runJob({
      endpoint: "/api/job/spawn-lens",
      body: { prompt, modelName, gpuTier, topK },
      cardId: id, startedAt, dispatch,
      onResolve: (data) => {
        dispatch({ type: "CARD_RESOLVED", id, cardType: "logit-lens", data: data as HeatmapData });
        persist(serializeCard({ ...card, status: "result", data: data as HeatmapData }));
      },
    });
  }, [dispatch, persist, stateRef]);

  const addDla = useCallback(({ modelName, prompt, gpuTier, targetPosition, targetToken, contrastiveToken }: {
    modelName: string; prompt: string; gpuTier?: string;
    targetPosition: number | "last"; targetToken: string | null; contrastiveToken: string | null;
  }) => {
    const id = crypto.randomUUID();
    const startedAt = Date.now();
    const card: DlaCardData = {
      id, cardType: "dla", status: "loading", modelName, prompt,
      data: null, error: null,
      position: findSpawnPos(stateRef.current.lensCards),
      gpuTier, startedAt, targetPosition, targetToken, contrastiveToken,
    };
    dispatch({ type: "ADD_CARD", card });

    void runJob({
      endpoint: "/api/job/spawn-dla",
      body: { prompt, modelName, gpuTier, targetPosition, targetToken, contrastiveToken },
      cardId: id, startedAt, dispatch,
      onResolve: (data) => {
        dispatch({ type: "CARD_RESOLVED", id, cardType: "dla", data: data as DlaData });
        persist(serializeCard({ ...card, status: "result", data: data as DlaData }));
      },
    });
  }, [dispatch, persist, stateRef]);

  const addAttribution = useCallback(({ modelName, cleanPrompt, corruptedPrompt, gpuTier, targetPosition, targetToken, contrastiveToken }: {
    modelName: string; cleanPrompt: string; corruptedPrompt: string; gpuTier?: string;
    targetPosition: number | "last"; targetToken: string | null; contrastiveToken: string | null;
  }) => {
    const id = crypto.randomUUID();
    const startedAt = Date.now();
    const card: AttributionCardData = {
      id, cardType: "attribution", status: "loading", modelName, cleanPrompt, corruptedPrompt,
      data: null, error: null,
      position: findSpawnPos(stateRef.current.lensCards),
      gpuTier, startedAt, targetPosition, targetToken, contrastiveToken, verifyStatus: "idle",
    };
    dispatch({ type: "ADD_CARD", card });

    void runJob({
      endpoint: "/api/job/spawn-attribution",
      body: { cleanPrompt, corruptedPrompt, modelName, gpuTier, targetPosition, targetToken, contrastiveToken },
      cardId: id, startedAt, dispatch,
      onResolve: (data) => {
        dispatch({ type: "CARD_RESOLVED", id, cardType: "attribution", data: data as AttributionData });
        persist(serializeCard({ ...card, status: "result", data: data as AttributionData }));
      },
    });
  }, [dispatch, persist, stateRef]);

  const verifyTopK = useCallback((attributionCardId: string, k: number) => {
    const attrCard = stateRef.current.lensCards.find(c => c.id === attributionCardId && c.cardType === "attribution") as AttributionCardData | undefined;
    if (!attrCard?.data) return;
    const activationId = crypto.randomUUID();
    const startedAt = Date.now();
    const card: ActivationCardData = {
      id: activationId, cardType: "activation", status: "loading",
      modelName: attrCard.modelName, cleanPrompt: attrCard.cleanPrompt, k,
      parentAttributionId: attributionCardId,
      data: null, error: null,
      position: { x: attrCard.position.x + 420, y: attrCard.position.y },
      gpuTier: attrCard.gpuTier, startedAt,
    };
    dispatch({ type: "ADD_CARD", card });
    dispatch({ type: "ATTRIBUTION_VERIFY_STARTED", id: attributionCardId });

    void runJob({
      endpoint: "/api/job/spawn-activation-patch",
      body: {
        cleanPrompt: attrCard.cleanPrompt, corruptedPrompt: attrCard.corruptedPrompt,
        modelName: attrCard.modelName, gpuTier: attrCard.gpuTier, targetPosition: attrCard.targetPosition,
        targetTokenIdx: attrCard.data.target_token_idx,
        contrastiveTokenIdx: attrCard.data.contrastive_token_idx ?? null,
        components: attrCard.data.top_k_components, k,
      },
      cardId: activationId, startedAt, dispatch,
      onResolve: (data) => {
        dispatch({ type: "CARD_RESOLVED", id: activationId, cardType: "activation", data: data as ActivationPatchResult, parentAttributionId: attributionCardId });
        persist(serializeCard({ ...card, status: "result", data: data as ActivationPatchResult }));
      },
      onError: () => dispatch({ type: "ATTRIBUTION_VERIFY_DONE", id: attributionCardId }),
    });
  }, [dispatch, persist, stateRef]);

  const addAttn = useCallback(({ modelName, prompt, gpuTier }: {
    modelName: string; prompt: string; gpuTier?: string;
  }) => {
    const id = crypto.randomUUID();
    const startedAt = Date.now();
    const card: AttentionCardData = {
      id, cardType: "attention-pattern", status: "loading", modelName, prompt,
      data: null, error: null,
      position: findSpawnPos(stateRef.current.lensCards),
      gpuTier, startedAt,
    };
    dispatch({ type: "ADD_CARD", card });

    void runJob({
      endpoint: "/api/job/spawn-attn",
      body: { prompt, modelName, gpuTier },
      cardId: id, startedAt, dispatch,
      onResolve: (data, cacheKey) => {
        dispatch({ type: "CARD_RESOLVED", id, cardType: "attention-pattern", data: data as AttentionData, cacheKey });
        persist(serializeCard({ ...card, status: "result", data: data as AttentionData, cacheKey }));
      },
    });
  }, [dispatch, persist, stateRef]);

  return { addLens, addDla, addAttribution, verifyTopK, addAttn };
}
