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

  const stepperBtnCls =
    "flex h-[22px] w-[18px] cursor-pointer items-center justify-center rounded-[3px] border border-card-border bg-surface-border p-0 text-[11px] text-muted disabled:cursor-default";

  // Top-k stepper — controls how many tokens appear in the pinned panel
  const topKStepper = (
    <div className="flex shrink-0 items-center gap-1">
      <span className="whitespace-nowrap text-[10px] text-muted">
        k
      </span>
      <button onClick={() => setTopK(k => Math.max(1, k - 1))} disabled={tutorialMode} className={stepperBtnCls}>
        −
      </button>
      <span className="min-w-[14px] text-center text-[11px] tabular-nums text-foreground">
        {topK}
      </span>
      <button onClick={() => setTopK(k => Math.min(10, k + 1))} disabled={tutorialMode} className={stepperBtnCls}>
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
      <div className="mb-5">
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
        {overTokenLimit && (
          <p className="m-0 mt-1 text-[11px] text-red-600">
            Prompt too long — {tokenCount} / {MAX_PROMPT_TOKENS} tokens. Trim to {MAX_PROMPT_TOKENS} or fewer.
          </p>
        )}
      </div>
    </ConfigPaneShell>
  );
}
