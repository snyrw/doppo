"use client";

import { useState, useEffect, useReducer, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import SandboxCanvas from "../components/SandboxCanvas";
import ConfigPane from "../components/ConfigPane";
import Navbar from "../components/Navbar";
import { ProjectSearch } from "../components/ProjectSearch";
import type { LensCardData } from "../components/LensCard";
import { useSession } from "../lib/auth-client";
import {
  createProject,
  duplicateProject,
  deleteProject,
  loadProject,
  updateProject,
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

type AppState = {
  lensCards: LensCardData[];
  canvas: CanvasState;
};

type AppAction =
  | { type: "ADD_CARD"; card: LensCardData }
  | { type: "CARD_RESOLVED"; id: string; data: HeatmapData }
  | { type: "CARD_ERRORED"; id: string; error: string }
  | { type: "CARD_STAGE"; id: string; stage: string }
  | { type: "MOVE_CARD"; id: string; position: { x: number; y: number } }
  | { type: "REMOVE_CARD"; id: string }
  | { type: "SET_CANVAS"; canvas: CanvasState }
  | { type: "LOAD_PROJECT"; cards: LensCardData[]; canvas: CanvasState }
  | { type: "RESET_CANVAS" };

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
          c.id === action.id ? { ...c, status: "result", data: action.data } : c
        ),
      };
    case "CARD_ERRORED":
      return {
        ...state,
        lensCards: state.lensCards.map(c =>
          c.id === action.id ? { ...c, status: "error", error: action.error } : c
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

function Projects() {
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [configOpen, setConfigOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("Untitled Project");
  const [nameEditing, setNameEditing] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const projectsRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [state, dispatch] = useReducer(appReducer, initialState);
  const projectIdRef = useRef<string | null>(null);
  const stateRef = useRef(state);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();

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

  // Reset delete confirmation when dropdown closes
  useEffect(() => {
    if (!projectsOpen) setDeleteConfirming(false);
  }, [projectsOpen]);

  const loadAndSetProject = useCallback(async (id: string) => {
    setProjectId(id);
    router.replace(`/projects?id=${id}`);
    try {
      const result = await loadProject(id);
      if (!result) { router.replace("/projects"); return; }
      const lensCards: LensCardData[] = result.cards.map(c => ({
        ...c,
        status: "result" as const,
        error: null,
      }));
      setProjectName(result.name);
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
                    .map(c => ({ id: c.id, modelName: c.modelName, prompt: c.prompt, data: c.data!, position: c.position, gpuTier: c.gpuTier }));
                  updateProject(pid, [...existingResult, { id, modelName, prompt, data: event.data, position: card.position, gpuTier }], stateRef.current.canvas)
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
    const resultCards = state.lensCards
      .filter(c => c.status === "result")
      .map(c => ({ id: c.id, modelName: c.modelName, prompt: c.prompt, data: c.data!, position: c.position, gpuTier: c.gpuTier }));
    updateProject(projectId, resultCards, state.canvas, trimmed).catch(console.error);
  }

  async function handleDuplicate() {
    if (!session?.user) return;
    setProjectsOpen(false);
    const resultCards = state.lensCards
      .filter(c => c.status === "result")
      .map(({ id, modelName, prompt, data, position, gpuTier }) => ({
        id,
        modelName,
        prompt,
        data: data!,
        position,
        gpuTier,
      }));
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

  const loggedIn = !!session?.user;
  const disabledStyle = { color: "#93c5fd", cursor: "default" as const };
  const enabledStyle = { color: "#2563eb", cursor: "pointer" as const };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f8fafc" }}>
      <Navbar/>

      {/* Canvas area — relative so the "Add Lens +" button can float over it */}
      <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column" }}>
        {/* Floating buttons — top-left, over the canvas */}
        <div style={{ position: "absolute", top: 12, left: 12, zIndex: 35, display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => setConfigOpen(true)}
            style={{
              background: configOpen ? "#1d4ed8" : "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: 6,
              padding: "5px 10px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(37,99,235,0.3)",
              transition: "background 150ms, box-shadow 150ms",
              display: "flex",
              alignItems: "center",
              gap: 6,
              letterSpacing: "0.01em",
            }}
            onMouseEnter={e => {
              if (!configOpen) (e.currentTarget as HTMLButtonElement).style.background = "#1d4ed8";
            }}
            onMouseLeave={e => {
              if (!configOpen) (e.currentTarget as HTMLButtonElement).style.background = "#2563eb";
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1, marginTop: -1 }}>+</span>
            Add Lens
          </button>

          {/* Projects button + dropdown */}
          <div ref={projectsRef} style={{ position: "relative" }}>
            <button
              onClick={() => setProjectsOpen(o => !o)}
              style={{
                background: "#fff",
                color: "#2563eb",
                border: "1px solid #93c5fd",
                borderRadius: 6,
                padding: "5px 10px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(37,99,235,0.1)",
                transition: "background 150ms, border-color 150ms",
                letterSpacing: "0.01em",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#eff6ff"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}
            >
              Projects
            </button>

            {projectsOpen && (
              <div style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                background: "#fff",
                border: "2px solid #93c5fd",
                borderRadius: 6,
                boxShadow: "0 4px 16px rgba(37,99,235,0.12)",
                display: "flex",
                flexDirection: "column",
                minWidth: 160,
                overflow: "hidden",
              }}>
                {/* Search */}
                <button
                  onClick={() => { setProjectsOpen(false); setSearchOpen(true); }}
                  style={{
                    background: "#fff",
                    border: "none",
                    borderBottom: "1px solid #e0f0ff",
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
                  onMouseEnter={e => { if (loggedIn) (e.currentTarget as HTMLButtonElement).style.background = "#eff6ff"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}
                >
                  <span>Search</span>
                  <kbd style={{
                    fontSize: 10,
                    fontFamily: "monospace",
                    background: loggedIn ? "#eff6ff" : "transparent",
                    color: loggedIn ? "#2563eb" : "#93c5fd",
                    border: `1px solid ${loggedIn ? "#93c5fd" : "#dbeafe"}`,
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
                    background: "#fff",
                    border: "none",
                    borderBottom: "1px solid #e0f0ff",
                    padding: "10px 16px",
                    fontSize: 13,
                    fontWeight: 500,
                    textAlign: "left",
                    transition: "background 120ms",
                    ...(loggedIn ? enabledStyle : disabledStyle),
                  }}
                  onMouseEnter={e => { if (loggedIn) (e.currentTarget as HTMLButtonElement).style.background = "#eff6ff"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}
                >
                  New
                </button>

                {/* Duplicate */}
                <button
                  onClick={handleDuplicate}
                  disabled={!loggedIn}
                  title={loggedIn ? undefined : "Sign in to save projects"}
                  style={{
                    background: "#fff",
                    border: "none",
                    borderBottom: "1px solid #e0f0ff",
                    padding: "10px 16px",
                    fontSize: 13,
                    fontWeight: 500,
                    textAlign: "left",
                    transition: "background 120ms",
                    ...(loggedIn ? enabledStyle : disabledStyle),
                  }}
                  onMouseEnter={e => { if (loggedIn) (e.currentTarget as HTMLButtonElement).style.background = "#eff6ff"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}
                >
                  Duplicate
                </button>

                {/* Share — not yet implemented */}
                <button
                  onClick={() => setProjectsOpen(false)}
                  style={{
                    background: "#fff",
                    color: "#2563eb",
                    border: "none",
                    borderBottom: "1px solid #e0f0ff",
                    padding: "10px 16px",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 120ms",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#eff6ff"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}
                >
                  Share
                </button>

                {/* Delete — inline confirmation */}
                {deleteConfirming ? (
                  <div style={{ display: "flex", borderTop: "1px solid #fee2e2" }}>
                    <button
                      onClick={() => setDeleteConfirming(false)}
                      style={{
                        flex: 1,
                        background: "#fff",
                        color: "#6b7280",
                        border: "none",
                        borderRight: "1px solid #fee2e2",
                        padding: "10px 12px",
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: "pointer",
                        transition: "background 120ms",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#f9fafb"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteConfirmed}
                      style={{
                        flex: 1,
                        background: "#fff",
                        color: "#dc2626",
                        border: "none",
                        padding: "10px 12px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "background 120ms",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#fef2f2"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}
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
                      background: "#fff",
                      border: "none",
                      padding: "10px 16px",
                      fontSize: 13,
                      fontWeight: 500,
                      textAlign: "left",
                      transition: "background 120ms",
                      color: loggedIn && projectId ? "#dc2626" : "#fca5a5",
                      cursor: loggedIn && projectId ? "pointer" : "default",
                    }}
                    onMouseEnter={e => { if (loggedIn && projectId) (e.currentTarget as HTMLButtonElement).style.background = "#fef2f2"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}
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
              borderLeft: "1px solid #cbd5e1",
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
                    border: "1px solid #93c5fd",
                    borderRadius: 5,
                    padding: "3px 8px",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#1e293b",
                    background: "#fff",
                    outline: "none",
                    boxShadow: "0 0 0 3px rgba(37,99,235,0.08)",
                    minWidth: 100,
                    maxWidth: 220,
                    fontFamily: "inherit",
                    transition: "box-shadow 120ms",
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
                    color: "#334155",
                    padding: "3px 6px",
                    borderRadius: 5,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    maxWidth: 220,
                    transition: "background 120ms",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = "#f1f5f9";
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
                    stroke="#94a3b8"
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
        />

        <ConfigPane
          isOpen={configOpen}
          availableModels={availableModels}
          modelsLoading={modelsLoading}
          onSubmit={handleAddLens}
          onClose={() => setConfigOpen(false)}
        />
      </div>
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
