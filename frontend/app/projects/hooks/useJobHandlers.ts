import { useCallback } from "react";
import type { Dispatch, RefObject } from "react";
import { updateProject } from "@/app/actions";
import { findSpawnPos, serializeCard } from "../helpers";
import { runJob } from "./job-runner";
import type { AppAction, AppState, HeatmapData } from "../types";
import type { LensCardData } from "@/app/components/LensCard";
import type { DlaCardData, DlaData } from "@/app/components/DlaCard";
import type { AttributionCardData, AttributionData } from "@/app/components/AttributionCard";
import type { ActivationCardData, ActivationPatchResult } from "@/app/components/ActivationCard";
import type { EntropyCardData } from "@/app/components/EntropyCard";
import type { AttentionCardData, AttentionData } from "@/app/components/AttentionCard";

type Deps = {
  dispatch: Dispatch<AppAction>;
  projectIdRef: RefObject<string | null>;
  stateRef: RefObject<AppState>;
};

export function useJobHandlers({ dispatch, projectIdRef, stateRef }: Deps) {
  // stateRef lags the ADD_CARD dispatch when a job resolves, so the resolved
  // card is appended explicitly instead of relying on the snapshot.
  const persist = useCallback((cardId: string, serialized: ReturnType<typeof serializeCard>) => {
    const pid = projectIdRef.current;
    if (!pid) return;
    const existing = stateRef.current.lensCards.filter(c => c.status === "result" && c.id !== cardId).map(serializeCard);
    updateProject(pid, [...existing, serialized], stateRef.current.canvas).catch(console.error);
  }, [projectIdRef, stateRef]);

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
        persist(id, serializeCard({ ...card, status: "result", data: data as HeatmapData }));
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
        persist(id, serializeCard({ ...card, status: "result", data: data as DlaData }));
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
        persist(id, serializeCard({ ...card, status: "result", data: data as AttributionData }));
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
        persist(activationId, serializeCard({ ...card, status: "result", data: data as ActivationPatchResult }));
      },
      onError: () => dispatch({ type: "ATTRIBUTION_VERIFY_DONE", id: attributionCardId }),
    });
  }, [dispatch, persist, stateRef]);

  const spawnEntropyCard = useCallback((lensCardId: string) => {
    const lensCard = stateRef.current.lensCards.find(c => c.id === lensCardId) as LensCardData | undefined;
    if (!lensCard?.data?.entropy_data) return;
    const alreadyExists = stateRef.current.lensCards.some(c => c.cardType === "entropy" && (c as EntropyCardData).parentLensId === lensCardId);
    if (alreadyExists) return;
    const entropyCard: EntropyCardData = {
      id: crypto.randomUUID(), cardType: "entropy", status: "result",
      modelName: lensCard.modelName, prompt: lensCard.prompt,
      position: { x: lensCard.position.x + 320, y: lensCard.position.y - 140 },
      parentLensId: lensCardId,
      entropyData: lensCard.data.entropy_data,
      yLabels: lensCard.data.y_labels,
      xLabels: lensCard.data.x_labels,
    };
    dispatch({ type: "ADD_CARD", card: entropyCard });
    persist(entropyCard.id, serializeCard(entropyCard));
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
      onResolve: (data) => {
        dispatch({ type: "CARD_RESOLVED", id, cardType: "attention-pattern", data: data as AttentionData });
        persist(id, serializeCard({ ...card, status: "result", data: data as AttentionData }));
      },
    });
  }, [dispatch, persist, stateRef]);

  return { addLens, addDla, addAttribution, verifyTopK, spawnEntropyCard, addAttn };
}
