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
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
          Prompt
        </label>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          disabled={tutorialMode}
          rows={5}
          className="box-border w-full resize-y rounded-md border border-card-border bg-background px-2.5 py-2 font-[inherit] text-[13px] leading-normal text-foreground outline-none disabled:cursor-default disabled:opacity-70"
        />
        <TokenPreview tokens={tokenPreview.tokens} loading={tokenPreview.loading} />
      </div>
    </ConfigPaneShell>
  );
}
