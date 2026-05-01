"use client";

import { useState, useEffect } from "react";

type ModelInfo = {
  id: string;
  display_name: string;
  description: string;
  requires_hf_token: boolean;
};

type CustomValidation = {
  valid: boolean;
  gpu_tier: string | null;
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

const TIER_LABELS: Record<string, string> = {
  tl_small: "L4",
  tl_medium: "A10G",
  tl_large: "A100-80GB",
};

export default function ConfigPane({
  isOpen,
  availableModels,
  modelsLoading,
  onSubmit,
  onClose,
}: ConfigPaneProps) {
  const [selectedModel, setSelectedModel] = useState("");
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [customRepoId, setCustomRepoId] = useState("");
  const [customValidation, setCustomValidation] = useState<CustomValidation | null>(null);
  const [customValidating, setCustomValidating] = useState(false);

  useEffect(() => {
    if (selectedModel === "" && availableModels.length > 0 && customRepoId === "") {
      setSelectedModel(availableModels[0].id);
    }
  }, [availableModels, selectedModel, customRepoId]);

  const doReset = () => {
    setSelectedModel(availableModels[0]?.id ?? "");
    setPrompt(DEFAULT_PROMPT);
    setCustomRepoId("");
    setCustomValidation(null);
    setCustomValidating(false);
  };

  const handleClose = () => {
    doReset();
    onClose();
  };

  const selectFeaturedModel = (id: string) => {
    setSelectedModel(id);
    setCustomRepoId("");
    setCustomValidation(null);
  };

  const handleCustomRepoChange = (value: string) => {
    setCustomRepoId(value);
    setSelectedModel("");
    setCustomValidation(null);
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
        setCustomValidation({ valid: false, gpu_tier: null, reason: json.detail ?? "Validation failed." });
      } else {
        setCustomValidation(json);
      }
    } catch {
      setCustomValidation({ valid: false, gpu_tier: null, reason: "Network error during validation." });
    } finally {
      setCustomValidating(false);
    }
  };

  const usingCustom = customRepoId.trim() !== "";
  const canRun = usingCustom ? (customValidation?.valid === true) : selectedModel !== "";

  const handleRun = () => {
    if (!canRun) return;
    const modelName = usingCustom ? customRepoId.trim() : selectedModel;
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
          width: 340,
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

          {/* Featured models */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "#6b7280", textTransform: "uppercase", marginBottom: 8 }}>
              Featured Models
            </label>

            {modelsLoading ? (
              <div style={{ fontSize: 12, color: "#9ca3af", padding: "12px 0" }}>Loading models…</div>
            ) : (
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 7,
                maxHeight: 260,
                overflowY: "auto",
                paddingRight: 2,
              }}>
                {availableModels.map(m => {
                  const isSelected = selectedModel === m.id && !usingCustom;
                  return (
                    <button
                      key={m.id}
                      onClick={() => selectFeaturedModel(m.id)}
                      title={m.description}
                      style={{
                        border: `1.5px solid ${isSelected ? "#2563eb" : "#e5e7eb"}`,
                        borderRadius: 7,
                        padding: "8px 9px",
                        background: isSelected ? "#eff6ff" : "#fff",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "border-color 120ms, background 120ms",
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.borderColor = "#93c5fd"; }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.borderColor = "#e5e7eb"; }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 600, color: isSelected ? "#1d4ed8" : "#111827", lineHeight: 1.3 }}>
                        {m.display_name}
                      </span>
                      <span style={{
                        fontSize: 10,
                        color: "#6b7280",
                        lineHeight: 1.4,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}>
                        {m.description}
                      </span>
                      {m.requires_hf_token && (
                        <span style={{ fontSize: 9, color: "#9ca3af", marginTop: 1, letterSpacing: "0.02em" }}>
                          HF token required
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: "#f3f4f6" }} />
            <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              or
            </span>
            <div style={{ flex: 1, height: 1, background: "#f3f4f6" }} />
          </div>

          {/* Any HuggingFace model */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "#6b7280", textTransform: "uppercase", marginBottom: 8 }}>
              Any HuggingFace Model
            </label>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="text"
                placeholder="username/model-name"
                value={customRepoId}
                onChange={e => handleCustomRepoChange(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && customRepoId.trim()) validateCustomRepo(); }}
                style={{
                  flex: 1,
                  border: `1px solid ${usingCustom ? "#93c5fd" : "#d1d5db"}`,
                  borderRadius: 6,
                  padding: "6px 8px",
                  fontSize: 11,
                  fontFamily: "monospace",
                  color: "#111827",
                  outline: "none",
                  transition: "border-color 120ms",
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
              <p style={{ marginTop: 6, fontSize: 11, color: customValidation.valid ? "#16a34a" : "#dc2626", margin: "6px 0 0" }}>
                {customValidation.valid
                  ? `✓ Valid — ${customValidation.gpu_tier ? TIER_LABELS[customValidation.gpu_tier] ?? customValidation.gpu_tier : "unknown GPU"}`
                  : `✗ ${customValidation.reason}`}
              </p>
            )}
          </div>

          {/* Prompt */}
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
