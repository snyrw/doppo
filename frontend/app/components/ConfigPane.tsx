"use client";

import { useState, useEffect } from "react";
import { useTokenPreview } from "../hooks/useTokenPreview";
import { useModelSelection, type ModelInfo } from "../hooks/useModelSelection";
import ConfigLedger, { type LedgerSection } from "./configledger/ConfigLedger";
import { FieldLabel } from "./configledger/fields";
import { modelSummary, promptSummary, decodingSummary } from "./configledger/summaries";
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
  const [activeSection, setActiveSection] = useState("model");

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
    setActiveSection("model");
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

  const displayName = picker.modelName || null;

  const sections: LedgerSection[] = [
    {
      id: "model",
      label: "Model",
      summary: modelSummary(displayName),
      body: (
        <ModelPicker
          picker={picker}
          models={availableModels}
          modelsLoading={modelsLoading}
          tutorialMode={tutorialMode}
          tutorialModelName={tutorialConfig?.modelName}
        />
      ),
    },
    {
      id: "prompt",
      label: "Prompt",
      summary: `${promptSummary(prompt)} · ${decodingSummary(topK)}`,
      body: (
        <div className="flex flex-col gap-4">
          <div>
            <FieldLabel>Prompt</FieldLabel>
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
                Prompt too long: {tokenCount} / {MAX_PROMPT_TOKENS} tokens. Trim to {MAX_PROMPT_TOKENS} or fewer.
              </p>
            )}
          </div>
          <div>
            <FieldLabel meta="candidate tokens per cell">Decoding · top-k</FieldLabel>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setTopK(k => Math.max(1, k - 1))}
                onPointerDown={e => e.stopPropagation()}
                disabled={tutorialMode}
                className="flex h-[22px] w-[22px] items-center justify-center rounded-[3px] border border-card-border bg-surface-border text-[13px] text-muted disabled:cursor-default"
              >−</button>
              <span className="min-w-[22px] text-center font-mono text-[12px] tabular-nums text-foreground">{topK}</span>
              <button
                onClick={() => setTopK(k => Math.min(10, k + 1))}
                onPointerDown={e => e.stopPropagation()}
                disabled={tutorialMode}
                className="flex h-[22px] w-[22px] items-center justify-center rounded-[3px] border border-card-border bg-surface-border text-[13px] text-muted disabled:cursor-default"
              >+</button>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const footerSummary = `${modelSummary(displayName)} · ${promptSummary(prompt, 20)} · ${decodingSummary(topK)}`;

  return (
    <ConfigLedger
      title="Logit lens — new card"
      sections={sections}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      footerSummary={footerSummary}
      canRun={canRun}
      runLabel="Run lens"
      onRun={handleRun}
      onClose={handleClose}
    />
  );
}
