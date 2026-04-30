"use client";

import { useState, useEffect, useReducer } from "react";
import logo from "../logo-blue.png";
import Image from "next/image";
import AuthButtons from "../components/AuthModal";
import SandboxCanvas from "../components/SandboxCanvas";
import ConfigPane from "../components/ConfigPane";
import Link from "next/link";
import { runLensWithCache } from "../actions";
import type { LensCardData } from "../components/LensCard";

type ModelInfo = {
  id: string;
  display_name: string;
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
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/models`)
      .then(r => r.json())
      .then(models => setAvailableModels(models))
      .catch(() => setAvailableModels([{ id: "gpt2-small", display_name: "GPT-2 Small", requires_hf_token: false }]))
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
      {/* Header */}
      <header style={{ background: "#ffffff", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 12px", height: 57, borderBottom: "1px solid #f3f4f6", flexShrink: 0, zIndex: 40, position: "relative" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
          <Image className="h-9 w-9" src={logo} alt="Logo" />
          <span style={{ color: "#60a5fa", fontWeight: 700, fontSize: 18 }}>logitlensviz</span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button style={{ background: "#fff", fontSize: 15, fontWeight: 300, color: "#60a5fa", padding: "4px 12px", borderRadius: 4, border: "2px solid #60a5fa", cursor: "pointer" }}>
            Export
          </button>
          <AuthButtons />
        </div>
      </header>

      {/* Canvas area — relative so the "Add Lens +" button can float over it */}
      <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column" }}>
        {/* "Add Lens +" floating button — top-left, over the canvas */}
        <div style={{ position: "absolute", top: 12, left: 12, zIndex: 35 }}>
          <button
            onClick={() => setConfigOpen(true)}
            style={{
              background: configOpen ? "#1d4ed8" : "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: 6,
              padding: "8px 14px",
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
