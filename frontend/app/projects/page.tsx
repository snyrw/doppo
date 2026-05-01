"use client";

import { useState, useEffect, useReducer, useRef } from "react";
import SandboxCanvas from "../components/SandboxCanvas";
import ConfigPane from "../components/ConfigPane";
import Navbar from "../components/Navbar";
import { runLensWithCache } from "../actions";
import type { LensCardData } from "../components/LensCard";

type ModelInfo = {
  id: string;
  display_name: string;
  description: string;
  requires_hf_token: boolean;
};

type HeatmapData = {
  x_labels: string[];
  y_labels: string[];
  heatmap_data: number[][];
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
  | { type: "MOVE_CARD"; id: string; position: { x: number; y: number } }
  | { type: "REMOVE_CARD"; id: string }
  | { type: "SET_CANVAS"; canvas: CanvasState };

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
    case "REMOVE_CARD":
      return { ...state, lensCards: state.lensCards.filter(c => c.id !== action.id) };
    case "SET_CANVAS":
      return { ...state, canvas: action.canvas };
    default:
      return state;
  }
}

const initialState: AppState = {
  lensCards: [],
  canvas: { panOffset: { x: 0, y: 0 }, zoom: 1 },
};

export default function Projects() {
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [configOpen, setConfigOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const projectsRef = useRef<HTMLDivElement>(null);
  const [state, dispatch] = useReducer(appReducer, initialState);

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
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/models`)
      .then(r => r.json())
      .then(models => setAvailableModels(models))
      .catch(() => setAvailableModels([{ id: "gpt2-small", display_name: "GPT-2 Small", description: "Classic 12-layer baseline, fast cold starts.", requires_hf_token: false }]))
      .finally(() => setModelsLoading(false));
  }, []);

  const handleAddLens = ({ modelName, prompt }: { modelName: string; prompt: string }) => {
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
    };

    dispatch({ type: "ADD_CARD", card });

    // Fire inference, resolve asynchronously into the card
    runLensWithCache(prompt, modelName)
      .then(data => dispatch({ type: "CARD_RESOLVED", id, data: data as HeatmapData }))
      .catch(err => dispatch({ type: "CARD_ERRORED", id, error: err instanceof Error ? err.message : "Unknown error" }));
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f8fafc" }}>
      <Navbar/>

      {/* Canvas area — relative so the "Add Lens +" button can float over it */}
      <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column" }}>
        {/* Floating buttons — top-left, over the canvas */}
        <div style={{ position: "absolute", top: 12, left: 12, zIndex: 35, display: "flex", gap: 8, alignItems: "flex-start" }}>
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
                minWidth: 140,
                overflow: "hidden",
              }}>
                {["Search", "New", "Duplicate", "Share", "Delete"].map(label => (
                  <button
                    key={label}
                    onClick={() => setProjectsOpen(false)}
                    style={{
                      background: "#fff",
                      color: "#2563eb",
                      border: "none",
                      borderBottom: label !== "Delete" ? "1px solid #e0f0ff" : "none",
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
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <SandboxCanvas
          cards={state.lensCards}
          canvasState={state.canvas}
          onCanvasChange={canvas => dispatch({ type: "SET_CANVAS", canvas })}
          onMoveCard={(id, position) => dispatch({ type: "MOVE_CARD", id, position })}
          onRemoveCard={id => dispatch({ type: "REMOVE_CARD", id })}
          onEditCard={() => setConfigOpen(true)}
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
