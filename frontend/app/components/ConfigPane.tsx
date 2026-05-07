"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/app/lib/auth-client";

type ModelInfo = {
  id: string;
  display_name: string;
  description: string;
  requires_hf_token: boolean;
  gpu_tier: string;
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
  onSubmit: (config: { modelName: string; prompt: string; gpuTier?: string }) => void;
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
  const { data: session } = useSession();
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

  const selectedGpuTier = usingCustom
    ? (customValidation?.gpu_tier ?? null)
    : (availableModels.find(m => m.id === selectedModel)?.gpu_tier ?? null);
  const isLockedByAuth = !session && selectedGpuTier !== null && selectedGpuTier !== "tl_small";

  const handleRun = () => {
    if (!canRun) return;
    const modelName = usingCustom ? customRepoId.trim() : selectedModel;
    const gpuTier = usingCustom
      ? (customValidation?.gpu_tier ?? undefined)
      : (availableModels.find(m => m.id === selectedModel)?.gpu_tier ?? undefined);
    onSubmit({ modelName, prompt, gpuTier });
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
          background: "rgba(0,0,0,0.45)",
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
          background: "#161b22",
          borderLeft: "1px solid #21262d",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px 12px",
            borderBottom: "1px solid #21262d",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.5 }}>
              <circle cx="8" cy="8" r="6.5" stroke="#58a6ff" strokeWidth="1" />
              <circle cx="8" cy="8" r="3.5" stroke="#58a6ff" strokeWidth="1" />
              <line x1="8" y1="1" x2="8" y2="2.5" stroke="#58a6ff" strokeWidth="1" />
              <line x1="8" y1="13.5" x2="8" y2="15" stroke="#58a6ff" strokeWidth="1" />
              <line x1="1" y1="8" x2="2.5" y2="8" stroke="#58a6ff" strokeWidth="1" />
              <line x1="13.5" y1="8" x2="15" y2="8" stroke="#58a6ff" strokeWidth="1" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3", letterSpacing: "0.01em" }}>
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
              color: "#7d8590",
              cursor: "pointer",
              fontSize: 16,
              lineHeight: 1,
              transition: "background 120ms, color 120ms",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "#1c2128";
              (e.currentTarget as HTMLButtonElement).style.color = "#e6edf3";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = "#7d8590";
            }}
          >
            ×
          </button>
        </div>

        {/* Form body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>

          {/* Featured models */}
          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: "block",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: "#7d8590",
              textTransform: "uppercase",
              marginBottom: 8,
            }}>
              Featured Models
            </label>

            {modelsLoading ? (
              <div style={{ fontSize: 12, color: "#484f58", padding: "12px 0" }}>Loading models…</div>
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
                        border: `1.5px solid ${isSelected ? "#58a6ff" : "#30363d"}`,
                        borderRadius: 7,
                        padding: "8px 9px",
                        background: isSelected ? "#111d2e" : "#1c2128",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "border-color 120ms, background 120ms",
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.borderColor = "#58a6ff"; }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.borderColor = "#30363d"; }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 600, color: isSelected ? "#79c0ff" : "#e6edf3", lineHeight: 1.3 }}>
                        {m.display_name}
                      </span>
                      <span style={{
                        fontSize: 10,
                        color: "#7d8590",
                        lineHeight: 1.4,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}>
                        {m.description}
                      </span>
                      {m.requires_hf_token && (
                        <span style={{ fontSize: 9, color: "#484f58", marginTop: 1, letterSpacing: "0.02em" }}>
                          HF token required
                        </span>
                      )}
                      {!session && m.gpu_tier !== "tl_small" && (
                        <span style={{ fontSize: 9, color: "#d29922", marginTop: 1, letterSpacing: "0.02em" }}>
                          Sign in to run
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
            <div style={{ flex: 1, height: 1, background: "#21262d" }} />
            <span style={{ fontSize: 10, color: "#484f58", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              or
            </span>
            <div style={{ flex: 1, height: 1, background: "#21262d" }} />
          </div>

          {/* Any HuggingFace model */}
          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: "block",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: "#7d8590",
              textTransform: "uppercase",
              marginBottom: 8,
            }}>
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
                  border: `1px solid ${usingCustom ? "#58a6ff" : "#30363d"}`,
                  borderRadius: 6,
                  padding: "6px 8px",
                  fontSize: 11,
                  fontFamily: "monospace",
                  color: "#e6edf3",
                  background: "#0d1117",
                  outline: "none",
                  transition: "border-color 120ms",
                }}
              />
              <button
                onClick={validateCustomRepo}
                disabled={!customRepoId.trim() || customValidating}
                style={{
                  border: "1px solid #30363d",
                  borderRadius: 6,
                  padding: "6px 10px",
                  fontSize: 11,
                  background: "#1c2128",
                  color: "#e6edf3",
                  cursor: (!customRepoId.trim() || customValidating) ? "not-allowed" : "pointer",
                  opacity: (!customRepoId.trim() || customValidating) ? 0.5 : 1,
                  whiteSpace: "nowrap",
                  transition: "background 120ms",
                  fontFamily: "inherit",
                }}
              >
                {customValidating ? "…" : "Validate"}
              </button>
            </div>
            {customValidation && (
              <p style={{ marginTop: 6, fontSize: 11, color: customValidation.valid ? "#3fb950" : "#f85149", margin: "6px 0 0" }}>
                {customValidation.valid
                  ? `✓ Valid — ${customValidation.gpu_tier ? TIER_LABELS[customValidation.gpu_tier] ?? customValidation.gpu_tier : "unknown GPU"}`
                  : `✗ ${customValidation.reason}`}
              </p>
            )}
          </div>

          {/* Prompt */}
          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: "block",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: "#7d8590",
              textTransform: "uppercase",
              marginBottom: 6,
            }}>
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={5}
              style={{
                width: "100%",
                border: "1px solid #30363d",
                borderRadius: 6,
                padding: "8px 10px",
                fontSize: 13,
                color: "#e6edf3",
                background: "#0d1117",
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
        <div style={{ padding: "12px 16px", borderTop: "1px solid #21262d" }}>
          {isLockedByAuth && (
            <p style={{ margin: "0 0 8px", fontSize: 11, color: "#7d8590", textAlign: "center" }}>
              Sign in to run medium and large models
            </p>
          )}
          <button
            onClick={handleRun}
            disabled={!canRun || isLockedByAuth}
            style={{
              width: "100%",
              padding: "10px 0",
              borderRadius: 6,
              border: "none",
              background: (!canRun || isLockedByAuth) ? "#111d2e" : "#58a6ff",
              color: (!canRun || isLockedByAuth) ? "#1f6feb" : "#0d1117",
              fontSize: 13,
              fontWeight: 600,
              cursor: (!canRun || isLockedByAuth) ? "not-allowed" : "pointer",
              letterSpacing: "0.02em",
              transition: "background 150ms",
              fontFamily: "inherit",
            }}
            onMouseEnter={e => { if (canRun && !isLockedByAuth) (e.currentTarget as HTMLButtonElement).style.background = "#79c0ff"; }}
            onMouseLeave={e => { if (canRun && !isLockedByAuth) (e.currentTarget as HTMLButtonElement).style.background = "#58a6ff"; }}
          >
            {isLockedByAuth ? "Sign in to run →" : "Run Lens →"}
          </button>
        </div>
      </div>
    </>
  );
}
