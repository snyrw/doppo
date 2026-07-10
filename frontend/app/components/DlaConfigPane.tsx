"use client";

import { useState, useEffect } from "react";
import { useTokenPreview } from "../hooks/useTokenPreview";
import { useModelSelection, type ModelInfo } from "../hooks/useModelSelection";
import ConfigLedger, { type LedgerSection } from "./configledger/ConfigLedger";
import { FieldLabel, TargetSection } from "./configledger/fields";
import { modelSummary, promptSummary, targetSummary } from "./configledger/summaries";
import ModelPicker from "./ModelPicker";
import TokenPreview from "./TokenPreview";

type DlaConfigPaneProps = {
  isOpen: boolean;
  availableModels: ModelInfo[];
  modelsLoading: boolean;
  onSubmit: (config: {
    modelName: string;
    prompt: string;
    gpuTier?: string;
    targetPosition: number | "last";
    targetToken: string | null;
    contrastiveToken: string | null;
  }) => void;
  onClose: () => void;
  tutorialMode?: boolean;
  tutorialConfig?: {
    modelName: string;
    prompt: string;
    gpuTier: string;
    targetPosition: number | "last";
    targetToken: string | null;
    contrastiveToken: string | null;
  };
};

const DEFAULT_PROMPT = "The capital of France is Paris. The capital of Germany is";


export default function DlaConfigPane({
  isOpen,
  availableModels,
  modelsLoading,
  onSubmit,
  onClose,
  tutorialMode,
  tutorialConfig,
}: DlaConfigPaneProps) {
  const picker = useModelSelection(availableModels);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [positionMode, setPositionMode] = useState<"last" | "custom">("last");
  const [customPosition, setCustomPosition] = useState("");
  const [tokenMode, setTokenMode] = useState<"auto" | "custom">("auto");
  const [customToken, setCustomToken] = useState("");
  const [contrastiveToken, setContrastiveToken] = useState("");
  const [activeSection, setActiveSection] = useState("model");

  useEffect(() => {
    if (tutorialMode && tutorialConfig) {
      setPrompt(tutorialConfig.prompt);
      picker.forceModel(tutorialConfig.modelName);
      if (tutorialConfig.targetPosition === "last") {
        setPositionMode("last");
        setCustomPosition("");
      } else {
        setPositionMode("custom");
        setCustomPosition(String(tutorialConfig.targetPosition));
      }
      if (tutorialConfig.targetToken === null) {
        setTokenMode("auto");
        setCustomToken("");
      } else {
        setTokenMode("custom");
        setCustomToken(tutorialConfig.targetToken);
      }
      setContrastiveToken(tutorialConfig.contrastiveToken ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorialMode, tutorialConfig]);

  const doReset = () => {
    picker.reset();
    setPrompt(DEFAULT_PROMPT);
    setPositionMode("last");
    setCustomPosition("");
    setTokenMode("auto");
    setCustomToken("");
    setContrastiveToken("");
    setActiveSection("model");
  };

  const handleClose = () => {
    doReset();
    onClose();
  };

  const tokenPreview = useTokenPreview(isOpen ? picker.activeModelId : "", prompt);
  const targetTokenPreview = useTokenPreview(isOpen ? picker.activeModelId : "", tokenMode === "custom" ? customToken : "");
  const contrastivePreview = useTokenPreview(isOpen ? picker.activeModelId : "", contrastiveToken);
  const positionOk = positionMode === "last" || (customPosition.trim() !== "" && !isNaN(parseInt(customPosition)));
  const tokenOk = tokenMode === "auto" || customToken.trim() !== "";
  const canRun = picker.modelOk && positionOk && tokenOk;

  const handleRun = () => {
    if (!canRun) return;
    const { modelName, gpuTier } = picker;
    const targetPosition: number | "last" = positionMode === "last" ? "last" : parseInt(customPosition);
    const targetToken: string | null = tokenMode === "auto" ? null : (customToken || null);
    const contrastiveTokenVal: string | null = contrastiveToken || null;
    onSubmit({ modelName, prompt, gpuTier, targetPosition, targetToken, contrastiveToken: contrastiveTokenVal });
    doReset();
  };

  if (!isOpen) return null;

  const displayName = picker.modelName || null;
  const targetSum = targetSummary({ positionMode, customPosition, tokenMode, customToken, contrastiveToken });

  const sections: LedgerSection[] = [
    {
      id: "model",
      label: "Model",
      summary: modelSummary(displayName),
      body: (
        <ModelPicker picker={picker} models={availableModels} modelsLoading={modelsLoading}
          tutorialMode={tutorialMode} tutorialModelName={tutorialConfig?.modelName} />
      ),
    },
    {
      id: "prompt",
      label: "Prompt",
      summary: promptSummary(prompt),
      body: (
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
        </div>
      ),
    },
    {
      id: "target",
      label: "Target",
      summary: targetSum,
      body: (
        <TargetSection
          name="dla"
          positionMode={positionMode} customPosition={customPosition}
          onPositionMode={setPositionMode} onCustomPosition={setCustomPosition}
          tokenMode={tokenMode} customToken={customToken}
          onTokenMode={setTokenMode} onCustomToken={setCustomToken}
          targetTokenPreview={targetTokenPreview}
          contrastiveToken={contrastiveToken} onContrastiveToken={setContrastiveToken}
          contrastivePreview={contrastivePreview}
          contrastivePlaceholder={`e.g. " Berlin"`}
          contrastiveHelp="When set, uses logit difference (target − contrastive) as the attribution direction."
          disabled={tutorialMode}
        />
      ),
    },
  ];

  return (
    <ConfigLedger
      title="DLA — new card"
      sections={sections}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      footerSummary={`${modelSummary(displayName)} · ${promptSummary(prompt, 16)} · ${targetSum}`}
      canRun={canRun}
      runLabel="Run DLA"
      onRun={handleRun}
      onClose={handleClose}
    />
  );
}
