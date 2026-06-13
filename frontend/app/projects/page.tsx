"use client";

import { useState, useEffect, useReducer, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import SandboxCanvas from "../components/SandboxCanvas";
import ConfigPane from "../components/ConfigPane";
import DlaConfigPane from "../components/DlaConfigPane";
import AttributionConfigPane from "../components/AttributionConfigPane";
import SteeringConfigPane from "../components/SteeringConfigPane";
import AttentionConfigPane from "../components/AttentionConfigPane";
import Navbar from "../components/Navbar";
import { ProjectSearch } from "../components/ProjectSearch";
import type { LensCardData } from "../components/LensCard";
import type { DlaCardData } from "../components/DlaCard";
import type { AttributionCardData } from "../components/AttributionCard";
import type { ActivationCardData } from "../components/ActivationCard";
import type { SteeringCardData, SteeringComponent } from "../components/SteeringCard";
import type { EntropyCardData } from "../components/EntropyCard";
import type { AttentionCardData, AttentionData } from "../components/AttentionCard";
import { useSession } from "../lib/auth-client";
import type { ModelInfo } from "../hooks/useModelSelection";
import {
  createProject,
  duplicateProject,
  deleteProject,
  loadProject,
  updateProject,
  setProjectShare,
} from "../actions";
import { useJobHandlers } from "./hooks/useJobHandlers";
import { useSteeringHandlers } from "./hooks/useSteeringHandlers";
import type { AppAction, AppState, AnyCard } from "./types";
import { serializeCard, getCardPrompt } from "./helpers";

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
        lensCards: state.lensCards.map(c => {
          if (c.id === action.id && c.cardType === action.cardType) {
            return { ...c, status: "result" as const, data: action.data } as AnyCard;
          }
          // Resolving an activation card also completes its parent attribution's verify flow
          if (action.cardType === "activation" && c.id === action.parentAttributionId && c.cardType === "attribution")
            return { ...c, verifyStatus: "done" as const };
          return c;
        }),
      };
    case "ATTRIBUTION_VERIFY_STARTED":
      return {
        ...state,
        lensCards: state.lensCards.map(c =>
          c.id === action.id && c.cardType === "attribution"
            ? { ...c, verifyStatus: "loading" as const } : c
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
          c.id === action.id && c.cardType !== "entropy" ? { ...c, status: "error" as const, error: action.error, showBuyCredits: action.showBuyCredits } : c
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
    case "STEERING_CARD_RERUN":
      return {
        ...state,
        lensCards: state.lensCards.map(c =>
          c.id === action.id && c.cardType === "steering"
            ? { ...c, status: "loading" as const, data: null, error: null, alpha: action.alpha, startedAt: Date.now() } : c
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

// Which floating pane is open under the "Add" button: the add dropdown itself
// or one of the five technique config panes. Mutually exclusive by construction.
type PaneId = "add" | "lens" | "dla" | "attribution" | "steering" | "attention";

const ADD_MENU_ITEMS: Array<{ pane: PaneId; label: string; description: string }> = [
  { pane: "lens",        label: "Logit Lens",  description: "Layer-by-layer predictions" },
  { pane: "dla",         label: "DLA",         description: "Direct attribution per component" },
  { pane: "attribution", label: "Attribution", description: "Map behavioral difference → verify causally" },
  { pane: "steering",    label: "Steer",       description: "DIM vector injection from contrastive pair" },
  { pane: "attention",   label: "Attention",   description: "Per-head attention weight matrices" },
];

/** One row of the Projects dropdown: shared style + hover/disabled handling. */
function MenuItem({ onClick, disabled, title, radius, last, danger, children }: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  radius?: string;
  last?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  const enabled = !disabled;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: "100%",
        background: "var(--card)",
        border: "none",
        borderBottom: last ? "none" : "1px solid var(--surface-border)",
        borderRadius: radius ?? 0,
        padding: "10px 16px",
        fontSize: 13,
        fontWeight: 500,
        textAlign: "left",
        transition: "background 120ms",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        color: enabled ? (danger ? "#dc2626" : "var(--text)") : "var(--text-muted)",
        cursor: enabled ? "pointer" : "default",
        opacity: enabled ? 1 : danger ? 0.4 : 0.5,
      }}
      onMouseEnter={e => { if (enabled) e.currentTarget.style.background = "var(--surface-border)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "var(--card)"; }}
    >
      {children}
    </button>
  );
}

function Projects() {
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [openPane, setOpenPane] = useState<PaneId | null>(null);
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
  const [creditsToast, setCreditsToast] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);
  const projectsRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [state, dispatch] = useReducer(appReducer, initialState);
  const projectIdRef = useRef<string | null>(null);
  const stateRef = useRef(state);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();
  const jobHandlers = useJobHandlers({ dispatch, projectIdRef, stateRef });
  const steeringHandlers = useSteeringHandlers({ dispatch, projectIdRef, stateRef });

  useEffect(() => {
    if (!sessionPending && !session?.user) {
      router.replace("/");
    }
  }, [sessionPending, session, router]);

  useEffect(() => {
    if (searchParams.get("credits") !== "success") return;
    window.dispatchEvent(new CustomEvent("credits-updated"));
    setCreditsToast(true);
    router.replace("/projects" + (searchParams.get("id") ? `?id=${searchParams.get("id")}` : ""));
    const t = setTimeout(() => setCreditsToast(false), 4000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close add dropdown + sub-panes on outside click
  useEffect(() => {
    if (openPane === null) return;
    function handleClickOutside(e: MouseEvent) {
      if (addRef.current && !addRef.current.contains(e.target as Node)) {
        setOpenPane(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openPane]);

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
            generationPrompt: c.generationPrompt ?? "",
            targetPosition: c.targetPosition ?? "last", targetToken: c.targetToken ?? null,
            components: (c.components ?? []) as SteeringComponent[],
            alpha: c.alpha ?? 1.0, temperature: c.temperature ?? 1.0, repetitionPenalty: c.repetitionPenalty ?? 1.3, nTokens: c.nTokens ?? 50, nPairs: c.nPairs ?? 1,
            extraPairs: c.extraPairs ?? [],
            parentCardId: c.parentCardId ?? "",
          } as unknown as SteeringCardData;
        }
        if (c.cardType === "entropy") {
          return {
            ...c,
            cardType: "entropy" as const,
            status: "result" as const,
            parentLensId: c.parentLensId ?? "",
            entropyData: (c.entropyData ?? []) as number[][],
            xLabels: (c.xLabels ?? []) as string[],
            yLabels: (c.yLabels ?? []) as string[],
          } as EntropyCardData;
        }
        if (c.cardType === "attention-pattern") {
          return {
            ...c,
            cardType: "attention-pattern" as const,
            status: "result" as const,
            error: null,
            data: (c.data ?? null) as AttentionData | null,
          } as AttentionCardData;
        }
        return { ...c, cardType: "logit-lens" as const, status: "result" as const, error: null, topK: c.topK ?? 5 } as LensCardData;
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

  // Keep refs in sync so async job callbacks always read latest values
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
    fetch("/api/models")
      .then(r => r.json())
      .then(models => setAvailableModels(models))
      .catch(() => setAvailableModels([{ id: "gpt2-small", display_name: "GPT-2 Small", description: "Classic 12-layer baseline, fast cold starts.", requires_hf_token: false, gpu_tier: "tl_small" }]))
      .finally(() => setModelsLoading(false));
  }, []);

  const handleAddLens = (args: Parameters<typeof jobHandlers.addLens>[0]) => {
    setOpenPane(null);
    jobHandlers.addLens(args);
  };

  const handleAddDla = (args: Parameters<typeof jobHandlers.addDla>[0]) => {
    setOpenPane(null);
    jobHandlers.addDla(args);
  };

  const handleAddAttribution = (args: Parameters<typeof jobHandlers.addAttribution>[0]) => {
    setOpenPane(null);
    jobHandlers.addAttribution(args);
  };

  const handleAddStandaloneSteer = (args: Parameters<typeof steeringHandlers.addStandaloneSteer>[0]) => {
    setOpenPane(null);
    steeringHandlers.addStandaloneSteer(args);
  };

  const handleAddAttn = (args: Parameters<typeof jobHandlers.addAttn>[0]) => {
    setOpenPane(null);
    jobHandlers.addAttn(args);
  };

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

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      <Navbar />

      {creditsToast && (
        <div style={{
          position: "fixed",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          background: "var(--card)",
          border: "1px solid var(--card-border)",
          borderRadius: 8,
          padding: "10px 18px",
          fontSize: 12,
          fontFamily: "var(--font-ibm-plex-sans), sans-serif",
          color: "var(--text)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          zIndex: 300,
          whiteSpace: "nowrap",
        }}>
          Credits added successfully
        </div>
      )}

      {/* Canvas area — relative so the "Add Lens +" button can float over it */}
      <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column" }}>
        {/* Floating buttons — top-left, over the canvas */}
        <div style={{ position: "absolute", top: 12, left: 12, zIndex: 35, display: "flex", gap: 8, alignItems: "center" }}>
          <div ref={addRef} style={{ position: "relative" }}>
            {/* "Add +" button */}
            <button
              onClick={() => setOpenPane(p => (p === null ? "add" : null))}
              style={{
                background: openPane !== null ? "var(--accent-hover)" : "var(--accent)",
                color: "var(--accent-fg)",
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
              onMouseEnter={e => { if (openPane === null) e.currentTarget.style.background = "var(--accent-hover)"; }}
              onMouseLeave={e => { if (openPane === null) e.currentTarget.style.background = "var(--accent)"; }}
            >
              <span style={{ fontSize: 16, lineHeight: 1, marginTop: -1 }}>+</span>
              Add
            </button>

            {/* Dropdown — choose a technique */}
            {openPane === "add" && (
              <div style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                background: "var(--card)",
                border: "1px solid var(--card-border)",
                borderRadius: 6,
                boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
                display: "flex",
                flexDirection: "column",
                minWidth: 160,
                zIndex: 31,
                animation: "cfgDropIn 140ms ease-out",
              }}>
                {ADD_MENU_ITEMS.map((item, i) => (
                  <button
                    key={item.pane}
                    onClick={() => setOpenPane(item.pane)}
                    style={{
                      background: "var(--card)",
                      border: "none",
                      borderBottom: i < ADD_MENU_ITEMS.length - 1 ? "1px solid var(--surface-border)" : "none",
                      borderRadius: i === 0 ? "6px 6px 0 0" : i === ADD_MENU_ITEMS.length - 1 ? "0 0 6px 6px" : 0,
                      padding: "10px 16px", fontSize: 13, fontWeight: 500, textAlign: "left", cursor: "pointer",
                      color: "var(--text)", transition: "background 120ms", display: "flex", flexDirection: "column", gap: 2,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-border)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "var(--card)"; }}
                  >
                    <span>{item.label}</span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 400 }}>{item.description}</span>
                  </button>
                ))}
              </div>
            )}

            <ConfigPane
              isOpen={openPane === "lens"}
              availableModels={availableModels}
              modelsLoading={modelsLoading}
              onSubmit={handleAddLens}
              onClose={() => setOpenPane(null)}
            />
            <DlaConfigPane
              isOpen={openPane === "dla"}
              availableModels={availableModels}
              modelsLoading={modelsLoading}
              onSubmit={handleAddDla}
              onClose={() => setOpenPane(null)}
            />
            <AttributionConfigPane
              isOpen={openPane === "attribution"}
              availableModels={availableModels}
              modelsLoading={modelsLoading}
              onSubmit={handleAddAttribution}
              onClose={() => setOpenPane(null)}
            />
            <SteeringConfigPane
              isOpen={openPane === "steering"}
              availableModels={availableModels}
              modelsLoading={modelsLoading}
              onSubmit={handleAddStandaloneSteer}
              onClose={() => setOpenPane(null)}
            />
            <AttentionConfigPane
              isOpen={openPane === "attention"}
              availableModels={availableModels}
              modelsLoading={modelsLoading}
              onSubmit={handleAddAttn}
              onClose={() => setOpenPane(null)}
            />
          </div>

          {/* Projects button + dropdown */}
          <div ref={projectsRef} style={{ position: "relative" }}>
            <button
              onClick={() => setProjectsOpen(o => !o)}
              style={{
                background: "var(--card)",
                color: "var(--text)",
                border: "1px solid var(--card-border)",
                borderRadius: 6,
                padding: "5px 10px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                transition: "background 150ms, border-color 150ms",
                letterSpacing: "0.01em",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-border)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--card)"; }}
            >
              Projects
            </button>

            {projectsOpen && (
              <div style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                background: "var(--card)",
                border: "1px solid var(--card-border)",
                borderRadius: 6,
                boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
                display: "flex",
                flexDirection: "column",
                minWidth: 160,
                overflow: "visible",
              }}>
                <MenuItem
                  onClick={() => { setProjectsOpen(false); setSearchOpen(true); }}
                  disabled={!loggedIn}
                  title={loggedIn ? undefined : "Sign in to search projects"}
                  radius="6px 6px 0 0"
                >
                  <span>Search</span>
                  <kbd style={{
                    fontSize: 10,
                    fontFamily: "var(--font-ibm-plex-sans), sans-serif",
                    background: "var(--surface-border)",
                    color: "var(--text-muted)",
                    border: "1px solid var(--card-border)",
                    borderRadius: 3,
                    padding: "0 4px",
                    lineHeight: "16px",
                  }}>⌘K</kbd>
                </MenuItem>

                <MenuItem onClick={handleNew} disabled={!loggedIn} title={loggedIn ? undefined : "Sign in to save projects"}>
                  New
                </MenuItem>

                <MenuItem onClick={handleDuplicate} disabled={!loggedIn} title={loggedIn ? undefined : "Sign in to save projects"}>
                  Duplicate
                </MenuItem>

                {/* Export — submenu to the right */}
                <div style={{ position: "relative" }}>
                  <MenuItem onClick={() => setExportOpen(o => !o)} disabled={!resolvedCards.length}>
                    <span>Export</span>
                    <span style={{ fontSize: 10, opacity: 0.5 }}>▶</span>
                  </MenuItem>

                  {exportOpen && resolvedCards.length > 0 && (
                    <div style={{
                      position: "absolute",
                      top: 0,
                      left: "calc(100% + 6px)",
                      background: "var(--card)",
                      border: "1px solid var(--card-border)",
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
                            background: "var(--card)",
                            border: "none",
                            borderBottom: i < resolvedCards.length - 1 ? "1px solid var(--surface-border)" : "none",
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
                          onMouseEnter={e => { if (!exportingId) (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-border)"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--card)"; }}
                        >
                          <span style={{ fontWeight: 600, color: "var(--text)", fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 11 }}>
                            {card.modelName.split("/").pop()}
                          </span>
                          <span style={{ color: "var(--text-muted)", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 192 }}>
                            {exportingId === card.id ? "Exporting…" : getCardPrompt(card)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <MenuItem
                  onClick={handleShare}
                  disabled={!loggedIn || !projectId}
                  title={!loggedIn ? "Sign in to share" : !projectId ? "Save a project first" : shareId ? "Copy share link" : "Generate share link"}
                >
                  {shareId ? "Copy link" : "Share"}
                </MenuItem>

                {/* Delete — inline confirmation */}
                {deleteConfirming ? (
                  <div style={{ display: "flex", borderTop: "1px solid var(--surface-border)" }}>
                    <button
                      onClick={() => setDeleteConfirming(false)}
                      style={{
                        flex: 1,
                        background: "var(--card)",
                        color: "var(--text-muted)",
                        border: "none",
                        borderRight: "1px solid var(--surface-border)",
                        borderRadius: "0 0 0 6px",
                        padding: "10px 12px",
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: "pointer",
                        transition: "background 120ms",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-border)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--card)"; }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteConfirmed}
                      style={{
                        flex: 1,
                        background: "var(--card)",
                        color: "#dc2626",
                        border: "none",
                        borderRadius: "0 0 6px 0",
                        padding: "10px 12px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "background 120ms",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-border)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--card)"; }}
                    >
                      Confirm
                    </button>
                  </div>
                ) : (
                  <MenuItem
                    onClick={() => setDeleteConfirming(true)}
                    disabled={!loggedIn || !projectId}
                    title={!loggedIn ? "Sign in to save projects" : !projectId ? "No saved project to delete" : undefined}
                    radius="0 0 6px 6px"
                    last
                    danger
                  >
                    Delete
                  </MenuItem>
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
              borderLeft: "1px solid var(--card-border)",
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
                    border: "1px solid var(--accent)",
                    borderRadius: 5,
                    padding: "3px 8px",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--text)",
                    background: "var(--bg)",
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
                    color: "var(--text)",
                    padding: "3px 6px",
                    borderRadius: 5,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    maxWidth: 220,
                    transition: "background 120ms",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-border)";
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
                    stroke="var(--text-muted)"
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
          onVerifyTopK={jobHandlers.verifyTopK}
          onSteerComponents={steeringHandlers.steerComponents}
          onRerunSteering={steeringHandlers.rerunSteering}
          onSpawnEntropyCard={jobHandlers.spawnEntropyCard}
        />

      </div>

      {shareCopied && (
        <div style={{
          position: "fixed",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          background: "var(--accent)",
          color: "var(--accent-fg)",
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
