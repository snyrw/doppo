"use client";

import { useState, useEffect } from "react";

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

type ConfigPaneProps = {
  isOpen: boolean;
  availableModels: ModelInfo[];
  modelsLoading: boolean;
  onSubmit: (config: { modelName: string; prompt: string }) => void;
  onClose: () => void;
};

const DEFAULT_PROMPT = "The capital of France is Paris. The capital of Germany is";

function resetFormState() {
  return {
    selectedModel: "",
    prompt: DEFAULT_PROMPT,
    useCustomModel: false,
    customRepoId: "",
    customValidation: null as CustomValidation | null,
    customValidating: false,
    error: "",
  };
}

export default function ConfigPane({
  isOpen,
  availableModels,
  modelsLoading,
  onSubmit,
  onClose,
}: ConfigPaneProps) {
  const [selectedModel, setSelectedModel] = useState("");
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [customRepoId, setCustomRepoId] = useState("");
  const [customValidation, setCustomValidation] = useState<CustomValidation | null>(null);
  const [customValidating, setCustomValidating] = useState(false);
  const [error, setError] = useState("");

  // Auto-select first model when models load
  useEffect(() => {
    if (selectedModel === "" && availableModels.length > 0) {
      setSelectedModel(availableModels[0].id);
    }
  }, [availableModels, selectedModel]);

  const doReset = () => {
    const s = resetFormState();
    setSelectedModel(availableModels[0]?.id ?? "");
    setPrompt(s.prompt);
    setUseCustomModel(false);
    setCustomRepoId("");
    setCustomValidation(null);
    setCustomValidating(false);
    setError("");
  };

  const handleClose = () => {
    doReset();
    onClose();
  };

  const validateCustomRepo = async () => {
    setCustomValidating(true);
    setCustomValidation(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/validate-model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_id: customRepoId.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
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

  const canRun = useCustomModel ? (customValidation?.valid === true) : selectedModel !== "";

  const handleRun = () => {
    if (!canRun) return;
    const modelName = useCustomModel ? customRepoId.trim() : selectedModel;
    onSubmit({ modelName, prompt });
    doReset();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed",
          inset: 0,
          top: 57,
          zIndex: 29,
          background: "rgba(0,0,0,0.18)",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 200ms ease-out",
        }}
      />

      {/* Pane */}
      <div
        style={{
          position: "fixed",
          top: 57,
          right: 0,
          height: "calc(100vh - 57px)",
          width: 320,
          zIndex: 30,
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 200ms ease-out",
          display: "flex",
          flexDirection: "column",
          background: "#ffffff",
          borderLeft: "1px solid #e5e7eb",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.10)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px 12px",
            borderBottom: "1px solid #f3f4f6",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Lens icon */}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.5 }}>
              <circle cx="8" cy="8" r="6.5" stroke="#3b82f6" strokeWidth="1" />
              <circle cx="8" cy="8" r="3.5" stroke="#3b82f6" strokeWidth="1" />
              <line x1="8" y1="1" x2="8" y2="2.5" stroke="#3b82f6" strokeWidth="1" />
              <line x1="8" y1="13.5" x2="8" y2="15" stroke="#3b82f6" strokeWidth="1" />
              <line x1="1" y1="8" x2="2.5" y2="8" stroke="#3b82f6" strokeWidth="1" />
              <line x1="13.5" y1="8" x2="15" y2="8" stroke="#3b82f6" strokeWidth="1" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#111827", letterSpacing: "0.01em" }}>
              New Lens
            </span>
          </div>
          <button
            onClick={handleClose}
            style={{
              width: 24,
              height: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 4,
              border: "none",
              background: "transparent",
              color: "#9ca3af",
              cursor: "pointer",
              fontSize: 16,
              lineHeight: 1,
              transition: "background 120ms, color 120ms",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#f3f4f6"; (e.currentTarget as HTMLButtonElement).style.color = "#374151"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#9ca3af"; }}
          >
            ×
          </button>
        </div>

        {/* Form body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>

          {/* Model section */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "#6b7280", textTransform: "uppercase", marginBottom: 6 }}>
              Model
            </label>
            <select
              value={selectedModel}
              onChange={e => { setSelectedModel(e.target.value); setUseCustomModel(false); }}
              disabled={modelsLoading || useCustomModel}
              style={{
                width: "100%",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                padding: "7px 10px",
                fontSize: 13,
                color: useCustomModel ? "#9ca3af" : "#111827",
                background: (modelsLoading || useCustomModel) ? "#f9fafb" : "#fff",
                outline: "none",
                cursor: (modelsLoading || useCustomModel) ? "not-allowed" : "pointer",
                appearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%239ca3af' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 10px center",
                paddingRight: 28,
              }}
            >
              {modelsLoading
                ? <option>Loading models…</option>
                : availableModels.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.display_name}{m.requires_hf_token ? " (HF token)" : ""}
                    </option>
                  ))
              }
            </select>

            {/* Custom model toggle */}
            <label style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10, cursor: "pointer", userSelect: "none" }}>
              <input
                type="checkbox"
                checked={useCustomModel}
                onChange={e => { setUseCustomModel(e.target.checked); setCustomValidation(null); setCustomRepoId(""); }}
                style={{ accentColor: "#3b82f6", width: 13, height: 13 }}
              />
              <span style={{ fontSize: 12, color: "#6b7280" }}>Custom HF model</span>
            </label>

            {useCustomModel && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    type="text"
                    placeholder="username/model-name"
                    value={customRepoId}
                    onChange={e => { setCustomRepoId(e.target.value); setCustomValidation(null); }}
                    style={{
                      flex: 1,
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      padding: "6px 8px",
                      fontSize: 11,
                      fontFamily: "monospace",
                      color: "#111827",
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={validateCustomRepo}
                    disabled={!customRepoId.trim() || customValidating}
                    style={{
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      padding: "6px 10px",
                      fontSize: 11,
                      background: "#f9fafb",
                      color: "#374151",
                      cursor: (!customRepoId.trim() || customValidating) ? "not-allowed" : "pointer",
                      opacity: (!customRepoId.trim() || customValidating) ? 0.5 : 1,
                      whiteSpace: "nowrap",
                      transition: "background 120ms",
                    }}
                  >
                    {customValidating ? "…" : "Validate"}
                  </button>
                </div>
                {customValidation && (
                  <p style={{ marginTop: 6, fontSize: 11, color: customValidation.valid ? "#16a34a" : "#dc2626" }}>
                    {customValidation.valid
                      ? `✓ ${customValidation.is_peft ? `LoRA on ${customValidation.base_model}` : "Full fine-tune"}`
                      : `✗ ${customValidation.reason}`}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Prompt section */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "#6b7280", textTransform: "uppercase", marginBottom: 6 }}>
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={5}
              style={{
                width: "100%",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                padding: "8px 10px",
                fontSize: 13,
                color: "#111827",
                resize: "vertical",
                outline: "none",
                fontFamily: "inherit",
                lineHeight: 1.5,
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <p style={{ fontSize: 11, color: "#dc2626", marginBottom: 12 }}>{error}</p>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid #f3f4f6" }}>
          <button
            onClick={handleRun}
            disabled={!canRun}
            style={{
              width: "100%",
              padding: "10px 0",
              borderRadius: 6,
              border: "none",
              background: canRun ? "#2563eb" : "#bfdbfe",
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 600,
              cursor: canRun ? "pointer" : "not-allowed",
              letterSpacing: "0.02em",
              transition: "background 150ms",
            }}
            onMouseEnter={e => { if (canRun) (e.currentTarget as HTMLButtonElement).style.background = "#1d4ed8"; }}
            onMouseLeave={e => { if (canRun) (e.currentTarget as HTMLButtonElement).style.background = "#2563eb"; }}
          >
            Run Lens →
          </button>
        </div>
      </div>
    </>
  );
}
