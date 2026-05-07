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

  useEffect(() => {
    const id = searchParams.get("id");
    if (!id) return;
    loadAndSetProject(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { projectIdRef.current = projectId; }, [projectId]);
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    if (nameEditing) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [nameEditing]);

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
  const disabledStyle = { color: "#484f58", cursor: "default" as const };
  const enabledStyle = { color: "#58a6ff", cursor: "pointer" as const };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#0d1117" }}>
      <Navbar/>

      <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column" }}>
        {/* Floating buttons — top-left */}
        <div style={{ position: "absolute", top: 12, left: 12, zIndex: 35, display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => setConfigOpen(true)}
            style={{
              background: configOpen ? "#1f6feb" : "#58a6ff",
              color: "#0d1117",
              border: "none",
              borderRadius: 6,
              padding: "5px 10px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 12px rgba(88,166,255,0.25)",
              transition: "background 150ms, box-shadow 150ms",
              display: "flex",
              alignItems: "center",
              gap: 6,
              letterSpacing: "0.01em",
              fontFamily: "inherit",
            }}
            onMouseEnter={e => {
              if (!configOpen) (e.currentTarget as HTMLButtonElement).style.background = "#79c0ff";
            }}
            onMouseLeave={e => {
              if (!configOpen) (e.currentTarget as HTMLButtonElement).style.background = "#58a6ff";
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
                background: "#161b22",
                color: "#58a6ff",
                border: "1px solid #30363d",
                borderRadius: 6,
                padding: "5px 10px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                transition: "background 150ms, border-color 150ms",
                letterSpacing: "0.01em",
                fontFamily: "inherit",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "#1c2128";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "#58a6ff";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "#161b22";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "#30363d";
              }}
            >
              Projects
            </button>

            {projectsOpen && (
              <div style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                background: "#161b22",
                border: "1px solid #30363d",
                borderRadius: 6,
                boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                display: "flex",
                flexDirection: "column",
                minWidth: 160,
                overflow: "hidden",
              }}>
                {/* Search */}
                <button
                  onClick={() => { setProjectsOpen(false); setSearchOpen(true); }}
                  style={{
                    background: "#161b22",
                    border: "none",
                    borderBottom: "1px solid #21262d",
                    padding: "10px 16px",
                    fontSize: 13,
                    fontWeight: 500,
                    textAlign: "left",
                    transition: "background 120ms",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontFamily: "inherit",
                    ...(loggedIn ? enabledStyle : disabledStyle),
                  }}
                  disabled={!loggedIn}
                  title={loggedIn ? undefined : "Sign in to search projects"}
                  onMouseEnter={e => { if (loggedIn) (e.currentTarget as HTMLButtonElement).style.background = "#1c2128"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#161b22"; }}
                >
                  <span>Search</span>
                  <kbd style={{
                    fontSize: 10,
                    fontFamily: "monospace",
                    background: loggedIn ? "#1c2128" : "transparent",
                    color: loggedIn ? "#58a6ff" : "#484f58",
                    border: `1px solid ${loggedIn ? "#30363d" : "#21262d"}`,
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
                    background: "#161b22",
                    border: "none",
                    borderBottom: "1px solid #21262d",
                    padding: "10px 16px",
                    fontSize: 13,
                    fontWeight: 500,
                    textAlign: "left",
                    transition: "background 120ms",
                    fontFamily: "inherit",
                    ...(loggedIn ? enabledStyle : disabledStyle),
                  }}
                  onMouseEnter={e => { if (loggedIn) (e.currentTarget as HTMLButtonElement).style.background = "#1c2128"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#161b22"; }}
                >
                  New
                </button>

                {/* Duplicate */}
                <button
                  onClick={handleDuplicate}
                  disabled={!loggedIn}
                  title={loggedIn ? undefined : "Sign in to save projects"}
                  style={{
                    background: "#161b22",
                    border: "none",
                    borderBottom: "1px solid #21262d",
                    padding: "10px 16px",
                    fontSize: 13,
                    fontWeight: 500,
                    textAlign: "left",
                    transition: "background 120ms",
                    fontFamily: "inherit",
                    ...(loggedIn ? enabledStyle : disabledStyle),
                  }}
                  onMouseEnter={e => { if (loggedIn) (e.currentTarget as HTMLButtonElement).style.background = "#1c2128"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#161b22"; }}
                >
                  Duplicate
                </button>

                {/* Share */}
                <button
                  onClick={() => setProjectsOpen(false)}
                  style={{
                    background: "#161b22",
                    color: "#58a6ff",
                    border: "none",
                    borderBottom: "1px solid #21262d",
                    padding: "10px 16px",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 120ms",
                    fontFamily: "inherit",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#1c2128"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#161b22"; }}
                >
                  Share
                </button>

                {/* Delete — inline confirmation */}
                {deleteConfirming ? (
                  <div style={{ display: "flex", borderTop: "1px solid #21262d" }}>
                    <button
                      onClick={() => setDeleteConfirming(false)}
                      style={{
                        flex: 1,
                        background: "#161b22",
                        color: "#7d8590",
                        border: "none",
                        borderRight: "1px solid #21262d",
                        padding: "10px 12px",
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: "pointer",
                        transition: "background 120ms",
                        fontFamily: "inherit",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#1c2128"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#161b22"; }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteConfirmed}
                      style={{
                        flex: 1,
                        background: "#161b22",
                        color: "#f85149",
                        border: "none",
                        padding: "10px 12px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "background 120ms",
                        fontFamily: "inherit",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(248,81,73,0.1)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#161b22"; }}
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
                      background: "#161b22",
                      border: "none",
                      padding: "10px 16px",
                      fontSize: 13,
                      fontWeight: 500,
                      textAlign: "left",
                      transition: "background 120ms",
                      color: loggedIn && projectId ? "#f85149" : "#484f58",
                      cursor: loggedIn && projectId ? "pointer" : "default",
                      fontFamily: "inherit",
                    }}
                    onMouseEnter={e => { if (loggedIn && projectId) (e.currentTarget as HTMLButtonElement).style.background = "rgba(248,81,73,0.1)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#161b22"; }}
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Inline project name */}
          {projectId && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              paddingLeft: 10,
              borderLeft: "1px solid #21262d",
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
                    border: "1px solid #58a6ff",
                    borderRadius: 5,
                    padding: "3px 8px",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#e6edf3",
                    background: "#0d1117",
                    outline: "none",
                    boxShadow: "0 0 0 3px rgba(88,166,255,0.1)",
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
                    color: "#7d8590",
                    padding: "3px 6px",
                    borderRadius: 5,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    maxWidth: 220,
                    transition: "background 120ms",
                    fontFamily: "inherit",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = "#1c2128";
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
                    stroke="#484f58"
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
