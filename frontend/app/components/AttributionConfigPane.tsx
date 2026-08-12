"use client";

import { useState } from "react";
import { useTokenPreview } from "../hooks/useTokenPreview";
import { useModelSelection, type ModelInfo } from "../hooks/useModelSelection";
import ConfigLedger, { type LedgerSection } from "./configledger/ConfigLedger";
import { useConfigPaneLifecycle } from "./configledger/useConfigPaneLifecycle";
import { TargetSection, PromptField } from "./configledger/fields";
import { PANEL_META } from "./configledger/panel-type";
import { modelSummary, promptSummary, targetSummary } from "./configledger/summaries";
import ModelPicker from "./ModelPicker";
import { techniqueForCard } from "../lib/techniques";
import { cn } from "../lib/cn";

type AttributionConfigPaneProps = {
  isOpen: boolean;
  availableModels: ModelInfo[];
  modelsLoading: boolean;
  onSubmit: (config: {
    modelName: string;
    cleanPrompt: string;
    corruptedPrompt: string;
    gpuTier?: string;
    targetPosition: number | "last";
    targetToken: string | null;
    contrastiveToken: string | null;
  }) => void;
  onClose: () => void;
};

const DEFAULT_CLEAN_PROMPT = "When Mary and John went to the store, John gave a drink to";
const DEFAULT_CORRUPTED_PROMPT = "When Mary and John went to the store, Mary gave a drink to";

export default function AttributionConfigPane({
  isOpen,
  availableModels,
  modelsLoading,
  onSubmit,
  onClose,
}: AttributionConfigPaneProps) {
  const picker = useModelSelection(availableModels);
  const [cleanPrompt, setCleanPrompt] = useState(DEFAULT_CLEAN_PROMPT);
  const [corruptedPrompt, setCorruptedPrompt] = useState(DEFAULT_CORRUPTED_PROMPT);
  const [positionMode, setPositionMode] = useState<"last" | "custom">("last");
  const [customPosition, setCustomPosition] = useState("");
  const [tokenMode, setTokenMode] = useState<"auto" | "custom">("auto");
  const [customToken, setCustomToken] = useState("");
  const [contrastiveToken, setContrastiveToken] = useState("");
  const { activeSection, setActiveSection, doReset, handleClose } = useConfigPaneLifecycle(onClose, () => {
    picker.reset();
    setCleanPrompt(DEFAULT_CLEAN_PROMPT);
    setCorruptedPrompt(DEFAULT_CORRUPTED_PROMPT);
    setPositionMode("last");
    setCustomPosition("");
    setTokenMode("auto");
    setCustomToken("");
    setContrastiveToken("");
  });

  const cleanPreview = useTokenPreview(isOpen ? picker.activeModelId : "", cleanPrompt);
  const corruptedPreview = useTokenPreview(isOpen ? picker.activeModelId : "", corruptedPrompt);
  const targetTokenPreview = useTokenPreview(isOpen ? picker.activeModelId : "", tokenMode === "custom" ? customToken : "");
  const contrastivePreview = useTokenPreview(isOpen ? picker.activeModelId : "", contrastiveToken);
  const positionOk = positionMode === "last" || (customPosition.trim() !== "" && !isNaN(parseInt(customPosition)));
  const tokenOk = tokenMode === "auto" || customToken.trim() !== "";
  const cleanToks = cleanPreview.tokens?.length;
  const corruptedToks = corruptedPreview.tokens?.length;
  const lengthMismatch = cleanToks != null && corruptedToks != null && cleanToks !== corruptedToks;
  const canRun = picker.modelOk && positionOk && tokenOk && cleanPrompt.trim() !== "" && corruptedPrompt.trim() !== "" && !lengthMismatch;

  const handleRun = () => {
    if (!canRun) return;
    const { modelName, gpuTier } = picker;
    const targetPosition: number | "last" = positionMode === "last" ? "last" : parseInt(customPosition);
    const targetToken: string | null = tokenMode === "auto" ? null : (customToken || null);
    const contrastiveTokenVal: string | null = contrastiveToken || null;
    onSubmit({ modelName, cleanPrompt, corruptedPrompt, gpuTier, targetPosition, targetToken, contrastiveToken: contrastiveTokenVal });
    doReset();
  };

  if (!isOpen) return null;

  const displayName = picker.modelName || null;
  const targetSum = targetSummary({ positionMode, customPosition, tokenMode, customToken, contrastiveToken });
  const pairSummary = cleanPrompt.trim() === "" && corruptedPrompt.trim() === ""
    ? "empty"
    : `${promptSummary(cleanPrompt, 14)} vs ${promptSummary(corruptedPrompt, 14)}`;

  const sections: LedgerSection[] = [
    {
      id: "model",
      label: "Model",
      body: (
        <ModelPicker picker={picker} models={availableModels} modelsLoading={modelsLoading} />
      ),
    },
    {
      id: "pair",
      label: "Contrast pair",
      body: (
        <div className="flex flex-col gap-4">
          {/* Prompts */}
          <PromptField
            label="Reference Prompt"
            value={cleanPrompt}
            onChange={setCleanPrompt}
            preview={cleanPreview}
            placeholder="Where the behavior you want to explain occurs"
          />

          <div>
            <PromptField
              label="Counterfactual Prompt"
              value={corruptedPrompt}
              onChange={setCorruptedPrompt}
              preview={corruptedPreview}
              placeholder="A variation that changes the behavior"
            />
            {lengthMismatch && (
              <p className="m-0 mt-1.5 text-[10px] leading-normal text-red-600">
                Prompts must tokenize to the same length ({cleanToks} vs {corruptedToks}).
              </p>
            )}
            <p className={cn(PANEL_META, "m-0 mt-2")}>
              Scores each component by how much its activation change (reference → counterfactual) moves the target logit.{" "}
              <em>Verify top K</em> then runs causal activation patches on the top candidates to confirm.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "target",
      label: "Target",
      body: (
        <TargetSection
          name="attr"
          positionMode={positionMode} customPosition={customPosition}
          onPositionMode={setPositionMode} onCustomPosition={setCustomPosition}
          tokenMode={tokenMode} customToken={customToken}
          onTokenMode={setTokenMode} onCustomToken={setCustomToken}
          targetTokenPreview={targetTokenPreview}
          contrastiveToken={contrastiveToken} onContrastiveToken={setContrastiveToken}
          contrastivePreview={contrastivePreview}
          contrastivePlaceholder={`e.g. " John"`}
          contrastiveHelp="When set, the gradient metric becomes logit(target) − logit(contrastive)."
        />
      ),
    },
  ];

  return (
    <ConfigLedger
      title="Attribution"
      accent={techniqueForCard("attribution").band}
      sections={sections}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      footerSummary={`${modelSummary(displayName)} · ${pairSummary} · ${targetSum}`}
      canRun={canRun}
      runLabel="Run"
      onRun={handleRun}
      onClose={handleClose}
    />
  );
}
