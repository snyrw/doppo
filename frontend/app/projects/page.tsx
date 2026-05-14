"use client";

import { useState, useEffect, useReducer, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import SandboxCanvas from "../components/SandboxCanvas";
import ConfigPane from "../components/ConfigPane";
import DlaConfigPane from "../components/DlaConfigPane";
import AttributionConfigPane from "../components/AttributionConfigPane";
import SteeringConfigPane from "../components/SteeringConfigPane";
import Navbar from "../components/Navbar";
import { ProjectSearch } from "../components/ProjectSearch";
import type { LensCardData } from "../components/LensCard";
import type { DlaCardData, DlaData } from "../components/DlaCard";
import type { AttributionCardData, AttributionData } from "../components/AttributionCard";
import type { ActivationCardData, ActivationPatchResult } from "../components/ActivationCard";
import type { SteeringCardData, SteeringResult, SteeringComponent } from "../components/SteeringCard";
import { useSession } from "../lib/auth-client";
import {
  createProject,
  duplicateProject,
  deleteProject,
  loadProject,
  updateProject,
  setProjectShare,
} from "../actions";

type ModelInfo = {
  id: string;
  display_name: string;
  description: string;
  requires_hf_token: boolean;
  gpu_tier: string;
};

type HeatmapData = {
  x_labels: string[];
  y_labels: string[];
  heatmap_data: number[][];
  topk_tokens?: string[][][];
  topk_probs?: number[][][];
};

type CanvasState = {
  panOffset: { x: number; y: number };
  zoom: number;
};

type AnyCard = LensCardData | DlaCardData | AttributionCardData | ActivationCardData | SteeringCardData;

type AppState = {
  lensCards: AnyCard[];
  canvas: CanvasState;
};

type AppAction =
  | { type: "ADD_CARD"; card: AnyCard }
  | { type: "CARD_RESOLVED"; id: string; data: HeatmapData }
  | { type: "DLA_CARD_RESOLVED"; id: string; data: DlaData }
  | { type: "ATTRIBUTION_CARD_RESOLVED"; id: string; data: AttributionData }
  | { type: "ACTIVATION_CARD_RESOLVED"; id: string; data: ActivationPatchResult; parentAttributionId: string }
  | { type: "ATTRIBUTION_VERIFY_STARTED"; id: string; k: number; verifyCardId: string }
  | { type: "ATTRIBUTION_VERIFY_DONE"; id: string }
  | { type: "CARD_ERRORED"; id: string; error: string }
  | { type: "CARD_STAGE"; id: string; stage: string }
  | { type: "MOVE_CARD"; id: string; position: { x: number; y: number } }
  | { type: "REMOVE_CARD"; id: string }
  | { type: "SET_CANVAS"; canvas: CanvasState }
  | { type: "LOAD_PROJECT"; cards: AnyCard[]; canvas: CanvasState }
  | { type: "RESET_CANVAS" }
  | { type: "STEERING_CARD_TOKEN"; id: string; token: string }
  | { type: "STEERING_CARD_RESOLVED"; id: string; data: SteeringResult }
  | { type: "STEERING_CARD_RERUN"; id: string; alpha: number };

const CARD_COL_WIDTH = 360;
const CARD_ROW_HEIGHT = 320;
const GRID_MARGIN = 40;

function autoArrangePos(index: number): { x: number; y: number } {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return {
    x: GRID_MARGIN + col * (CARD_COL_WIDTH + GRID_MARGIN),
    y: GRID_MARGIN + row * (CARD_ROW_HEIGHT + GRID_MARGIN),
  };
}

const initialState: AppState = {
  lensCards: [],
  canvas: { panOffset: { x: 0, y: 0 }, zoom: 1 },
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "ADD_CARD":
      return { ...state, lensCards: [...state.lensCards, action.card] };
    case "CARD_RESOLVED":
      return {
        ...state,
        lensCards: state.lensCards.map(c =>
          c.id === action.id && c.cardType !== "dla" && c.cardType !== "attribution" && c.cardType !== "activation" && c.cardType !== "steering"
            ? { ...c, status: "result" as const, data: action.data } : c
        ),
      };
    case "DLA_CARD_RESOLVED":
      return {
        ...state,
        lensCards: state.lensCards.map(c =>
          c.id === action.id && c.cardType === "dla" ? { ...c, status: "result" as const, data: action.data } : c
        ),
      };
    case "ATTRIBUTION_CARD_RESOLVED":
      return {
        ...state,
        lensCards: state.lensCards.map(c =>
          c.id === action.id && c.cardType === "attribution" ? { ...c, status: "result" as const, data: action.data } : c
        ),
      };
    case "ACTIVATION_CARD_RESOLVED":
      return {
        ...state,
        lensCards: state.lensCards.map(c => {
          if (c.id === action.id && c.cardType === "activation")
            return { ...c, status: "result" as const, data: action.data };
          if (c.id === action.parentAttributionId && c.cardType === "attribution")
            return { ...c, verifyStatus: "done" as const };
          return c;
        }),
      };
    case "ATTRIBUTION_VERIFY_STARTED":
      return {
        ...state,
        lensCards: state.lensCards.map(c =>
          c.id === action.id && c.cardType === "attribution"
            ? { ...c, verifyStatus: "loading" as const, verifyK: action.k, verifyCardId: action.verifyCardId } : c
        ),
      };
    case "ATTRIBUTION_VERIFY_DONE":
      return {
        ...state,
        lensCards: state.lensCards.map(c =>
          c.id === action.id && c.cardType === "attribution" ? { ...c, verifyStatus: "done" as const } : c
        ),
      };
    case "CARD_ERRORED":
      return {
        ...state,
        lensCards: state.lensCards.map(c =>
          c.id === action.id ? { ...c, status: "error" as const, error: action.error } : c
        ),
      };
    case "MOVE_CARD":
      return {
        ...state,
        lensCards: state.lensCards.map(c =>
          c.id === action.id ? { ...c, position: action.position } : c
        ),
      };
    case "CARD_STAGE":
      return {
        ...state,
        lensCards: state.lensCards.map(c =>
          c.id === action.id ? { ...c, loadingStage: action.stage } : c
        ),
      };
    case "STEERING_CARD_TOKEN":
      return {
        ...state,
        lensCards: state.lensCards.map(c =>
          c.id === action.id && c.cardType === "steering"
            ? { ...c, streamingText: (c.streamingText ?? "") + action.token } : c
        ),
      };
    case "STEERING_CARD_RESOLVED":
      return {
        ...state,
        lensCards: state.lensCards.map(c =>
          c.id === action.id && c.cardType === "steering"
            ? { ...c, status: "result" as const, data: action.data, streamingText: undefined } : c
        ),
      };
    case "STEERING_CARD_RERUN":
      return {
        ...state,
        lensCards: state.lensCards.map(c =>
          c.id === action.id && c.cardType === "steering"
            ? { ...c, status: "loading" as const, data: null, error: null, streamingText: undefined, alpha: action.alpha, startedAt: Date.now() } : c
        ),
      };
    case "REMOVE_CARD":
      return { ...state, lensCards: state.lensCards.filter(c => c.id !== action.id) };
    case "SET_CANVAS":
      return { ...state, canvas: action.canvas };
    case "LOAD_PROJECT":
      return { lensCards: action.cards, canvas: action.canvas };
    case "RESET_CANVAS":
      return initialState;
    default:
      return state;
  }
}

function serializeCard(c: AnyCard) {
  if (c.cardType === "dla") {
    return { id: c.id, cardType: "dla" as const, modelName: c.modelName, prompt: c.prompt, data: c.data as Record<string, unknown>, position: c.position, gpuTier: c.gpuTier, targetPosition: c.targetPosition, targetToken: c.targetToken, contrastiveToken: c.contrastiveToken };
  }
  if (c.cardType === "attribution") {
    return { id: c.id, cardType: "attribution" as const, modelName: c.modelName, prompt: c.cleanPrompt, corruptedPrompt: c.corruptedPrompt, data: c.data as Record<string, unknown>, position: c.position, gpuTier: c.gpuTier, targetPosition: c.targetPosition, targetToken: c.targetToken, contrastiveToken: c.contrastiveToken };
  }
  if (c.cardType === "activation") {
    return { id: c.id, cardType: "activation" as const, modelName: c.modelName, prompt: c.cleanPrompt, data: c.data as Record<string, unknown>, position: c.position, gpuTier: c.gpuTier, parentAttributionId: c.parentAttributionId };
  }
  if (c.cardType === "steering") {
    return { id: c.id, cardType: "steering" as const, modelName: c.modelName, prompt: c.cleanPrompt, corruptedPrompt: c.corruptedPrompt, data: c.data as Record<string, unknown>, position: c.position, gpuTier: c.gpuTier, targetPosition: c.targetPosition, targetToken: c.targetToken, components: c.components, alpha: c.alpha, nTokens: c.nTokens, parentCardId: c.parentCardId };
  }
  return { id: c.id, modelName: c.modelName, prompt: (c as LensCardData | DlaCardData).prompt, data: c.data as Record<string, unknown>, position: c.position, gpuTier: c.gpuTier };
}

function getCardPrompt(c: AnyCard): string {
  if (c.cardType === "attribution" || c.cardType === "activation" || c.cardType === "steering") return c.cleanPrompt;
  return (c as LensCardData | DlaCardData).prompt;
}

function Projects() {
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [dlaOpen, setDlaOpen] = useState(false);
  const [attributionOpen, setAttributionOpen] = useState(false);
  const [steeringOpen, setSteeringOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("Untitled Project");
  const [nameEditing, setNameEditing] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [shareId, setShareId] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const addRef = useRef<HTMLDivElement>(null);
  const projectsRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [state, dispatch] = useReducer(appReducer, initialState);
  const projectIdRef = useRef<string | null>(null);
  const stateRef = useRef(state);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();

  // Close add dropdown + sub-panes on outside click
  useEffect(() => {
    if (!addOpen && !configOpen && !dlaOpen && !attributionOpen && !steeringOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (addRef.current && !addRef.current.contains(e.target as Node)) {
        setAddOpen(false);
        setConfigOpen(false);
        setDlaOpen(false);
        setAttributionOpen(false);
        setSteeringOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [addOpen, configOpen, dlaOpen, attributionOpen, steeringOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!projectsOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (projectsRef.current && !projectsRef.current.contains(e.target as Node)) {
        setProjectsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [projectsOpen]);

  // Reset delete confirmation + export submenu when dropdown closes
  useEffect(() => {
    if (!projectsOpen) {
      setDeleteConfirming(false);
      setExportOpen(false);
    }
  }, [projectsOpen]);

  const loadAndSetProject = useCallback(async (id: string) => {
    setProjectId(id);
    router.replace(`/projects?id=${id}`);
    try {
      const result = await loadProject(id);
      if (!result) { router.replace("/projects"); return; }
      const lensCards: AnyCard[] = result.cards.map(c => {
        if (c.cardType === "dla") {
          return { ...c, cardType: "dla" as const, status: "result" as const, error: null, contrastiveToken: c.contrastiveToken ?? null } as DlaCardData;
        }
        if (c.cardType === "attribution") {
          return {
            ...c, cardType: "attribution" as const, status: "result" as const, error: null,
            cleanPrompt: c.prompt, corruptedPrompt: c.corruptedPrompt ?? "",
            targetPosition: c.targetPosition ?? "last", targetToken: c.targetToken ?? null,
            contrastiveToken: c.contrastiveToken ?? null,
            verifyStatus: "idle" as const,
          } as unknown as AttributionCardData;
        }
        if (c.cardType === "activation") {
          return {
            ...c, cardType: "activation" as const, status: "result" as const, error: null,
            cleanPrompt: c.prompt, k: 10,
            parentAttributionId: c.parentAttributionId ?? "",
          } as unknown as ActivationCardData;
        }
        if (c.cardType === "steering") {
          return {
            ...c, cardType: "steering" as const, status: "result" as const, error: null,
            cleanPrompt: c.prompt, corruptedPrompt: c.corruptedPrompt ?? "",
            targetPosition: c.targetPosition ?? "last", targetToken: c.targetToken ?? null,
            components: (c.components ?? []) as SteeringComponent[],
            alpha: c.alpha ?? 1.0, nTokens: c.nTokens ?? 20,
            parentCardId: c.parentCardId ?? "",
            streamingText: undefined,
          } as unknown as SteeringCardData;
        }
        return { ...c, cardType: "logit-lens" as const, status: "result" as const, error: null } as LensCardData;
      });
      setProjectName(result.name);
      setShareId(result.shareId);
      dispatch({ type: "LOAD_PROJECT", cards: lensCards, canvas: result.canvas });
    } catch {
      router.replace("/projects");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load project from URL on mount
  useEffect(() => {
    const id = searchParams.get("id");
    if (!id) return;
    loadAndSetProject(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep refs in sync so SSE callbacks always read latest values
  useEffect(() => { projectIdRef.current = projectId; }, [projectId]);
  useEffect(() => { stateRef.current = state; }, [state]);

  // Focus + select-all the name input whenever editing starts
  useEffect(() => {
    if (nameEditing) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [nameEditing]);

  // Cmd+K / Ctrl+K toggles the project search palette
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(o => !o);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fetch available models
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/models`)
      .then(r => r.json())
      .then(models => setAvailableModels(models))
      .catch(() => setAvailableModels([{ id: "gpt2-small", display_name: "GPT-2 Small", description: "Classic 12-layer baseline, fast cold starts.", requires_hf_token: false, gpu_tier: "tl_small" }]))
      .finally(() => setModelsLoading(false));
  }, []);

  const handleAddLens = ({ modelName, prompt, gpuTier }: { modelName: string; prompt: string; gpuTier?: string }) => {
    setConfigOpen(false);

    const id = crypto.randomUUID();
    const card: LensCardData = {
      id,
      cardType: "logit-lens",
      status: "loading",
      modelName,
      prompt,
      data: null,
      error: null,
      position: autoArrangePos(state.lensCards.length),
      gpuTier,
      startedAt: Date.now(),
    };

    dispatch({ type: "ADD_CARD", card });

    fetch("/api/run-lens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, modelName, gpuTier }),
    })
      .then(async (response) => {
        if (!response.ok || !response.body) {
          const err = await response.json().catch(() => ({})) as { error?: string; detail?: string };
          const message = response.status === 401
            ? (err.error ?? "Sign in to use medium and large models")
            : (err.detail ?? err.error ?? `Request failed (${response.status})`);
          dispatch({ type: "CARD_ERRORED", id, error: message });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const line = part.split("\n").find(l => l.startsWith("data: "));
            if (!line) continue;
            try {
              const event = JSON.parse(line.slice(6)) as { stage: string; data?: HeatmapData; error?: string };
              if (event.stage === "done" && event.data) {
                dispatch({ type: "CARD_RESOLVED", id, data: event.data });
                const pid = projectIdRef.current;
                if (pid) {
                  const existingResult = stateRef.current.lensCards
                    .filter(c => c.status === "result")
                    .map(serializeCard);
                  updateProject(pid, [...existingResult, { id, modelName, prompt, data: event.data as Record<string, unknown>, position: card.position, gpuTier }], stateRef.current.canvas)
                    .catch(console.error);
                }
              } else if (event.stage === "error") {
                dispatch({ type: "CARD_ERRORED", id, error: event.error ?? "Unknown error" });
              } else {
                dispatch({ type: "CARD_STAGE", id, stage: event.stage });
              }
            } catch { /* malformed chunk */ }
          }
        }
      })
      .catch(err => dispatch({ type: "CARD_ERRORED", id, error: err instanceof Error ? err.message : "Unknown error" }));
  };

  const handleAddDla = ({ modelName, prompt, gpuTier, targetPosition, targetToken, contrastiveToken }: {
    modelName: string; prompt: string; gpuTier?: string;
    targetPosition: number | "last"; targetToken: string | null; contrastiveToken: string | null;
  }) => {
    setDlaOpen(false);

    const id = crypto.randomUUID();
    const card: DlaCardData = {
      id,
      cardType: "dla",
      status: "loading",
      modelName,
      prompt,
      data: null,
      error: null,
      position: autoArrangePos(state.lensCards.length),
      gpuTier,
      startedAt: Date.now(),
      targetPosition,
      targetToken,
      contrastiveToken,
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
          const message = response.status === 401
            ? (err.error ?? "Sign in to use medium and large models")
            : (err.detail ?? err.error ?? `Request failed (${response.status})`);
          dispatch({ type: "CARD_ERRORED", id, error: message });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const line = part.split("\n").find(l => l.startsWith("data: "));
            if (!line) continue;
            try {
              const event = JSON.parse(line.slice(6)) as { stage: string; data?: DlaData; error?: string };
              if (event.stage === "done" && event.data) {
                dispatch({ type: "DLA_CARD_RESOLVED", id, data: event.data });
                const pid = projectIdRef.current;
                if (pid) {
                  const existingResult = stateRef.current.lensCards
                    .filter(c => c.status === "result")
                    .map(serializeCard);
                  updateProject(pid, [...existingResult, { id, cardType: "dla" as const, modelName, prompt, data: event.data as Record<string, unknown>, position: card.position, gpuTier, targetPosition, targetToken, contrastiveToken }], stateRef.current.canvas)
                    .catch(console.error);
                }
              } else if (event.stage === "error") {
                dispatch({ type: "CARD_ERRORED", id, error: event.error ?? "Unknown error" });
              } else {
                dispatch({ type: "CARD_STAGE", id, stage: event.stage });
              }
            } catch { /* malformed chunk */ }
          }
        }
      })
      .catch(err => dispatch({ type: "CARD_ERRORED", id, error: err instanceof Error ? err.message : "Unknown error" }));
  };

  const handleAddAttribution = ({ modelName, cleanPrompt, corruptedPrompt, gpuTier, targetPosition, targetToken, contrastiveToken }: {
    modelName: string; cleanPrompt: string; corruptedPrompt: string; gpuTier?: string;
    targetPosition: number | "last"; targetToken: string | null; contrastiveToken: string | null;
  }) => {
    setAttributionOpen(false);

    const id = crypto.randomUUID();
    const card: AttributionCardData = {
      id,
      cardType: "attribution",
      status: "loading",
      modelName,
      cleanPrompt,
      corruptedPrompt,
      data: null,
      error: null,
      position: autoArrangePos(stateRef.current.lensCards.length),
      gpuTier,
      startedAt: Date.now(),
      targetPosition,
      targetToken,
      contrastiveToken,
      verifyStatus: "idle",
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
          const message = response.status === 401
            ? (err.error ?? "Sign in to use medium and large models")
            : (err.detail ?? err.error ?? `Request failed (${response.status})`);
          dispatch({ type: "CARD_ERRORED", id, error: message });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            const line = part.split("\n").find(l => l.startsWith("data: "));
            if (!line) continue;
            try {
              const event = JSON.parse(line.slice(6)) as { stage: string; data?: AttributionData; error?: string };
              if (event.stage === "done" && event.data) {
                dispatch({ type: "ATTRIBUTION_CARD_RESOLVED", id, data: event.data });
                const pid = projectIdRef.current;
                if (pid) {
                  const existingResult = stateRef.current.lensCards.filter(c => c.status === "result").map(serializeCard);
                  updateProject(pid, [...existingResult, { id, cardType: "attribution" as const, modelName, prompt: cleanPrompt, corruptedPrompt, data: event.data as Record<string, unknown>, position: card.position, gpuTier, targetPosition, targetToken, contrastiveToken }], stateRef.current.canvas).catch(console.error);
                }
              } else if (event.stage === "error") {
                dispatch({ type: "CARD_ERRORED", id, error: event.error ?? "Unknown error" });
              } else {
                dispatch({ type: "CARD_STAGE", id, stage: event.stage });
              }
            } catch { /* malformed chunk */ }
          }
        }
      })
      .catch(err => dispatch({ type: "CARD_ERRORED", id, error: err instanceof Error ? err.message : "Unknown error" }));
  };

  const handleVerifyTopK = (attributionCardId: string, k: number) => {
    const attrCard = stateRef.current.lensCards.find(c => c.id === attributionCardId && c.cardType === "attribution") as AttributionCardData | undefined;
    if (!attrCard?.data) return;

    const activationId = crypto.randomUUID();
    const activationCard: ActivationCardData = {
      id: activationId,
      cardType: "activation",
      status: "loading",
      modelName: attrCard.modelName,
      cleanPrompt: attrCard.cleanPrompt,
      k,
      parentAttributionId: attributionCardId,
      data: null,
      error: null,
      position: { x: attrCard.position.x + 420, y: attrCard.position.y },
      gpuTier: attrCard.gpuTier,
      startedAt: Date.now(),
    };

    dispatch({ type: "ADD_CARD", card: activationCard });
    dispatch({ type: "ATTRIBUTION_VERIFY_STARTED", id: attributionCardId, k, verifyCardId: activationId });

    const components = attrCard.data.top_k_components;
    const targetTokenIdx = attrCard.data.target_token_idx;
    const contrastiveTokenIdx = attrCard.data.contrastive_token_idx ?? null;

    fetch("/api/run-activation-patch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cleanPrompt: attrCard.cleanPrompt,
        corruptedPrompt: attrCard.corruptedPrompt,
        modelName: attrCard.modelName,
        gpuTier: attrCard.gpuTier,
        targetPosition: attrCard.targetPosition,
        targetTokenIdx,
        contrastiveTokenIdx,
        components,
        k,
      }),
    })
      .then(async (response) => {
        if (!response.ok || !response.body) {
          const err = await response.json().catch(() => ({})) as { error?: string; detail?: string };
          const message = response.status === 401
            ? (err.error ?? "Sign in to use medium and large models")
            : (err.detail ?? err.error ?? `Request failed (${response.status})`);
          dispatch({ type: "CARD_ERRORED", id: activationId, error: message });
          dispatch({ type: "ATTRIBUTION_VERIFY_DONE", id: attributionCardId });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            const line = part.split("\n").find(l => l.startsWith("data: "));
            if (!line) continue;
            try {
              const event = JSON.parse(line.slice(6)) as { stage: string; data?: ActivationPatchResult; error?: string };
              if (event.stage === "done" && event.data) {
                dispatch({ type: "ACTIVATION_CARD_RESOLVED", id: activationId, data: event.data, parentAttributionId: attributionCardId });
                const pid = projectIdRef.current;
                if (pid) {
                  const existingResult = stateRef.current.lensCards.filter(c => c.status === "result").map(serializeCard);
                  updateProject(pid, [...existingResult, { id: activationId, cardType: "activation" as const, modelName: attrCard.modelName, prompt: attrCard.cleanPrompt, data: event.data as Record<string, unknown>, position: activationCard.position, gpuTier: attrCard.gpuTier, parentAttributionId: attributionCardId }], stateRef.current.canvas).catch(console.error);
                }
              } else if (event.stage === "error") {
                dispatch({ type: "CARD_ERRORED", id: activationId, error: event.error ?? "Unknown error" });
                dispatch({ type: "ATTRIBUTION_VERIFY_DONE", id: attributionCardId });
              } else {
                dispatch({ type: "CARD_STAGE", id: activationId, stage: event.stage });
              }
            } catch { /* malformed chunk */ }
          }
        }
      })
      .catch(err => {
        dispatch({ type: "CARD_ERRORED", id: activationId, error: err instanceof Error ? err.message : "Unknown error" });
        dispatch({ type: "ATTRIBUTION_VERIFY_DONE", id: attributionCardId });
      });
  };

  const handleSteerComponents = useCallback((sourceCardId: string, components: SteeringComponent[]) => {
    const sourceCard = stateRef.current.lensCards.find(c => c.id === sourceCardId);
    if (!sourceCard) return;

    let cleanPrompt: string;
    let corruptedPrompt: string;
    let targetPosition: number | "last";
    let targetToken: string | null;
    let modelName: string;
    let gpuTier: string | undefined;

    if (sourceCard.cardType === "attribution") {
      cleanPrompt = sourceCard.cleanPrompt;
      corruptedPrompt = sourceCard.corruptedPrompt;
      targetPosition = sourceCard.targetPosition;
      targetToken = sourceCard.targetToken;
      modelName = sourceCard.modelName;
      gpuTier = sourceCard.gpuTier;
    } else if (sourceCard.cardType === "activation") {
      const parentAttr = stateRef.current.lensCards.find(
        c => c.id === sourceCard.parentAttributionId && c.cardType === "attribution"
      ) as AttributionCardData | undefined;
      if (!parentAttr) return;
      cleanPrompt = sourceCard.cleanPrompt;
      corruptedPrompt = parentAttr.corruptedPrompt;
      targetPosition = parentAttr.targetPosition;
      targetToken = parentAttr.targetToken;
      modelName = sourceCard.modelName;
      gpuTier = sourceCard.gpuTier;
    } else {
      return;
    }

    const steeringId = crypto.randomUUID();
    const steeringCard: SteeringCardData = {
      id: steeringId,
      cardType: "steering",
      status: "loading",
      modelName,
      cleanPrompt,
      corruptedPrompt,
      targetPosition,
      targetToken,
      components,
      alpha: 1.0,
      nTokens: 20,
      parentCardId: sourceCardId,
      data: null,
      error: null,
      position: { x: sourceCard.position.x + 440, y: sourceCard.position.y },
      gpuTier,
      startedAt: Date.now(),
    };

    dispatch({ type: "ADD_CARD", card: steeringCard });

    fetch("/api/run-steering", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cleanPrompt, corruptedPrompt, modelName, gpuTier, targetPosition, components, alpha: 1.0, nTokens: 20 }),
    })
      .then(async (response) => {
        if (!response.ok || !response.body) {
          const err = await response.json().catch(() => ({})) as { error?: string; detail?: string };
          const message = response.status === 401
            ? (err.error ?? "Sign in to use medium and large models")
            : (err.detail ?? err.error ?? `Request failed (${response.status})`);
          dispatch({ type: "CARD_ERRORED", id: steeringId, error: message });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            const line = part.split("\n").find(l => l.startsWith("data: "));
            if (!line) continue;
            try {
              const event = JSON.parse(line.slice(6)) as { stage: string; data?: SteeringResult & { token?: string; index?: number }; error?: string };
              if (event.stage === "token" && event.data?.token !== undefined) {
                dispatch({ type: "STEERING_CARD_TOKEN", id: steeringId, token: event.data.token });
              } else if (event.stage === "done" && event.data) {
                dispatch({ type: "STEERING_CARD_RESOLVED", id: steeringId, data: event.data as SteeringResult });
                const pid = projectIdRef.current;
                if (pid) {
                  const existingResult = stateRef.current.lensCards.filter(c => c.status === "result").map(serializeCard);
                  updateProject(pid, [...existingResult, { id: steeringId, cardType: "steering" as const, modelName, prompt: cleanPrompt, corruptedPrompt, data: event.data as Record<string, unknown>, position: steeringCard.position, gpuTier, targetPosition, targetToken, components, alpha: 1.0, nTokens: 20, parentCardId: sourceCardId }], stateRef.current.canvas).catch(console.error);
                }
              } else if (event.stage === "error") {
                dispatch({ type: "CARD_ERRORED", id: steeringId, error: event.error ?? "Unknown error" });
              } else {
                dispatch({ type: "CARD_STAGE", id: steeringId, stage: event.stage });
              }
            } catch { /* malformed chunk */ }
          }
        }
      })
      .catch(err => dispatch({ type: "CARD_ERRORED", id: steeringId, error: err instanceof Error ? err.message : "Unknown error" }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRerunSteering = useCallback((cardId: string, newAlpha: number) => {
    const card = stateRef.current.lensCards.find(c => c.id === cardId && c.cardType === "steering") as SteeringCardData | undefined;
    if (!card) return;
    dispatch({ type: "STEERING_CARD_RERUN", id: cardId, alpha: newAlpha });
    const { modelName, cleanPrompt, corruptedPrompt, gpuTier, targetPosition, components } = card;
    fetch("/api/run-steering", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cleanPrompt, corruptedPrompt, modelName, gpuTier, targetPosition, components, alpha: newAlpha, nTokens: card.nTokens }),
    })
      .then(async (response) => {
        if (!response.ok || !response.body) {
          const err = await response.json().catch(() => ({})) as { error?: string; detail?: string };
          const message = response.status === 401
            ? (err.error ?? "Sign in to use medium and large models")
            : (err.detail ?? err.error ?? `Request failed (${response.status})`);
          dispatch({ type: "CARD_ERRORED", id: cardId, error: message });
          return;
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            const line = part.split("\n").find(l => l.startsWith("data: "));
            if (!line) continue;
            try {
              const event = JSON.parse(line.slice(6)) as { stage: string; data?: SteeringResult & { token?: string }; error?: string };
              if (event.stage === "token" && event.data?.token !== undefined) {
                dispatch({ type: "STEERING_CARD_TOKEN", id: cardId, token: event.data.token });
              } else if (event.stage === "done" && event.data) {
                dispatch({ type: "STEERING_CARD_RESOLVED", id: cardId, data: event.data as SteeringResult });
                const pid = projectIdRef.current;
                if (pid) {
                  const updatedCards = stateRef.current.lensCards.filter(c => c.status === "result").map(serializeCard);
                  updateProject(pid, updatedCards, stateRef.current.canvas).catch(console.error);
                }
              } else if (event.stage === "error") {
                dispatch({ type: "CARD_ERRORED", id: cardId, error: event.error ?? "Unknown error" });
              } else {
                dispatch({ type: "CARD_STAGE", id: cardId, stage: event.stage });
              }
            } catch { /* malformed chunk */ }
          }
        }
      })
      .catch(err => dispatch({ type: "CARD_ERRORED", id: cardId, error: err instanceof Error ? err.message : "Unknown error" }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddStandaloneSteer = useCallback(({ modelName, cleanPrompt, corruptedPrompt, gpuTier, targetPosition, injectionLayer }: {
    modelName: string;
    cleanPrompt: string;
    corruptedPrompt: string;
    gpuTier?: string;
    targetPosition: number | "last";
    injectionLayer: number;
  }) => {
    setSteeringOpen(false);
    const components: SteeringComponent[] = [{ layer: injectionLayer, head: null, injectionType: "residual" }];
    const steeringId = crypto.randomUUID();
    const steeringCard: SteeringCardData = {
      id: steeringId,
      cardType: "steering",
      status: "loading",
      modelName,
      cleanPrompt,
      corruptedPrompt,
      targetPosition,
      targetToken: null,
      components,
      alpha: 1.0,
      nTokens: 20,
      parentCardId: "",
      data: null,
      error: null,
      position: autoArrangePos(stateRef.current.lensCards.length),
      gpuTier,
      startedAt: Date.now(),
    };
    dispatch({ type: "ADD_CARD", card: steeringCard });

    fetch("/api/run-steering", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cleanPrompt, corruptedPrompt, modelName, gpuTier, targetPosition, components, alpha: 1.0, nTokens: 20 }),
    })
      .then(async (response) => {
        if (!response.ok || !response.body) {
          const err = await response.json().catch(() => ({})) as { error?: string; detail?: string };
          const message = response.status === 401
            ? (err.error ?? "Sign in to use medium and large models")
            : (err.detail ?? err.error ?? `Request failed (${response.status})`);
          dispatch({ type: "CARD_ERRORED", id: steeringId, error: message });
          return;
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            const line = part.split("\n").find(l => l.startsWith("data: "));
            if (!line) continue;
            try {
              const event = JSON.parse(line.slice(6)) as { stage: string; data?: SteeringResult & { token?: string; index?: number }; error?: string };
              if (event.stage === "token" && event.data?.token !== undefined) {
                dispatch({ type: "STEERING_CARD_TOKEN", id: steeringId, token: event.data.token });
              } else if (event.stage === "done" && event.data) {
                dispatch({ type: "STEERING_CARD_RESOLVED", id: steeringId, data: event.data as SteeringResult });
                const pid = projectIdRef.current;
                if (pid) {
                  const existingResult = stateRef.current.lensCards.filter(c => c.status === "result").map(serializeCard);
                  updateProject(pid, [...existingResult, { id: steeringId, cardType: "steering" as const, modelName, prompt: cleanPrompt, corruptedPrompt, data: event.data as Record<string, unknown>, position: steeringCard.position, gpuTier, targetPosition, targetToken: null, components, alpha: 1.0, nTokens: 20, parentCardId: "" }], stateRef.current.canvas).catch(console.error);
                }
              } else if (event.stage === "error") {
                dispatch({ type: "CARD_ERRORED", id: steeringId, error: event.error ?? "Unknown error" });
              } else {
                dispatch({ type: "CARD_STAGE", id: steeringId, stage: event.stage });
              }
            } catch { /* malformed chunk */ }
          }
        }
      })
      .catch(err => dispatch({ type: "CARD_ERRORED", id: steeringId, error: err instanceof Error ? err.message : "Unknown error" }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleNew() {
    if (!session?.user) return;
    setProjectsOpen(false);
    const { id } = await createProject([], state.canvas);
    setProjectId(id);
    setProjectName("Untitled Project");
    dispatch({ type: "RESET_CANVAS" });
    router.replace(`/projects?id=${id}`);
    setNameEditing(true);
  }

  async function handleRename(newName: string) {
    const trimmed = newName.trim() || "Untitled Project";
    setProjectName(trimmed);
    setNameEditing(false);
    if (!projectId) return;
    const resultCards = state.lensCards.filter(c => c.status === "result").map(serializeCard);
    updateProject(projectId, resultCards, state.canvas, trimmed).catch(console.error);
  }

  async function handleDuplicate() {
    if (!session?.user) return;
    setProjectsOpen(false);
    const resultCards = state.lensCards.filter(c => c.status === "result").map(serializeCard);
    const { id } = await duplicateProject(resultCards, state.canvas);
    setProjectId(id);
    router.replace(`/projects?id=${id}`);
  }

  async function handleDeleteConfirmed() {
    if (!projectId) return;
    await deleteProject(projectId);
    setProjectId(null);
    setDeleteConfirming(false);
    dispatch({ type: "RESET_CANVAS" });
    router.replace("/projects");
  }

  async function handleShare() {
    if (!projectId || !session?.user) return;
    setProjectsOpen(false);
    const { shareId: id } = await setProjectShare(projectId);
    setShareId(id);
    await navigator.clipboard.writeText(`${window.location.origin}/share/${id}`);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
  }

  async function handleExport(cardId: string, modelName: string, prompt: string) {
    const el = document.querySelector(`[data-card-id="${cardId}"]`) as HTMLElement | null;
    if (!el) return;
    setExportingId(cardId);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(el, {
        pixelRatio: 3,
        width: el.offsetWidth,
        height: el.offsetHeight,
        style: { position: "relative", left: "0", top: "0" },
      });
      const link = document.createElement("a");
      link.download = `${modelName.split("/").pop()}-${prompt.slice(0, 24).replace(/\s+/g, "-")}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setExportingId(null);
    }
  }

  const loggedIn = !!session?.user;
  const resolvedCards = state.lensCards.filter(c => c.status === "result");
  const disabledStyle = { color: "var(--color-text-muted)" as const, cursor: "default" as const, opacity: 0.5 };
  const enabledStyle = { color: "var(--color-text)" as const, cursor: "pointer" as const, opacity: 1 };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--color-bg)" }}>
      <Navbar/>

      {/* Canvas area — relative so the "Add Lens +" button can float over it */}
      <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column" }}>
        {/* Floating buttons — top-left, over the canvas */}
        <div style={{ position: "absolute", top: 12, left: 12, zIndex: 35, display: "flex", gap: 8, alignItems: "center" }}>
          <div ref={addRef} style={{ position: "relative" }}>
            {/* "Add +" button */}
            <button
              onClick={() => { setAddOpen(o => !o); setConfigOpen(false); setDlaOpen(false); setAttributionOpen(false); setSteeringOpen(false); }}
              style={{
                background: (addOpen || configOpen || dlaOpen || attributionOpen || steeringOpen) ? "var(--color-accent-hover)" : "var(--color-accent)",
                color: "var(--color-accent-fg)",
                border: "none",
                borderRadius: 6,
                padding: "5px 10px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                transition: "background 150ms, box-shadow 150ms",
                display: "flex",
                alignItems: "center",
                gap: 6,
                letterSpacing: "0.01em",
              }}
              onMouseEnter={e => { if (!addOpen && !configOpen && !dlaOpen && !attributionOpen && !steeringOpen) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-accent-hover)"; }}
              onMouseLeave={e => { if (!addOpen && !configOpen && !dlaOpen && !attributionOpen && !steeringOpen) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-accent)"; }}
            >
              <span style={{ fontSize: 16, lineHeight: 1, marginTop: -1 }}>+</span>
              Add
            </button>

            {/* Dropdown — choose Logit Lens or DLA */}
            {addOpen && (
              <div style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                background: "var(--color-card)",
                border: "1px solid var(--color-card-border)",
                borderRadius: 6,
                boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
                display: "flex",
                flexDirection: "column",
                minWidth: 160,
                zIndex: 31,
                animation: "cfgDropIn 140ms ease-out",
              }}>
                <style>{`@keyframes cfgDropIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
                <button
                  onClick={() => { setAddOpen(false); setConfigOpen(true); setDlaOpen(false); setAttributionOpen(false); setSteeringOpen(false); }}
                  style={{ background: "var(--color-card)", border: "none", borderBottom: "1px solid var(--color-surface-border)", borderRadius: "6px 6px 0 0", padding: "10px 16px", fontSize: 13, fontWeight: 500, textAlign: "left", cursor: "pointer", color: "var(--color-text)", transition: "background 120ms", display: "flex", flexDirection: "column", gap: 2 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-border)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-card)"; }}
                >
                  <span>Logit Lens</span>
                  <span style={{ fontSize: 10, color: "var(--color-text-muted)", fontWeight: 400 }}>Layer-by-layer predictions</span>
                </button>
                <button
                  onClick={() => { setAddOpen(false); setDlaOpen(true); setConfigOpen(false); setAttributionOpen(false); setSteeringOpen(false); }}
                  style={{ background: "var(--color-card)", border: "none", borderBottom: "1px solid var(--color-surface-border)", borderRadius: 0, padding: "10px 16px", fontSize: 13, fontWeight: 500, textAlign: "left", cursor: "pointer", color: "var(--color-text)", transition: "background 120ms", display: "flex", flexDirection: "column", gap: 2 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-border)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-card)"; }}
                >
                  <span>DLA</span>
                  <span style={{ fontSize: 10, color: "var(--color-text-muted)", fontWeight: 400 }}>Direct attribution per component</span>
                </button>
                <button
                  onClick={() => { setAddOpen(false); setAttributionOpen(true); setConfigOpen(false); setDlaOpen(false); setSteeringOpen(false); }}
                  style={{ background: "var(--color-card)", border: "none", borderBottom: "1px solid var(--color-surface-border)", borderRadius: 0, padding: "10px 16px", fontSize: 13, fontWeight: 500, textAlign: "left", cursor: "pointer", color: "var(--color-text)", transition: "background 120ms", display: "flex", flexDirection: "column", gap: 2 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-border)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-card)"; }}
                >
                  <span>Attribution</span>
                  <span style={{ fontSize: 10, color: "var(--color-text-muted)", fontWeight: 400 }}>Map behavioral difference → verify causally</span>
                </button>
                <button
                  onClick={() => { setAddOpen(false); setSteeringOpen(true); setConfigOpen(false); setDlaOpen(false); setAttributionOpen(false); }}
                  style={{ background: "var(--color-card)", border: "none", borderRadius: "0 0 6px 6px", padding: "10px 16px", fontSize: 13, fontWeight: 500, textAlign: "left", cursor: "pointer", color: "var(--color-text)", transition: "background 120ms", display: "flex", flexDirection: "column", gap: 2 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-border)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-card)"; }}
                >
                  <span>Steer</span>
                  <span style={{ fontSize: 10, color: "var(--color-text-muted)", fontWeight: 400 }}>DIM vector injection from contrastive pair</span>
                </button>
              </div>
            )}

            <ConfigPane
              isOpen={configOpen}
              availableModels={availableModels}
              modelsLoading={modelsLoading}
              onSubmit={handleAddLens}
              onClose={() => setConfigOpen(false)}
            />
            <DlaConfigPane
              isOpen={dlaOpen}
              availableModels={availableModels}
              modelsLoading={modelsLoading}
              onSubmit={handleAddDla}
              onClose={() => setDlaOpen(false)}
            />
            <AttributionConfigPane
              isOpen={attributionOpen}
              availableModels={availableModels}
              modelsLoading={modelsLoading}
              onSubmit={handleAddAttribution}
              onClose={() => setAttributionOpen(false)}
            />
            <SteeringConfigPane
              isOpen={steeringOpen}
              availableModels={availableModels}
              modelsLoading={modelsLoading}
              onSubmit={handleAddStandaloneSteer}
              onClose={() => setSteeringOpen(false)}
            />
          </div>

          {/* Projects button + dropdown */}
          <div ref={projectsRef} style={{ position: "relative" }}>
            <button
              onClick={() => setProjectsOpen(o => !o)}
              style={{
                background: "var(--color-card)",
                color: "var(--color-text)",
                border: "1px solid var(--color-card-border)",
                borderRadius: 6,
                padding: "5px 10px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                transition: "background 150ms, border-color 150ms",
                letterSpacing: "0.01em",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-border)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-card)"; }}
            >
              Projects
            </button>

            {projectsOpen && (
              <div style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                background: "var(--color-card)",
                border: "1px solid var(--color-card-border)",
                borderRadius: 6,
                boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
                display: "flex",
                flexDirection: "column",
                minWidth: 160,
                overflow: "visible",
              }}>
                {/* Search */}
                <button
                  onClick={() => { setProjectsOpen(false); setSearchOpen(true); }}
                  style={{
                    background: "var(--color-card)",
                    border: "none",
                    borderBottom: "1px solid var(--color-surface-border)",
                    borderRadius: "6px 6px 0 0",
                    padding: "10px 16px",
                    fontSize: 13,
                    fontWeight: 500,
                    textAlign: "left",
                    transition: "background 120ms",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    ...(loggedIn ? enabledStyle : disabledStyle),
                  }}
                  disabled={!loggedIn}
                  title={loggedIn ? undefined : "Sign in to search projects"}
                  onMouseEnter={e => { if (loggedIn) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-border)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-card)"; }}
                >
                  <span>Search</span>
                  <kbd style={{
                    fontSize: 10,
                    fontFamily: "var(--font-azeret-mono), monospace",
                    background: "var(--color-surface-border)",
                    color: "var(--color-text-muted)",
                    border: "1px solid var(--color-card-border)",
                    borderRadius: 3,
                    padding: "0 4px",
                    lineHeight: "16px",
                  }}>⌘K</kbd>
                </button>

                {/* New */}
                <button
                  onClick={handleNew}
                  disabled={!loggedIn}
                  title={loggedIn ? undefined : "Sign in to save projects"}
                  style={{
                    background: "var(--color-card)",
                    border: "none",
                    borderBottom: "1px solid var(--color-surface-border)",
                    padding: "10px 16px",
                    fontSize: 13,
                    fontWeight: 500,
                    textAlign: "left",
                    transition: "background 120ms",
                    ...(loggedIn ? enabledStyle : disabledStyle),
                  }}
                  onMouseEnter={e => { if (loggedIn) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-border)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-card)"; }}
                >
                  New
                </button>

                {/* Duplicate */}
                <button
                  onClick={handleDuplicate}
                  disabled={!loggedIn}
                  title={loggedIn ? undefined : "Sign in to save projects"}
                  style={{
                    background: "var(--color-card)",
                    border: "none",
                    borderBottom: "1px solid var(--color-surface-border)",
                    padding: "10px 16px",
                    fontSize: 13,
                    fontWeight: 500,
                    textAlign: "left",
                    transition: "background 120ms",
                    ...(loggedIn ? enabledStyle : disabledStyle),
                  }}
                  onMouseEnter={e => { if (loggedIn) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-border)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-card)"; }}
                >
                  Duplicate
                </button>

                {/* Export — submenu to the right */}
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setExportOpen(o => !o)}
                    disabled={!resolvedCards.length}
                    style={{
                      width: "100%",
                      background: "var(--color-card)",
                      border: "none",
                      borderBottom: "1px solid var(--color-surface-border)",
                      padding: "10px 16px",
                      fontSize: 13,
                      fontWeight: 500,
                      textAlign: "left",
                      transition: "background 120ms",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      ...(!resolvedCards.length ? disabledStyle : enabledStyle),
                    }}
                    onMouseEnter={e => { if (resolvedCards.length) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-border)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-card)"; }}
                  >
                    <span>Export</span>
                    <span style={{ fontSize: 10, opacity: 0.5 }}>▶</span>
                  </button>

                  {exportOpen && resolvedCards.length > 0 && (
                    <div style={{
                      position: "absolute",
                      top: 0,
                      left: "calc(100% + 6px)",
                      background: "var(--color-card)",
                      border: "1px solid var(--color-card-border)",
                      borderRadius: 6,
                      boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
                      display: "flex",
                      flexDirection: "column",
                      minWidth: 220,
                      maxHeight: 320,
                      overflowY: "auto",
                      zIndex: 10,
                    }}>
                      {resolvedCards.map((card, i) => (
                        <button
                          key={card.id}
                          onClick={() => handleExport(card.id, card.modelName, getCardPrompt(card))}
                          disabled={exportingId === card.id}
                          style={{
                            background: "var(--color-card)",
                            border: "none",
                            borderBottom: i < resolvedCards.length - 1 ? "1px solid var(--color-surface-border)" : "none",
                            padding: "9px 14px",
                            fontSize: 12,
                            textAlign: "left",
                            cursor: exportingId === card.id ? "default" : "pointer",
                            transition: "background 120ms",
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                            opacity: exportingId === card.id ? 0.5 : 1,
                          }}
                          onMouseEnter={e => { if (!exportingId) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-border)"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-card)"; }}
                        >
                          <span style={{ fontWeight: 600, color: "var(--color-text)", fontFamily: "var(--font-azeret-mono), monospace", fontSize: 11 }}>
                            {card.modelName.split("/").pop()}
                          </span>
                          <span style={{ color: "var(--color-text-muted)", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 192 }}>
                            {exportingId === card.id ? "Exporting…" : getCardPrompt(card)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Share */}
                <button
                  onClick={handleShare}
                  disabled={!loggedIn || !projectId}
                  title={!loggedIn ? "Sign in to share" : !projectId ? "Save a project first" : shareId ? "Copy share link" : "Generate share link"}
                  style={{
                    background: "var(--color-card)",
                    border: "none",
                    borderBottom: "1px solid var(--color-surface-border)",
                    padding: "10px 16px",
                    fontSize: 13,
                    fontWeight: 500,
                    textAlign: "left",
                    transition: "background 120ms",
                    ...(!loggedIn || !projectId ? disabledStyle : enabledStyle),
                  }}
                  onMouseEnter={e => { if (loggedIn && projectId) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-border)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-card)"; }}
                >
                  {shareId ? "Copy link" : "Share"}
                </button>

                {/* Delete — inline confirmation */}
                {deleteConfirming ? (
                  <div style={{ display: "flex", borderTop: "1px solid var(--color-surface-border)" }}>
                    <button
                      onClick={() => setDeleteConfirming(false)}
                      style={{
                        flex: 1,
                        background: "var(--color-card)",
                        color: "var(--color-text-muted)",
                        border: "none",
                        borderRight: "1px solid var(--color-surface-border)",
                        borderRadius: "0 0 0 6px",
                        padding: "10px 12px",
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: "pointer",
                        transition: "background 120ms",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-border)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-card)"; }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteConfirmed}
                      style={{
                        flex: 1,
                        background: "var(--color-card)",
                        color: "#dc2626",
                        border: "none",
                        borderRadius: "0 0 6px 0",
                        padding: "10px 12px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "background 120ms",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-border)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-card)"; }}
                    >
                      Confirm
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (!loggedIn || !projectId) return;
                      setDeleteConfirming(true);
                    }}
                    disabled={!loggedIn || !projectId}
                    title={
                      !loggedIn
                        ? "Sign in to save projects"
                        : !projectId
                        ? "No saved project to delete"
                        : undefined
                    }
                    style={{
                      background: "var(--color-card)",
                      border: "none",
                      borderRadius: "0 0 6px 6px",
                      padding: "10px 16px",
                      fontSize: 13,
                      fontWeight: 500,
                      textAlign: "left",
                      transition: "background 120ms",
                      color: loggedIn && projectId ? "#dc2626" : "var(--color-text-muted)",
                      cursor: loggedIn && projectId ? "pointer" : "default",
                      opacity: loggedIn && projectId ? 1 : 0.4,
                    }}
                    onMouseEnter={e => { if (loggedIn && projectId) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-border)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-card)"; }}
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Inline project name — only shown when a project is loaded */}
          {projectId && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              paddingLeft: 10,
              borderLeft: "1px solid var(--color-card-border)",
            }}>
              {nameEditing ? (
                <input
                  ref={nameInputRef}
                  defaultValue={projectName}
                  onKeyDown={e => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") { setNameEditing(false); }
                  }}
                  onBlur={e => handleRename(e.target.value)}
                  style={{
                    border: "1px solid var(--color-accent)",
                    borderRadius: 5,
                    padding: "3px 8px",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--color-text)",
                    background: "var(--color-bg)",
                    outline: "none",
                    minWidth: 100,
                    maxWidth: 220,
                    fontFamily: "inherit",
                  }}
                />
              ) : (
                <button
                  onClick={() => setNameEditing(true)}
                  title="Rename project"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "text",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--color-text)",
                    padding: "3px 6px",
                    borderRadius: 5,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    maxWidth: 220,
                    transition: "background 120ms",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-border)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = "none";
                  }}
                >
                  <span style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: 190,
                    display: "block",
                  }}>
                    {projectName}
                  </span>
                  {/* Pencil icon */}
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--color-text-muted)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0 }}
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>

        <ProjectSearch
          isOpen={searchOpen}
          currentProjectId={projectId}
          onClose={() => setSearchOpen(false)}
          onSelect={id => { setSearchOpen(false); loadAndSetProject(id); }}
        />

        <SandboxCanvas
          cards={state.lensCards}
          canvasState={state.canvas}
          onCanvasChange={canvas => dispatch({ type: "SET_CANVAS", canvas })}
          onMoveCard={(id, position) => dispatch({ type: "MOVE_CARD", id, position })}
          onRemoveCard={id => dispatch({ type: "REMOVE_CARD", id })}
          onVerifyTopK={handleVerifyTopK}
          onSteerComponents={handleSteerComponents}
          onRerunSteering={handleRerunSteering}
        />

      </div>

      {shareCopied && (
        <div style={{
          position: "fixed",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          background: "var(--color-accent)",
          color: "var(--color-accent-fg)",
          padding: "8px 18px",
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 500,
          zIndex: 1000,
          boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
          pointerEvents: "none",
        }}>
          Link copied to clipboard
        </div>
      )}
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense>
      <Projects />
    </Suspense>
  );
}
