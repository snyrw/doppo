"use client";

import { useState } from "react";
import { useTokenPreview } from "../hooks/useTokenPreview";
import { useModelSelection, type ModelInfo } from "../hooks/useModelSelection";
import { useCanAffordTier } from "../hooks/useCanAffordTier";
import ConfigLedger, { type LedgerSection } from "./configledger/ConfigLedger";
import { useConfigPaneLifecycle } from "./configledger/useConfigPaneLifecycle";
import { FieldLabel } from "./configledger/fields";
import { PANEL_META } from "./configledger/panel-type";
import { modelSummary, promptSummary } from "./configledger/summaries";
import ModelPicker from "./ModelPicker";
import TokenPreview from "./TokenPreview";
import { techniqueForCard } from "../lib/techniques";
import { cn } from "../lib/cn";

type AttentionConfigPaneProps = {
  isOpen: boolean;
  availableModels: ModelInfo[];
  modelsLoading: boolean;
  onSubmit: (config: { modelName: string; prompt: string; gpuTier?: string }) => void;
  onClose: () => void;
};

const DEFAULT_PROMPT = "The capital of France is Paris. The capital of Germany is";

export default function AttentionConfigPane({
  isOpen,
  availableModels,
  modelsLoading,
  onSubmit,
  onClose,
}: AttentionConfigPaneProps) {
  const picker = useModelSelection(availableModels);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const { activeSection, setActiveSection, doReset, handleClose } = useConfigPaneLifecycle(onClose, () => {
    picker.reset();
    setPrompt(DEFAULT_PROMPT);
  });

  const tokenPreview = useTokenPreview(isOpen ? picker.activeModelId : "", prompt);
  const locallyOk = picker.modelOk && prompt.trim() !== "";
  const afford = useCanAffordTier(picker.gpuTier);
  const canRun = locallyOk && afford.affordable;
  const disabledReason = locallyOk && !afford.affordable ? "Add balance to run this tier" : undefined;

  const handleRun = () => {
    if (!canRun) return;
    onSubmit({ modelName: picker.modelName, prompt, gpuTier: picker.gpuTier });
    doReset();
  };

  if (!isOpen) return null;

  const displayName = picker.modelName || null;

  const sections: LedgerSection[] = [
    {
      id: "model",
      label: "Model",
      body: (
        <ModelPicker picker={picker} models={availableModels} modelsLoading={modelsLoading} />
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
          {tokenPreview.tokens !== null && tokenPreview.tokens.length > 30 && (
            <p className={cn(PANEL_META, "m-0 mt-1")}>
              Attention view uses the first 30 tokens.
            </p>
          )}
        </div>
      ),
    },
  ];

  return (
    <ConfigLedger
      title="Attention"
      accent={techniqueForCard("attention-pattern").band}
      sections={sections}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      footerSummary={`${modelSummary(displayName)} · ${promptSummary(prompt, 24)}`}
      gpuTier={picker.gpuTier}
      canRun={canRun}
      disabledReason={disabledReason}
      runLabel="Run"
      onRun={handleRun}
      onClose={handleClose}
    />
  );
}
