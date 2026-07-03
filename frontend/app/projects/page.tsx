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
import { TactileButton } from "../components/ui/TactileButton";
import type { LensCardData } from "../components/LensCard";
import type { DlaCardData } from "../components/DlaCard";
import type { AttributionCardData } from "../components/AttributionCard";
import type { ActivationCardData } from "../components/ActivationCard";
import type { SteeringCardData, SteeringComponent } from "../components/SteeringCard";
import type { AttentionCardData, AttentionData } from "../components/AttentionCard";
import { useSession } from "../lib/auth-client";
import { cn } from "../lib/cn";
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
import { cancelCardJob } from "./hooks/job-runner";
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
          c.id === action.id ? { ...c, status: "error" as const, error: action.error, showBuyCredits: action.showBuyCredits, showVerifyCard: action.showVerifyCard } : c
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
      className={cn(
        "flex w-full items-center justify-between border-x-0 border-t-0 px-4 py-2.5 text-left text-[13px] font-medium transition-colors",
        last ? "border-b-0" : "border-b border-surface-border",
        enabled
          ? cn("cursor-pointer bg-card hover:bg-surface-border", danger ? "text-red-600" : "text-foreground")
          : cn("cursor-default bg-card text-muted", danger ? "opacity-40" : "opacity-50"),
      )}
      style={{ borderRadius: radius ?? 0 }}
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
  // In-flight lazy-create promise: dedupes concurrent first-writes so an
  // untitled draft yields exactly one row. Reset to null on every project switch.
  const creatingRef = useRef<Promise<string> | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();

  // Lazily materialize the draft into a DB row the first time it has something
  // worth saving (a resolved card or a real rename). Opening /projects shows an
  // untitled draft immediately but writes nothing until then — so abandoned
  // drafts never leave an empty row behind.
  const ensureProject = useCallback((): Promise<string> => {
    if (projectIdRef.current) return Promise.resolve(projectIdRef.current);
    if (creatingRef.current) return creatingRef.current;
    creatingRef.current = createProject([], stateRef.current.canvas).then(({ id }) => {
      projectIdRef.current = id;
      setProjectId(id);
      router.replace(`/projects?id=${id}`);
      return id;
    });
    return creatingRef.current;
  }, [router]);

  const jobHandlers = useJobHandlers({ dispatch, stateRef, ensureProject });
  const steeringHandlers = useSteeringHandlers({ dispatch, stateRef, ensureProject });

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
    creatingRef.current = null;
    projectIdRef.current = id;
    setProjectId(id);
    router.replace(`/projects?id=${id}`);
    try {
      const result = await loadProject(id);
      if (!result) { router.replace("/projects"); return; }
      const lensCards: AnyCard[] = result.cards.filter(c => c.cardType !== "entropy").map(c => {
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
          } as unknown as SteeringCardData;
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

  // "New" just resets to a fresh untitled draft — the row is created lazily by
  // ensureProject once the draft gets a card or a real name (see mount note).
  function handleNew() {
    if (!session?.user) return;
    setProjectsOpen(false);
    creatingRef.current = null;
    projectIdRef.current = null;
    setProjectId(null);
    setProjectName("Untitled Project");
    setShareId(null);
    dispatch({ type: "RESET_CANVAS" });
    router.replace("/projects");
  }

  async function handleRename(newName: string) {
    const trimmed = newName.trim() || "Untitled Project";
    setProjectName(trimmed);
    setNameEditing(false);
    // Renaming a still-pristine draft to the default name is a no-op — don't
    // materialize an empty row for it. A real name is intent to keep, so create.
    if (!projectIdRef.current && trimmed === "Untitled Project") return;
    const id = await ensureProject();
    const resultCards = stateRef.current.lensCards.filter(c => c.status === "result").map(serializeCard);
    updateProject(id, resultCards, stateRef.current.canvas, trimmed).catch(console.error);
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
    creatingRef.current = null;
    projectIdRef.current = null;
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
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />

      {creditsToast && (
        <div className="fixed bottom-6 left-1/2 z-[300] -translate-x-1/2 whitespace-nowrap rounded-lg border border-card-border bg-card px-[18px] py-2.5 text-xs text-foreground shadow-[0_4px_20px_rgba(0,0,0,0.15)]">
          Credits added successfully
        </div>
      )}

      {/* Canvas area — relative so the "Add Lens +" button can float over it */}
      <div className="relative flex flex-1 flex-col">
        {/* Floating buttons — top-left, over the canvas */}
        <div className="absolute left-3 top-3 z-[35] flex items-center gap-3">
          <div ref={addRef} className="relative">
            {/* "Add +" button */}
            <TactileButton
              variant="primary"
              onClick={() => setOpenPane(p => (p === null ? "add" : null))}
              faceClassName={cn(
                "gap-1.5 px-2.5 py-[5px] text-[13px] tracking-[0.01em]",
                openPane !== null && "bg-accent-hover",
              )}
            >
              <span className="-mt-px text-base leading-none">+</span>
              Add
            </TactileButton>

            {/* Dropdown — choose a technique */}
            {openPane === "add" && (
              <div className="absolute left-0 top-[calc(100%+6px)] z-[31] flex min-w-40 animate-cfg-drop-in flex-col rounded-md border border-card-border bg-card shadow-[0_4px_16px_rgba(0,0,0,0.10)]">
                {ADD_MENU_ITEMS.map((item) => (
                  <button
                    key={item.pane}
                    onClick={() => setOpenPane(item.pane)}
                    className="flex cursor-pointer flex-col gap-0.5 border-x-0 border-t-0 border-b border-surface-border bg-card px-4 py-2.5 text-left text-[13px] font-medium text-foreground transition-colors first:rounded-t-md last:rounded-b-md last:border-b-0 hover:bg-surface-border"
                  >
                    <span>{item.label}</span>
                    <span className="text-[10px] font-normal text-muted">{item.description}</span>
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
          <div ref={projectsRef} className="relative">
            <TactileButton
              variant="ghost"
              onClick={() => setProjectsOpen(o => !o)}
              faceClassName="px-2.5 py-[5px] text-[13px] font-semibold tracking-[0.01em]"
            >
              Projects
            </TactileButton>

            {projectsOpen && (
              <div className="absolute left-0 top-[calc(100%+6px)] flex min-w-40 flex-col overflow-visible rounded-md border border-card-border bg-card shadow-[0_4px_16px_rgba(0,0,0,0.10)]">
                <MenuItem
                  onClick={() => { setProjectsOpen(false); setSearchOpen(true); }}
                  disabled={!loggedIn}
                  title={loggedIn ? undefined : "Sign in to search projects"}
                  radius="6px 6px 0 0"
                >
                  <span>Search</span>
                  <kbd className="rounded-[3px] border border-card-border bg-surface-border px-1 text-[10px] leading-4 text-muted">⌘K</kbd>
                </MenuItem>

                <MenuItem onClick={handleNew} disabled={!loggedIn} title={loggedIn ? undefined : "Sign in to save projects"}>
                  New
                </MenuItem>

                <MenuItem onClick={handleDuplicate} disabled={!loggedIn} title={loggedIn ? undefined : "Sign in to save projects"}>
                  Duplicate
                </MenuItem>

                {/* Export — submenu to the right */}
                <div className="relative">
                  <MenuItem onClick={() => setExportOpen(o => !o)} disabled={!resolvedCards.length}>
                    <span>Export</span>
                    <span className="text-[10px] opacity-50">▶</span>
                  </MenuItem>

                  {exportOpen && resolvedCards.length > 0 && (
                    <div className="absolute left-[calc(100%+6px)] top-0 z-10 flex max-h-80 min-w-[220px] flex-col overflow-y-auto rounded-md border border-card-border bg-card shadow-[0_4px_16px_rgba(0,0,0,0.10)]">
                      {resolvedCards.map((card) => (
                        <button
                          key={card.id}
                          onClick={() => handleExport(card.id, card.modelName, getCardPrompt(card))}
                          disabled={exportingId === card.id}
                          className={cn(
                            "flex flex-col gap-0.5 border-x-0 border-t-0 border-b border-surface-border bg-card px-3.5 py-[9px] text-left text-xs transition-colors last:border-b-0",
                            exportingId === card.id ? "cursor-default opacity-50" : "cursor-pointer",
                            !exportingId && "hover:bg-surface-border",
                          )}
                        >
                          <span className="text-[11px] font-semibold text-foreground">
                            {card.modelName.split("/").pop()}
                          </span>
                          <span className="max-w-48 truncate text-[11px] text-muted">
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
                  <div className="flex border-t border-surface-border">
                    <button
                      onClick={() => setDeleteConfirming(false)}
                      className="flex-1 cursor-pointer rounded-bl-md border-y-0 border-l-0 border-r border-surface-border bg-card px-3 py-2.5 text-xs font-medium text-muted transition-colors hover:bg-surface-border"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteConfirmed}
                      className="flex-1 cursor-pointer rounded-br-md border-none bg-card px-3 py-2.5 text-xs font-semibold text-red-600 transition-colors hover:bg-surface-border"
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

          {/* Inline project name — the active draft's identity, even before it
              is materialized into a DB row (created lazily on first save). */}
          {loggedIn && (
            <div className="flex items-center gap-1.5 border-l border-card-border pl-2.5">
              {nameEditing ? (
                <input
                  ref={nameInputRef}
                  defaultValue={projectName}
                  onKeyDown={e => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") { setNameEditing(false); }
                  }}
                  onBlur={e => handleRename(e.target.value)}
                  className="min-w-[100px] max-w-[220px] rounded-[5px] border border-accent bg-background px-2 py-[3px] font-[inherit] text-[13px] font-medium text-foreground outline-none"
                />
              ) : (
                <button
                  onClick={() => setNameEditing(true)}
                  title="Rename project"
                  className="flex max-w-[220px] cursor-text items-center gap-[5px] rounded-[5px] border-none bg-transparent px-1.5 py-[3px] text-[13px] font-medium text-foreground transition-colors hover:bg-surface-border"
                >
                  <span className="block max-w-[190px] truncate">
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
                    className="shrink-0"
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
          onRemoveCard={id => { cancelCardJob(id); dispatch({ type: "REMOVE_CARD", id }); }}
          onVerifyTopK={jobHandlers.verifyTopK}
          onRerunSteering={steeringHandlers.rerunSteering}
        />

      </div>

      {shareCopied && (
        <div className="pointer-events-none fixed bottom-5 left-1/2 z-[1000] -translate-x-1/2 rounded-md bg-accent px-[18px] py-2 text-[13px] font-medium text-accent-fg shadow-[0_2px_12px_rgba(0,0,0,0.18)]">
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
