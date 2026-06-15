"use client";

import { useState, useEffect } from "react";
import { useTokenPreview } from "../hooks/useTokenPreview";
import { useModelSelection, type ModelInfo } from "../hooks/useModelSelection";
import ConfigPaneShell from "./ConfigPaneShell";
import ModelPicker from "./ModelPicker";
import TokenPreview from "./TokenPreview";
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
  tutorialMode?: boolean;
  tutorialConfig?: {
    modelName: string;
    cleanPrompt: string;
    corruptedPrompt: string;
    gpuTier: string;
    targetPosition: number | "last";
    targetToken: string | null;
    contrastiveToken: string | null;
  };
};

const DEFAULT_CLEAN_PROMPT = "When Mary and John went to the store, John gave a drink to";
const DEFAULT_CORRUPTED_PROMPT = "When Mary and John went to the store, Mary gave a drink to";

export default function AttributionConfigPane({
  isOpen,
  availableModels,
  modelsLoading,
  onSubmit,
  onClose,
  tutorialMode,
  tutorialConfig,
}: AttributionConfigPaneProps) {
  const picker = useModelSelection(availableModels);
  const [cleanPrompt, setCleanPrompt] = useState(DEFAULT_CLEAN_PROMPT);
  const [corruptedPrompt, setCorruptedPrompt] = useState(DEFAULT_CORRUPTED_PROMPT);
  const [positionMode, setPositionMode] = useState<"last" | "custom">("last");
  const [customPosition, setCustomPosition] = useState("");
  const [tokenMode, setTokenMode] = useState<"auto" | "custom">("auto");
  const [customToken, setCustomToken] = useState("");
  const [contrastiveToken, setContrastiveToken] = useState("");

  useEffect(() => {
    if (tutorialMode && tutorialConfig) {
      setCleanPrompt(tutorialConfig.cleanPrompt);
      setCorruptedPrompt(tutorialConfig.corruptedPrompt);
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
    setCleanPrompt(DEFAULT_CLEAN_PROMPT);
    setCorruptedPrompt(DEFAULT_CORRUPTED_PROMPT);
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

  const cleanPreview = useTokenPreview(isOpen ? picker.activeModelId : "", cleanPrompt);
  const corruptedPreview = useTokenPreview(isOpen ? picker.activeModelId : "", corruptedPrompt);
  const targetTokenPreview = useTokenPreview(isOpen ? picker.activeModelId : "", tokenMode === "custom" ? customToken : "");
  const contrastivePreview = useTokenPreview(isOpen ? picker.activeModelId : "", contrastiveToken);
  const positionOk = positionMode === "last" || (customPosition.trim() !== "" && !isNaN(parseInt(customPosition)));
  const tokenOk = tokenMode === "auto" || customToken.trim() !== "";
  const canRun = picker.modelOk && positionOk && tokenOk && cleanPrompt.trim() !== "" && corruptedPrompt.trim() !== "";

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

  const radioCls = "flex cursor-pointer items-center gap-1.5 text-xs text-foreground";
  const radioInputCls = "h-[13px] w-[13px] shrink-0 cursor-pointer accent-[var(--accent)]";
  const smallInputCls = "rounded-[5px] bg-background text-[11px] text-foreground outline-none transition-colors";
  const promptLabelCls = "text-[10px] font-semibold uppercase tracking-[0.08em] text-muted";
  const promptCls = "box-border w-full resize-y rounded-md border border-card-border bg-background px-2.5 py-2 font-[inherit] text-xs leading-normal text-foreground outline-none disabled:cursor-default disabled:opacity-70";

  return (
    <ConfigPaneShell
      title="New Attribution"
      width={400}
      canRun={canRun}
      runLabel="Run Attribution →"
      onRun={handleRun}
      onClose={handleClose}
    >
        {/* Featured models / model selection */}
        <ModelPicker
          picker={picker}
          models={availableModels}
          modelsLoading={modelsLoading}
          gridMaxHeight={200}
          tutorialMode={tutorialMode}
          tutorialModelName={tutorialConfig?.modelName}
        />

        {/* Prompts */}
        <div className="mb-4">
          <div className="mb-1.5 flex items-baseline justify-between">
            <label className={promptLabelCls}>
              Reference Prompt
            </label>
            <span className="text-[9px] text-muted">
              {cleanPrompt.trim() ? cleanPrompt.trim().split(/\s+/).length : 0}w
            </span>
          </div>
          <textarea
            value={cleanPrompt}
            onChange={e => setCleanPrompt(e.target.value)}
            disabled={tutorialMode}
            rows={3}
            placeholder="Where the behavior you want to explain occurs"
            className={promptCls}
          />
          <TokenPreview tokens={cleanPreview.tokens} loading={cleanPreview.loading} />
        </div>

        <div className="mb-5">
          <div className="mb-1.5 flex items-baseline justify-between">
            <label className={promptLabelCls}>
              Counterfactual Prompt
            </label>
            <span className="text-[9px] text-muted">
              {corruptedPrompt.trim() ? corruptedPrompt.trim().split(/\s+/).length : 0}w
            </span>
          </div>
          <textarea
            value={corruptedPrompt}
            onChange={e => setCorruptedPrompt(e.target.value)}
            disabled={tutorialMode}
            rows={3}
            placeholder="A variation that changes the behavior"
            className={promptCls}
          />
          <TokenPreview tokens={corruptedPreview.tokens} loading={corruptedPreview.loading} />
          {/* Token count mismatch warning — upgrade to real token count when available */}
          {(() => {
            const cleanToks = cleanPreview.tokens?.length;
            const corruptedToks = corruptedPreview.tokens?.length;
            if (cleanToks != null && corruptedToks != null && cleanToks !== corruptedToks) {
              return (
                <p className="m-0 mt-1.5 text-[10px] leading-normal text-amber-600">
                  ⚠ Token counts differ ({cleanToks} vs {corruptedToks}). Patching works best when prompts tokenize to the same length — consider using a minimal substitution (e.g. swap one name).
                </p>
              );
            }
            const cw = cleanPrompt.trim().split(/\s+/).length;
            const rw = corruptedPrompt.trim().split(/\s+/).length;
            return cleanToks == null && cleanPrompt.trim() && corruptedPrompt.trim() && cw !== rw ? (
              <p className="m-0 mt-1.5 text-[10px] leading-normal text-amber-600">
                ⚠ Word counts differ ({cw} vs {rw}). Patching works best when prompts tokenize to the same length — consider using a minimal substitution (e.g. swap one name).
              </p>
            ) : null;
          })()}
          <p className="m-0 mt-2 text-[11px] leading-relaxed text-muted">
            Attribution patching scores each component by how much its activation change (reference → counterfactual) points toward the target token.{" "}
            <em>Verify top K</em> on the result card then runs causal activation patches on the top candidates to confirm.
          </p>
        </div>

        {/* Analysis target */}
        <div className="mb-1 border-t border-surface-border pt-4">
          <label className="mb-3 block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            Analysis Target
          </label>

          <div className="mb-3.5">
            <span className="mb-2 block text-[11px] font-medium text-foreground">Position</span>
            <div className="flex flex-col gap-[7px]">
              <label className={radioCls}>
                <input type="radio" name="attr-position" checked={positionMode === "last"} onChange={() => setPositionMode("last")} disabled={tutorialMode} className={radioInputCls} />
                Last token
                <span className="ml-0.5 text-[10px] text-muted">— next-token prediction (most common)</span>
              </label>
              <label className={cn(radioCls, "items-start")}>
                <input type="radio" name="attr-position" checked={positionMode === "custom"} onChange={() => setPositionMode("custom")} disabled={tutorialMode} className={cn(radioInputCls, "mt-0.5")} />
                <span>Token index</span>
                <input
                  type="number" min={0} placeholder="e.g. 3"
                  value={customPosition}
                  onFocus={() => setPositionMode("custom")}
                  onChange={e => { setPositionMode("custom"); setCustomPosition(e.target.value); }}
                  disabled={tutorialMode}
                  className={cn(smallInputCls, "ml-1.5 w-[72px] border px-1.5 py-[3px]", positionMode === "custom" ? "border-accent" : "border-card-border")}
                />
              </label>
            </div>
          </div>

          <div className="mb-3.5">
            <span className="mb-2 block text-[11px] font-medium text-foreground">Target token</span>
            <div className="flex flex-col gap-[7px]">
              <label className={radioCls}>
                <input type="radio" name="attr-token" checked={tokenMode === "auto"} onChange={() => setTokenMode("auto")} disabled={tutorialMode} className={radioInputCls} />
                Top prediction
                <span className="ml-0.5 text-[10px] text-muted">— attribute the model&apos;s most likely next token</span>
              </label>
              <label className={cn(radioCls, "items-start")}>
                <input type="radio" name="attr-token" checked={tokenMode === "custom"} onChange={() => setTokenMode("custom")} disabled={tutorialMode} className={cn(radioInputCls, "mt-0.5")} />
                <span className="shrink-0">Specify</span>
                <input
                  type="text" placeholder={`e.g. " Mary"`}
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
              placeholder={`e.g. " John" — enables logit difference`}
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
              When set, the gradient metric becomes logit(target) − logit(contrastive). Recommended for IOI-style tasks.
            </p>
          </div>
        </div>
    </ConfigPaneShell>
  );
}
