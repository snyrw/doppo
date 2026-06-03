import { useCallback } from "react";
import type { Dispatch, RefObject } from "react";
import { updateProject } from "@/app/actions";
import { findSpawnPos, serializeCard } from "../helpers";
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

function handleSpawnError(status: number, err: { error?: string }): { error: string; showBuyCredits?: boolean } {
  if (status === 402) return { error: err.error ?? "Insufficient credits", showBuyCredits: true };
  if (status === 401) return { error: err.error ?? "Sign in to run inference" };
  return { error: err.error ?? `Request failed (${status})` };
}

function heuristicStage(elapsed: number): string {
  if (elapsed < 30_000) return "Connecting to GPU…";
  if (elapsed < 90_000) return "Loading model…";
  return "Running computation…";
}

async function pollUntilDone(
  jobId: string,
  cardId: string,
  startedAt: number,
  dispatch: Dispatch<AppAction>,
  onDone: (data: unknown) => void
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

    const result = await pollRes.json() as { status: string; data?: unknown; error?: string };

    if (result.status === "done") {
      onDone(result.data);
      return;
    }
    if (result.status === "error") {
      dispatch({ type: "CARD_ERRORED", id: cardId, error: result.error ?? "Unknown error" });
      return;
    }
    // status === "running": continue loop
  }
}

export function useSSEHandlers({ dispatch, projectIdRef, stateRef }: Deps) {
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

    (async () => {
      let spawnRes: Response;
      try {
        spawnRes = await fetch("/api/job/spawn-lens", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, modelName, gpuTier, topK }),
        });
      } catch (err) {
        dispatch({ type: "CARD_ERRORED", id, error: err instanceof Error ? err.message : "Network error" });
        return;
      }
      if (!spawnRes.ok) {
        const err = await spawnRes.json().catch(() => ({})) as { error?: string };
        dispatch({ type: "CARD_ERRORED", id, ...handleSpawnError(spawnRes.status, err) });
        return;
      }
      const body = await spawnRes.json() as { status?: string; jobId?: string; data?: HeatmapData };
      if (body.status === "cached" && body.data) {
        dispatch({ type: "CARD_RESOLVED", id, data: body.data });
        return;
      }
      if (!body.jobId) {
        dispatch({ type: "CARD_ERRORED", id, error: "Spawn returned no job ID" });
        return;
      }
      await pollUntilDone(body.jobId, id, startedAt, dispatch, (data) => {
        dispatch({ type: "CARD_RESOLVED", id, data: data as HeatmapData });
        window.dispatchEvent(new CustomEvent("credits-updated"));
        const pid = projectIdRef.current;
        if (pid) {
          const existing = stateRef.current.lensCards.filter(c => c.status === "result").map(serializeCard);
          updateProject(pid, [...existing, { id, cardType: "logit-lens" as const, modelName, prompt, topK, data: data as Record<string, unknown>, position: card.position, gpuTier }], stateRef.current.canvas).catch(console.error);
        }
      });
    })();
  }, [dispatch, projectIdRef, stateRef]);

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

    (async () => {
      let spawnRes: Response;
      try {
        spawnRes = await fetch("/api/job/spawn-dla", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, modelName, gpuTier, targetPosition, targetToken, contrastiveToken }),
        });
      } catch (err) {
        dispatch({ type: "CARD_ERRORED", id, error: err instanceof Error ? err.message : "Network error" });
        return;
      }
      if (!spawnRes.ok) {
        const err = await spawnRes.json().catch(() => ({})) as { error?: string };
        dispatch({ type: "CARD_ERRORED", id, ...handleSpawnError(spawnRes.status, err) });
        return;
      }
      const body = await spawnRes.json() as { status?: string; jobId?: string; data?: DlaData };
      if (body.status === "cached" && body.data) {
        dispatch({ type: "DLA_CARD_RESOLVED", id, data: body.data });
        return;
      }
      if (!body.jobId) {
        dispatch({ type: "CARD_ERRORED", id, error: "Spawn returned no job ID" });
        return;
      }
      await pollUntilDone(body.jobId, id, startedAt, dispatch, (data) => {
        dispatch({ type: "DLA_CARD_RESOLVED", id, data: data as DlaData });
        window.dispatchEvent(new CustomEvent("credits-updated"));
        const pid = projectIdRef.current;
        if (pid) {
          const existing = stateRef.current.lensCards.filter(c => c.status === "result").map(serializeCard);
          updateProject(pid, [...existing, { id, cardType: "dla" as const, modelName, prompt, data: data as Record<string, unknown>, position: card.position, gpuTier, targetPosition, targetToken, contrastiveToken }], stateRef.current.canvas).catch(console.error);
        }
      });
    })();
  }, [dispatch, projectIdRef, stateRef]);

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

    (async () => {
      let spawnRes: Response;
      try {
        spawnRes = await fetch("/api/job/spawn-attribution", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cleanPrompt, corruptedPrompt, modelName, gpuTier, targetPosition, targetToken, contrastiveToken }),
        });
      } catch (err) {
        dispatch({ type: "CARD_ERRORED", id, error: err instanceof Error ? err.message : "Network error" });
        return;
      }
      if (!spawnRes.ok) {
        const err = await spawnRes.json().catch(() => ({})) as { error?: string };
        dispatch({ type: "CARD_ERRORED", id, ...handleSpawnError(spawnRes.status, err) });
        return;
      }
      const body = await spawnRes.json() as { status?: string; jobId?: string; data?: AttributionData };
      if (body.status === "cached" && body.data) {
        dispatch({ type: "ATTRIBUTION_CARD_RESOLVED", id, data: body.data });
        return;
      }
      if (!body.jobId) {
        dispatch({ type: "CARD_ERRORED", id, error: "Spawn returned no job ID" });
        return;
      }
      await pollUntilDone(body.jobId, id, startedAt, dispatch, (data) => {
        dispatch({ type: "ATTRIBUTION_CARD_RESOLVED", id, data: data as AttributionData });
        window.dispatchEvent(new CustomEvent("credits-updated"));
        const pid = projectIdRef.current;
        if (pid) {
          const existing = stateRef.current.lensCards.filter(c => c.status === "result").map(serializeCard);
          updateProject(pid, [...existing, { id, cardType: "attribution" as const, modelName, prompt: cleanPrompt, corruptedPrompt, data: data as Record<string, unknown>, position: card.position, gpuTier, targetPosition, targetToken, contrastiveToken }], stateRef.current.canvas).catch(console.error);
        }
      });
    })();
  }, [dispatch, projectIdRef, stateRef]);

  const verifyTopK = useCallback((attributionCardId: string, k: number) => {
    const attrCard = stateRef.current.lensCards.find(c => c.id === attributionCardId && c.cardType === "attribution") as AttributionCardData | undefined;
    if (!attrCard?.data) return;
    const activationId = crypto.randomUUID();
    const startedAt = Date.now();
    const activationCard: ActivationCardData = {
      id: activationId, cardType: "activation", status: "loading",
      modelName: attrCard.modelName, cleanPrompt: attrCard.cleanPrompt, k,
      parentAttributionId: attributionCardId,
      data: null, error: null,
      position: { x: attrCard.position.x + 420, y: attrCard.position.y },
      gpuTier: attrCard.gpuTier, startedAt,
    };
    dispatch({ type: "ADD_CARD", card: activationCard });
    dispatch({ type: "ATTRIBUTION_VERIFY_STARTED", id: attributionCardId, k, verifyCardId: activationId });

    const components = attrCard.data.top_k_components;
    const targetTokenIdx = attrCard.data.target_token_idx;
    const contrastiveTokenIdx = attrCard.data.contrastive_token_idx ?? null;

    (async () => {
      let spawnRes: Response;
      try {
        spawnRes = await fetch("/api/job/spawn-activation-patch", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cleanPrompt: attrCard.cleanPrompt, corruptedPrompt: attrCard.corruptedPrompt, modelName: attrCard.modelName, gpuTier: attrCard.gpuTier, targetPosition: attrCard.targetPosition, targetTokenIdx, contrastiveTokenIdx, components, k }),
        });
      } catch (err) {
        dispatch({ type: "CARD_ERRORED", id: activationId, error: err instanceof Error ? err.message : "Network error" });
        dispatch({ type: "ATTRIBUTION_VERIFY_DONE", id: attributionCardId });
        return;
      }
      if (!spawnRes.ok) {
        const err = await spawnRes.json().catch(() => ({})) as { error?: string };
        dispatch({ type: "CARD_ERRORED", id: activationId, ...handleSpawnError(spawnRes.status, err) });
        dispatch({ type: "ATTRIBUTION_VERIFY_DONE", id: attributionCardId });
        return;
      }
      const body = await spawnRes.json() as { status?: string; jobId?: string; data?: ActivationPatchResult };
      if (body.status === "cached" && body.data) {
        dispatch({ type: "ACTIVATION_CARD_RESOLVED", id: activationId, data: body.data, parentAttributionId: attributionCardId });
        return;
      }
      if (!body.jobId) {
        dispatch({ type: "CARD_ERRORED", id: activationId, error: "Spawn returned no job ID" });
        dispatch({ type: "ATTRIBUTION_VERIFY_DONE", id: attributionCardId });
        return;
      }
      await pollUntilDone(body.jobId, activationId, startedAt, dispatch, (data) => {
        dispatch({ type: "ACTIVATION_CARD_RESOLVED", id: activationId, data: data as ActivationPatchResult, parentAttributionId: attributionCardId });
        window.dispatchEvent(new CustomEvent("credits-updated"));
        const pid = projectIdRef.current;
        if (pid) {
          const existing = stateRef.current.lensCards.filter(c => c.status === "result").map(serializeCard);
          updateProject(pid, [...existing, { id: activationId, cardType: "activation" as const, modelName: attrCard.modelName, prompt: attrCard.cleanPrompt, data: data as Record<string, unknown>, position: activationCard.position, gpuTier: attrCard.gpuTier, parentAttributionId: attributionCardId }], stateRef.current.canvas).catch(console.error);
        }
      });
      dispatch({ type: "ATTRIBUTION_VERIFY_DONE", id: attributionCardId });
    })();
  }, [dispatch, projectIdRef, stateRef]);

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
    dispatch({ type: "SPAWN_ENTROPY_CARD", card: entropyCard });
    const pid = projectIdRef.current;
    if (pid) {
      const existing = stateRef.current.lensCards.filter(c => c.status === "result").map(serializeCard);
      updateProject(pid, [...existing, { id: entropyCard.id, cardType: "entropy" as const, modelName: entropyCard.modelName, prompt: entropyCard.prompt, data: {}, position: entropyCard.position, parentLensId: lensCardId, entropyData: entropyCard.entropyData, xLabels: entropyCard.xLabels, yLabels: entropyCard.yLabels }], stateRef.current.canvas).catch(console.error);
    }
  }, [dispatch, projectIdRef, stateRef]);

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

    (async () => {
      let spawnRes: Response;
      try {
        spawnRes = await fetch("/api/job/spawn-attn", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, modelName, gpuTier }),
        });
      } catch (err) {
        dispatch({ type: "CARD_ERRORED", id, error: err instanceof Error ? err.message : "Network error" });
        return;
      }
      if (!spawnRes.ok) {
        const err = await spawnRes.json().catch(() => ({})) as { error?: string };
        dispatch({ type: "CARD_ERRORED", id, ...handleSpawnError(spawnRes.status, err) });
        return;
      }
      const body = await spawnRes.json() as { status?: string; jobId?: string; data?: AttentionData };
      if (body.status === "cached" && body.data) {
        dispatch({ type: "ATTENTION_CARD_RESOLVED", id, data: body.data });
        return;
      }
      if (!body.jobId) {
        dispatch({ type: "CARD_ERRORED", id, error: "Spawn returned no job ID" });
        return;
      }
      await pollUntilDone(body.jobId, id, startedAt, dispatch, (data) => {
        dispatch({ type: "ATTENTION_CARD_RESOLVED", id, data: data as AttentionData });
        window.dispatchEvent(new CustomEvent("credits-updated"));
        const pid = projectIdRef.current;
        if (pid) {
          const existing = stateRef.current.lensCards.filter(c => c.status === "result").map(serializeCard);
          updateProject(pid, [...existing, { id, cardType: "attention-pattern" as const, modelName, prompt, data: data as Record<string, unknown>, position: card.position, gpuTier }], stateRef.current.canvas).catch(console.error);
        }
      });
    })();
  }, [dispatch, projectIdRef, stateRef]);

  return { addLens, addDla, addAttribution, verifyTopK, spawnEntropyCard, addAttn };
}
