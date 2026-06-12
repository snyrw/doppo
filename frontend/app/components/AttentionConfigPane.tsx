"use client";

import { useState, useEffect } from "react";
import { useTokenPreview } from "../hooks/useTokenPreview";
import { useModelSelection, type ModelInfo } from "../hooks/useModelSelection";
import ModelPicker from "./ModelPicker";
import TokenPreview from "./TokenPreview";

type AttentionConfigPaneProps = {
  isOpen: boolean;
  availableModels: ModelInfo[];
  modelsLoading: boolean;
  onSubmit: (config: { modelName: string; prompt: string; gpuTier?: string }) => void;
  onClose: () => void;
  tutorialMode?: boolean;
  tutorialConfig?: {
    modelName: string;
    prompt: string;
    gpuTier: string;
  };
};

const DEFAULT_PROMPT = "The capital of France is Paris. The capital of Germany is";

export default function AttentionConfigPane({
  isOpen,
  availableModels,
  modelsLoading,
  onSubmit,
  onClose,
  tutorialMode,
  tutorialConfig,
}: AttentionConfigPaneProps) {
  const picker = useModelSelection(availableModels);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);

  useEffect(() => {
    if (tutorialMode && tutorialConfig) {
      setPrompt(tutorialConfig.prompt);
      picker.forceModel(tutorialConfig.modelName);
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

  const tokenPreview = useTokenPreview(isOpen ? picker.activeModelId : "", prompt);
  const canRun = picker.modelOk && prompt.trim() !== "";

  const handleRun = () => {
    if (!canRun) return;
    onSubmit({ modelName: picker.modelName, prompt, gpuTier: picker.gpuTier });
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 12px", borderBottom: "1px solid var(--color-surface-border)" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)", letterSpacing: "0.01em" }}>
          New Attention
        </span>
        <button
          onClick={handleClose}
          style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4, border: "none", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer", fontSize: 16, lineHeight: 1, transition: "background 120ms, color 120ms" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)"; }}
        >
          ×
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>

        {/* Featured models / model selection */}
        <ModelPicker
          picker={picker}
          models={availableModels}
          modelsLoading={modelsLoading}
          tutorialMode={tutorialMode}
          tutorialModelName={tutorialConfig?.modelName}
        />

        <div>
          <label style={{ display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: 6 }}>
            Prompt
          </label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            disabled={tutorialMode}
            rows={5}
            style={{ width: "100%", border: "1px solid var(--color-card-border)", borderRadius: 6, padding: "8px 10px", fontSize: 13, color: "var(--color-text)", background: "var(--color-bg)", resize: "vertical", outline: "none", fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box", ...(tutorialMode ? { opacity: 0.7, cursor: "default" } : {}) }}
          />
          <TokenPreview tokens={tokenPreview.tokens} loading={tokenPreview.loading} />
        </div>
      </div>

      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--color-surface-border)" }}>
        <button
          onClick={handleRun}
          disabled={!canRun}
          style={{ width: "100%", padding: "10px 0", borderRadius: 6, border: "none", background: !canRun ? "var(--color-surface-border)" : "var(--color-accent)", color: !canRun ? "var(--color-text-muted)" : "var(--color-accent-fg)", fontSize: 13, fontWeight: 600, cursor: !canRun ? "not-allowed" : "pointer", letterSpacing: "0.02em", transition: "background 150ms" }}
          onMouseEnter={e => { if (canRun) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-accent-hover)"; }}
          onMouseLeave={e => { if (canRun) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-accent)"; }}
        >
          {"Run Attention →"}
        </button>
      </div>
    </div>
  );
}
