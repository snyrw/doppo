"use client";

import { useState, useEffect } from "react";
import { useTokenPreview } from "../hooks/useTokenPreview";
import { useModelSelection, type ModelInfo } from "../hooks/useModelSelection";
import ConfigPaneShell from "./ConfigPaneShell";
import ModelPicker from "./ModelPicker";
import TokenPreview from "./TokenPreview";
import { cn } from "../lib/cn";

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

  const radioCls = "flex cursor-pointer items-center gap-1.5 text-xs text-foreground";
  const radioInputCls = "h-[13px] w-[13px] shrink-0 cursor-pointer accent-[var(--accent)]";
  const smallInputCls = "rounded-[5px] bg-background text-[11px] text-foreground outline-none transition-colors";

  return (
    <ConfigPaneShell
      title="New DLA"
      canRun={canRun}
      runLabel="Run DLA →"
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
        </div>

        {/* Analysis target section */}
        <div className="mb-1 border-t border-surface-border pt-4">
          <label className="mb-3 block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            Analysis Target
          </label>

          {/* Position */}
          <div className="mb-3.5">
            <span className="mb-2 block text-[11px] font-medium text-foreground">
              Position
            </span>
            <div className="flex flex-col gap-[7px]">
              <label className={radioCls}>
                <input
                  type="radio"
                  name="dla-position"
                  checked={positionMode === "last"}
                  onChange={() => setPositionMode("last")}
                  disabled={tutorialMode}
                  className={radioInputCls}
                />
                Last token
                <span className="ml-0.5 text-[10px] text-muted">
                  — next-token prediction (most common)
                </span>
              </label>
              <label className={cn(radioCls, "items-start")}>
                <input
                  type="radio"
                  name="dla-position"
                  checked={positionMode === "custom"}
                  onChange={() => setPositionMode("custom")}
                  disabled={tutorialMode}
                  className={cn(radioInputCls, "mt-0.5")}
                />
                <span>Token index</span>
                <input
                  type="number"
                  min={0}
                  placeholder="e.g. 3"
                  value={customPosition}
                  onFocus={() => setPositionMode("custom")}
                  onChange={e => { setPositionMode("custom"); setCustomPosition(e.target.value); }}
                  disabled={tutorialMode}
                  className={cn(smallInputCls, "ml-1.5 w-[72px] border px-1.5 py-[3px]", positionMode === "custom" ? "border-accent" : "border-card-border")}
                />
              </label>
            </div>
          </div>

          {/* Target token */}
          <div className="mb-3.5">
            <span className="mb-2 block text-[11px] font-medium text-foreground">
              Target token
            </span>
            <div className="flex flex-col gap-[7px]">
              <label className={radioCls}>
                <input
                  type="radio"
                  name="dla-token"
                  checked={tokenMode === "auto"}
                  onChange={() => setTokenMode("auto")}
                  disabled={tutorialMode}
                  className={radioInputCls}
                />
                Top prediction
                <span className="ml-0.5 text-[10px] text-muted">
                  — attribute the model&apos;s most likely next token
                </span>
              </label>
              <label className={cn(radioCls, "items-start")}>
                <input
                  type="radio"
                  name="dla-token"
                  checked={tokenMode === "custom"}
                  onChange={() => setTokenMode("custom")}
                  disabled={tutorialMode}
                  className={cn(radioInputCls, "mt-0.5")}
                />
                <span className="shrink-0">Specify</span>
                <input
                  type="text"
                  placeholder={`e.g. " Paris"`}
                  value={customToken}
                  onFocus={() => setTokenMode("custom")}
                  onChange={e => { setTokenMode("custom"); setCustomToken(e.target.value); }}
                  disabled={tutorialMode}
                  className={cn(smallInputCls, "ml-1.5 flex-1 border px-1.5 py-[3px]", tokenMode === "custom" ? "border-accent" : "border-card-border")}
                />
              </label>
            </div>
            {tokenMode === "custom" && (targetTokenPreview.tokens || targetTokenPreview.loading) && (
              <div className="ml-[22px] mt-0.5">
                <TokenPreview tokens={targetTokenPreview.tokens} loading={targetTokenPreview.loading} />
                {targetTokenPreview.tokens && targetTokenPreview.tokens.length > 1 && (
                  <p className="m-0 mt-[3px] text-[10px] text-amber-600">
                    ⚠ Multi-token — only the first will be used. Try adding a leading space (e.g. &ldquo;{" " + customToken.trim()}&rdquo;).
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Contrastive token (optional) */}
          <div>
            <span className="mb-1 block text-[11px] font-medium text-foreground">
              Contrastive token
              <span className="ml-1.5 text-[10px] font-normal text-muted">optional</span>
            </span>
            <input
              type="text"
              placeholder={`e.g. " Berlin" — enables logit difference`}
              value={contrastiveToken}
              onChange={e => setContrastiveToken(e.target.value)}
              disabled={tutorialMode}
              className={cn(smallInputCls, "box-border w-full border px-2 py-1", contrastiveToken.trim() ? "border-accent" : "border-card-border")}
            />
            {(contrastivePreview.tokens || contrastivePreview.loading) && (
              <div className="mt-0.5">
                <TokenPreview tokens={contrastivePreview.tokens} loading={contrastivePreview.loading} />
                {contrastivePreview.tokens && contrastivePreview.tokens.length > 1 && (
                  <p className="m-0 mt-[3px] text-[10px] text-amber-600">
                    ⚠ Multi-token — only the first will be used. Try adding a leading space (e.g. &ldquo;{" " + contrastiveToken.trim()}&rdquo;).
                  </p>
                )}
              </div>
            )}
            <p className="m-0 mt-[5px] text-[10px] leading-normal text-muted">
              When set, uses logit difference (target − contrastive) as the attribution direction — the standard metric for contrastive tasks like IOI.
            </p>
          </div>
        </div>
    </ConfigPaneShell>
  );
}
