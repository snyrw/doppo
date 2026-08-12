"use client";

import { useState } from "react";
import { useTokenPreview } from "../hooks/useTokenPreview";
import { useModelSelection, type ModelInfo } from "../hooks/useModelSelection";
import ConfigLedger, { type LedgerSection } from "./configledger/ConfigLedger";
import { useConfigPaneLifecycle } from "./configledger/useConfigPaneLifecycle";
import { FieldLabel } from "./configledger/fields";
import { modelSummary, promptSummary } from "./configledger/summaries";
import ModelPicker from "./ModelPicker";
import TokenPreview from "./TokenPreview";
import { techniqueForCard } from "../lib/techniques";
import { LENS_TOP_K } from "../lib/lens";

const MAX_PROMPT_TOKENS = 48;

type LensConfigPaneProps = {
  isOpen: boolean;
  availableModels: ModelInfo[];
  modelsLoading: boolean;
  onSubmit: (config: { modelName: string; prompt: string; gpuTier?: string; topK: number }) => void;
  onClose: () => void;
};

const DEFAULT_PROMPT = "The capital of France is Paris. The capital of Germany is";

export default function LensConfigPane({
  isOpen,
  availableModels,
  modelsLoading,
  onSubmit,
  onClose,
}: LensConfigPaneProps) {
  const picker = useModelSelection(availableModels);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const { activeSection, setActiveSection, doReset, handleClose } = useConfigPaneLifecycle(onClose, () => {
    picker.reset();
    setPrompt(DEFAULT_PROMPT);
  });

  const tokenPreview = useTokenPreview(isOpen ? picker.activeModelId : "", prompt);

  const tokenCount = tokenPreview.tokens?.length ?? 0;
  const overTokenLimit = tokenPreview.tokens !== null && tokenCount > MAX_PROMPT_TOKENS;
  const canRun = !overTokenLimit && picker.modelOk;

  const handleRun = () => {
    if (!canRun) return;
    onSubmit({ modelName: picker.modelName, prompt, gpuTier: picker.gpuTier, topK: LENS_TOP_K });
    doReset();
  };

  if (!isOpen) return null;

  const displayName = picker.modelName || null;

  const sections: LedgerSection[] = [
    {
      id: "model",
      label: "Model",
      body: (
        <ModelPicker
          picker={picker}
          models={availableModels}
          modelsLoading={modelsLoading}
        />
      ),
    },
    {
      id: "prompt",
      label: "Prompt",
      body: (
        <div>
          <FieldLabel>Prompt</FieldLabel>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={5}
            className="box-border w-full resize-y rounded-[var(--ctl-radius-xs)] border border-card-border bg-background px-2.5 py-2 font-[inherit] text-[13px] leading-normal text-foreground outline-none disabled:cursor-default disabled:opacity-70"
          />
          <TokenPreview tokens={tokenPreview.tokens} loading={tokenPreview.loading} />
          {overTokenLimit && (
            <p className="m-0 mt-1 text-[11px] text-red-600">
              Prompt too long: {tokenCount} / {MAX_PROMPT_TOKENS} tokens. Trim to {MAX_PROMPT_TOKENS} or fewer.
            </p>
          )}
        </div>
      ),
    },
  ];

  const footerSummary = `${modelSummary(displayName)} · ${promptSummary(prompt, 20)}`;

  return (
    <ConfigLedger
      title="Logit Lens"
      accent={techniqueForCard("logit-lens").band}
      sections={sections}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      footerSummary={footerSummary}
      canRun={canRun}
      runLabel="Run"
      onRun={handleRun}
      onClose={handleClose}
    />
  );
}
