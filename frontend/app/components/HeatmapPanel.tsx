"use client";

import { useState, useEffect } from "react";
import { runLensWithCache } from "../actions";

type HeatmapData = {
  x_labels: string[];
  y_labels: string[];
  heatmap_data: number[][];
};

type PanelState = "empty" | "configuring" | "loading" | "result";

type ModelInfo = {
  id: string;
  display_name: string;
  requires_hf_token: boolean;
};

type CustomValidation = {
  valid: boolean;
  is_peft: boolean;
  base_model: string | null;
  reason: string;
};

type HeatmapPanelProps = {
  availableModels: ModelInfo[];
  modelsLoading: boolean;
};

function simplifyLayerLabel(raw: string): string {
  if (raw === "embedding") return "emb";
  const match = raw.match(/\.(\d+)\./);
  return match ? match[1] : raw;
}

export default function HeatmapPanel({ availableModels, modelsLoading }: HeatmapPanelProps) {
  const [panelState, setPanelState] = useState<PanelState>("empty");
  const [data, setData] = useState<HeatmapData | null>(null);
  const [error, setError] = useState("");

  const [selectedModel, setSelectedModel] = useState("");
  const [prompt, setPrompt] = useState("The capital of France is Paris. The capital of Germany is");
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [customRepoId, setCustomRepoId] = useState("");
  const [customValidating, setCustomValidating] = useState(false);
  const [customValidation, setCustomValidation] = useState<CustomValidation | null>(null);

  useEffect(() => {
    if (selectedModel === "" && availableModels.length > 0) {
      setSelectedModel(availableModels[0].id);
    }
  }, [availableModels]);

  const activeModel = useCustomModel ? customRepoId.trim() : selectedModel;

  const validateCustomRepo = async () => {
    setCustomValidating(true);
    setCustomValidation(null);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/validate-model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_id: customRepoId.trim() }),
      });
      const json = await response.json();
      if (!response.ok) {
        setCustomValidation({ valid: false, is_peft: false, base_model: null, reason: json.detail ?? "Validation failed." });
      } else {
        setCustomValidation(json);
      }
    } catch {
      setCustomValidation({ valid: false, is_peft: false, base_model: null, reason: "Network error during validation." });
    } finally {
      setCustomValidating(false);
    }
  };

  const runLogitLens = async () => {
    setPanelState("loading");
    setError("");
    try {
      const result = await runLensWithCache(prompt, activeModel);
      setData(result as HeatmapData);
      setPanelState("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setPanelState("configuring");
    }
  };

  if (panelState === "empty") {
    return (
      <div
        className="h-full bg-white rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors min-h-[300px]"
        onClick={() => setPanelState("configuring")}
      >
        <span className="text-5xl text-gray-300 select-none">+</span>
      </div>
    );
  }

  if (panelState === "loading") {
    return (
      <div className="h-full bg-white rounded-lg border border-gray-200 shadow-sm flex items-center justify-center min-h-[300px]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">Running model…</p>
        </div>
      </div>
    );
  }

  if (panelState === "configuring") {
    return (
      <div className="h-full bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col min-h-[300px]">
        <div className="px-3 py-2 border-b border-gray-100 shrink-0">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Configure Panel</span>
        </div>

        <div className="flex-1 p-3 space-y-3 overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Model</label>
            <select
              className="w-full border border-gray-300 rounded p-1.5 text-sm"
              value={selectedModel}
              onChange={(e) => { setSelectedModel(e.target.value); setUseCustomModel(false); }}
              disabled={modelsLoading}
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}{m.requires_hf_token ? " (HF token)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={useCustomModel}
                onChange={(e) => { setUseCustomModel(e.target.checked); setCustomValidation(null); }}
              />
              Custom HF model
            </label>
            {useCustomModel && (
              <div className="mt-1.5 flex gap-1.5 items-start">
                <input
                  type="text"
                  className="flex-1 border border-gray-300 rounded p-1.5 text-xs font-mono"
                  placeholder="username/model-name"
                  value={customRepoId}
                  onChange={(e) => { setCustomRepoId(e.target.value); setCustomValidation(null); }}
                />
                <button
                  onClick={validateCustomRepo}
                  disabled={!customRepoId.trim() || customValidating}
                  className="bg-gray-100 border border-gray-300 text-gray-700 px-2 py-1.5 rounded text-xs hover:bg-gray-200 disabled:opacity-50 whitespace-nowrap transition-colors"
                >
                  {customValidating ? "…" : "Validate"}
                </button>
              </div>
            )}
            {useCustomModel && customValidation && (
              <p className={`mt-1 text-xs ${customValidation.valid ? "text-green-600" : "text-red-500"}`}>
                {customValidation.valid
                  ? `✓ ${customValidation.is_peft ? `LoRA on ${customValidation.base_model}` : "Full fine-tune"}`
                  : `✗ ${customValidation.reason}`}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Prompt</label>
            <textarea
              className="w-full border border-gray-300 rounded p-1.5 text-sm resize-none"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="px-3 text-xs text-red-500 shrink-0">{error}</p>}

        <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-between gap-2 shrink-0">
          <button
            onClick={() => setPanelState(data ? "result" : "empty")}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
          >
            {data ? "Back" : "Cancel"}
          </button>
          <button
            onClick={runLogitLens}
            disabled={useCustomModel && !customValidation?.valid}
            className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
          >
            Run
          </button>
        </div>
      </div>
    );
  }

  // result state
  return (
    <div className="h-full bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col min-h-[300px]">
      <div className="px-3 py-1.5 border-b border-gray-100 flex items-center gap-2 shrink-0">
        <span className="text-xs font-semibold text-gray-700 truncate flex-1 min-w-0">
          {activeModel} · {prompt.length > 40 ? prompt.slice(0, 40) + "…" : prompt}
        </span>
        <button
          onClick={() => setPanelState("configuring")}
          className="text-xs text-blue-500 hover:text-blue-700 px-1.5 py-0.5 rounded hover:bg-blue-50 shrink-0 transition-colors"
        >
          Edit
        </button>
        <button
          onClick={() => { setData(null); setError(""); setPanelState("empty"); }}
          className="text-xs text-gray-400 hover:text-red-500 px-1.5 py-0.5 rounded hover:bg-red-50 shrink-0 transition-colors"
        >
          Clear
        </button>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-auto p-1">
        {data && (
          <div className="flex flex-col inline-block min-w-max">
            {/* X-axis token labels */}
            <div className="flex">
              <div className="w-10 shrink-0" />
              {data.x_labels.map((token, i) => (
                <div
                  key={i}
                  className="w-6 shrink-0 text-[10px] text-center font-mono -rotate-45 origin-bottom-left pb-2 overflow-hidden"
                >
                  {token}
                </div>
              ))}
            </div>

            {/* Rows */}
            {data.y_labels.map((layerName, yIndex) => (
              <div key={layerName} className="flex items-center">
                <div className="w-10 shrink-0 text-[10px] text-gray-500 font-mono pr-1 text-right">
                  {simplifyLayerLabel(layerName)}
                </div>
                {data.heatmap_data[yIndex].map((prob, xIndex) => (
                  <div
                    key={`${yIndex}-${xIndex}`}
                    className="w-6 h-3 shrink-0 border border-gray-100/50 relative group cursor-pointer"
                    style={{ backgroundColor: `rgba(59, 130, 246, ${prob})` }}
                    title={`Token: ${data.x_labels[xIndex]}\nLayer: ${layerName}\nProb: ${(prob * 100).toFixed(2)}%`}
                  >
                    <span className="opacity-0 group-hover:opacity-100 absolute inset-0 flex items-center justify-center text-[8px] text-black bg-white/80 z-10 pointer-events-none">
                      {prob.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
