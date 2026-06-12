"use client";

import { useState, useEffect } from "react";
import { useTokenPreview } from "../hooks/useTokenPreview";
import { useModelSelection, type ModelInfo } from "../hooks/useModelSelection";
import ModelPicker from "./ModelPicker";
import TokenPreview from "./TokenPreview";

const MAX_PROMPT_TOKENS = 48;

type ConfigPaneProps = {
  isOpen: boolean;
  availableModels: ModelInfo[];
  modelsLoading: boolean;
  onSubmit: (config: { modelName: string; prompt: string; gpuTier?: string; topK: number }) => void;
  onClose: () => void;
  tutorialMode?: boolean;
  tutorialConfig?: {
    modelName: string;
    prompt: string;
    gpuTier: string;
    topK: number;
  };
};

const DEFAULT_PROMPT = "The capital of France is Paris. The capital of Germany is";


export default function ConfigPane({
  isOpen,
  availableModels,
  modelsLoading,
  onSubmit,
  onClose,
  tutorialMode,
  tutorialConfig,
}: ConfigPaneProps) {
  const picker = useModelSelection(availableModels);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [topK, setTopK] = useState(5);

  const tokenPreview = useTokenPreview(isOpen ? picker.activeModelId : "", prompt);

  useEffect(() => {
    if (tutorialMode && tutorialConfig) {
      setPrompt(tutorialConfig.prompt);
      picker.forceModel(tutorialConfig.modelName);
      setTopK(tutorialConfig.topK);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorialMode, tutorialConfig]);

  const doReset = () => {
    picker.reset();
    setPrompt(DEFAULT_PROMPT);
  };

  const handleClose = () => {
    doReset();
    onClose();
  };

  const tokenCount = tokenPreview.tokens?.length ?? 0;
  const overTokenLimit = tokenPreview.tokens !== null && tokenCount > MAX_PROMPT_TOKENS;
  const canRun = !overTokenLimit && picker.modelOk;

  const handleRun = () => {
    if (!canRun) return;
    onSubmit({ modelName: picker.modelName, prompt, gpuTier: picker.gpuTier, topK });
    doReset();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        left: 0,
        width: 380,
        maxWidth: "min(380px, calc(100vw - 24px))",
        maxHeight: "calc(100vh - 100px)",
        zIndex: 30,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--color-card)",
        border: "1px solid var(--color-card-border)",
        borderRadius: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
        animation: "cfgDropIn 140ms ease-out",
      }}
    >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px 12px",
            borderBottom: "1px solid var(--color-surface-border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)", letterSpacing: "0.01em" }}>
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
              color: "var(--color-text-muted)",
              cursor: "pointer",
              fontSize: 16,
              lineHeight: 1,
              transition: "background 120ms, color 120ms",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)"; }}
          >
            ×
          </button>
        </div>

        {/* Form body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>

          {/* Featured models / model selection */}
          <ModelPicker
            picker={picker}
            models={availableModels}
            modelsLoading={modelsLoading}
            tutorialMode={tutorialMode}
            tutorialModelName={tutorialConfig?.modelName}
          />

          {/* Prompt */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: 6 }}>
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              disabled={tutorialMode}
              rows={5}
              style={{
                width: "100%",
                border: "1px solid var(--color-card-border)",
                borderRadius: 6,
                padding: "8px 10px",
                fontSize: 13,
                color: "var(--color-text)",
                background: "var(--color-bg)",
                resize: "vertical",
                outline: "none",
                fontFamily: "inherit",
                lineHeight: 1.5,
                boxSizing: "border-box",
                ...(tutorialMode ? { opacity: 0.7, cursor: "default" } : {}),
              }}
            />
            <TokenPreview tokens={tokenPreview.tokens} loading={tokenPreview.loading} />
            {overTokenLimit && (
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "#dc2626" }}>
                Prompt too long — {tokenCount} / {MAX_PROMPT_TOKENS} tokens. Trim to {MAX_PROMPT_TOKENS} or fewer.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--color-surface-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Top-k stepper — controls how many tokens appear in the pinned panel */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <span style={{ fontSize: 10, color: "var(--color-text-muted)", fontFamily: "var(--font-ibm-plex-sans), sans-serif", whiteSpace: "nowrap" }}>
                k
              </span>
              <button
                onClick={() => setTopK(k => Math.max(1, k - 1))}
                disabled={tutorialMode}
                style={{ fontSize: 11, width: 18, height: 22, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-surface-border)", border: "1px solid var(--color-card-border)", borderRadius: 3, cursor: tutorialMode ? "default" : "pointer", color: "var(--color-text-muted)", padding: 0 }}
              >
                −
              </button>
              <span style={{ fontSize: 11, fontFamily: "var(--font-ibm-plex-sans), sans-serif", color: "var(--color-text)", minWidth: 14, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
                {topK}
              </span>
              <button
                onClick={() => setTopK(k => Math.min(10, k + 1))}
                disabled={tutorialMode}
                style={{ fontSize: 11, width: 18, height: 22, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-surface-border)", border: "1px solid var(--color-card-border)", borderRadius: 3, cursor: tutorialMode ? "default" : "pointer", color: "var(--color-text-muted)", padding: 0 }}
              >
                +
              </button>
            </div>

            <button
              onClick={handleRun}
              disabled={!canRun}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: 6,
                border: "none",
                background: !canRun ? "var(--color-surface-border)" : "var(--color-accent)",
                color: !canRun ? "var(--color-text-muted)" : "var(--color-accent-fg)",
                fontSize: 13,
                fontWeight: 600,
                cursor: !canRun ? "not-allowed" : "pointer",
                letterSpacing: "0.02em",
                transition: "background 150ms",
              }}
              onMouseEnter={e => { if (canRun) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-accent-hover)"; }}
              onMouseLeave={e => { if (canRun) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-accent)"; }}
            >
              {"Run Lens →"}
            </button>
          </div>
        </div>
    </div>
  );
}
