"use client";

import { useState, useEffect } from "react";
import { useTokenPreview } from "../hooks/useTokenPreview";
import { useModelSelection, type ModelInfo } from "../hooks/useModelSelection";
import ConfigPaneShell from "./ConfigPaneShell";
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

  const stepperBtnStyle = {
    fontSize: 11,
    width: 18,
    height: 22,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--color-surface-border)",
    border: "1px solid var(--color-card-border)",
    borderRadius: 3,
    cursor: tutorialMode ? "default" : "pointer",
    color: "var(--color-text-muted)",
    padding: 0,
  } as const;

  // Top-k stepper — controls how many tokens appear in the pinned panel
  const topKStepper = (
    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
      <span style={{ fontSize: 10, color: "var(--color-text-muted)", fontFamily: "var(--font-ibm-plex-sans), sans-serif", whiteSpace: "nowrap" }}>
        k
      </span>
      <button onClick={() => setTopK(k => Math.max(1, k - 1))} disabled={tutorialMode} style={stepperBtnStyle}>
        −
      </button>
      <span style={{ fontSize: 11, fontFamily: "var(--font-ibm-plex-sans), sans-serif", color: "var(--color-text)", minWidth: 14, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
        {topK}
      </span>
      <button onClick={() => setTopK(k => Math.min(10, k + 1))} disabled={tutorialMode} style={stepperBtnStyle}>
        +
      </button>
    </div>
  );

  return (
    <ConfigPaneShell
      title="New Lens"
      canRun={canRun}
      runLabel="Run Lens →"
      onRun={handleRun}
      onClose={handleClose}
      footerExtra={topKStepper}
    >
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
    </ConfigPaneShell>
  );
}
