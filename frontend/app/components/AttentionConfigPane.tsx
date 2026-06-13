"use client";

import { useState, useEffect } from "react";
import { useTokenPreview } from "../hooks/useTokenPreview";
import { useModelSelection, type ModelInfo } from "../hooks/useModelSelection";
import ConfigPaneShell from "./ConfigPaneShell";
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
    <ConfigPaneShell
      title="New Attention"
      canRun={canRun}
      runLabel="Run Attention →"
      onRun={handleRun}
      onClose={handleClose}
    >
      {/* Featured models / model selection */}
      <ModelPicker
        picker={picker}
        models={availableModels}
        modelsLoading={modelsLoading}
        tutorialMode={tutorialMode}
        tutorialModelName={tutorialConfig?.modelName}
      />

      <div>
        <label style={{ display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>
          Prompt
        </label>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          disabled={tutorialMode}
          rows={5}
          style={{ width: "100%", border: "1px solid var(--card-border)", borderRadius: 6, padding: "8px 10px", fontSize: 13, color: "var(--text)", background: "var(--bg)", resize: "vertical", outline: "none", fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box", ...(tutorialMode ? { opacity: 0.7, cursor: "default" } : {}) }}
        />
        <TokenPreview tokens={tokenPreview.tokens} loading={tokenPreview.loading} />
      </div>
    </ConfigPaneShell>
  );
}
