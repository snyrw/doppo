"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/app/lib/auth-client";
import { TIER_PAIR_CAPS, DEFAULT_PAIR_CAP } from "../lib/tiers";
import { useTokenPreview } from "../hooks/useTokenPreview";
import { useModelSelection, type ModelInfo } from "../hooks/useModelSelection";
import ConfigLedger, { type LedgerSection } from "./configledger/ConfigLedger";
import { FieldLabel, PromptField } from "./configledger/fields";
import { modelSummary, injectionSummary, generationSummary } from "./configledger/summaries";
import ModelPicker from "./ModelPicker";
import { cn } from "../lib/cn";

export type ExtraPair = { clean: string; corrupted: string };

type SteeringConfigPaneProps = {
  isOpen: boolean;
  availableModels: ModelInfo[];
  modelsLoading: boolean;
  onSubmit: (config: {
    modelName: string;
    cleanPrompt: string;
    corruptedPrompt: string;
    generationPrompt: string;
    gpuTier?: string;
    targetPosition: number | "last";
    injectionLayer: number;
    extraPairs?: ExtraPair[];
    temperature: number;
    repetitionPenalty: number;
  }) => void;
  onClose: () => void;
  tutorialMode?: boolean;
  tutorialConfig?: {
    modelName: string;
    cleanPrompt: string;
    corruptedPrompt: string;
    generationPrompt?: string;
    nPairs?: number;
    gpuTier: string;
    layer: number;
    extraPairs?: Array<{ clean: string; corrupted: string }>;
  };
};

const DEFAULT_CLEAN_PROMPT = "When Mary and John went to the store, John gave a drink to";
const DEFAULT_CORRUPTED_PROMPT = "When Mary and John went to the store, Mary gave a drink to";

export default function SteeringConfigPane({
  isOpen,
  availableModels,
  modelsLoading,
  onSubmit,
  onClose,
  tutorialMode,
  tutorialConfig,
}: SteeringConfigPaneProps) {
  const { data: session } = useSession();
  const picker = useModelSelection(availableModels);
  const [cleanPrompt, setCleanPrompt] = useState(DEFAULT_CLEAN_PROMPT);
  const [corruptedPrompt, setCorruptedPrompt] = useState(DEFAULT_CORRUPTED_PROMPT);
  const [positionMode, setPositionMode] = useState<"last" | "custom">("last");
  const [customPosition, setCustomPosition] = useState("");
  const [injectionLayer, setInjectionLayer] = useState("");

  const [temperature, setTemperature] = useState(1.0);
  const [repetitionPenalty, setRepetitionPenalty] = useState(1.3);
  const [generationPrompt, setGenerationPrompt] = useState("");

  // Research mode state
  const [mode, setMode] = useState<"quick" | "research">("quick");
  const [conceptDescription, setConceptDescription] = useState("");
  const [extraPairs, setExtraPairs] = useState<ExtraPair[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("model");

  useEffect(() => {
    if (tutorialMode && tutorialConfig) {
      setCleanPrompt(tutorialConfig.cleanPrompt);
      setCorruptedPrompt(tutorialConfig.corruptedPrompt);
      picker.forceCustomModel(tutorialConfig.modelName, tutorialConfig.gpuTier);
      setInjectionLayer(String(tutorialConfig.layer));
      setMode("research");
      if (tutorialConfig.generationPrompt) setGenerationPrompt(tutorialConfig.generationPrompt);
      if (tutorialConfig.extraPairs) setExtraPairs(tutorialConfig.extraPairs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorialMode, tutorialConfig]);

  const doReset = () => {
    picker.reset();
    setCleanPrompt(DEFAULT_CLEAN_PROMPT);
    setCorruptedPrompt(DEFAULT_CORRUPTED_PROMPT);
    setPositionMode("last");
    setCustomPosition("");
    setInjectionLayer("");
    setMode("quick");
    setConceptDescription("");
    setExtraPairs([]);
    setGenerating(false);
    setGenerateError(null);
    setTemperature(1.0);
    setRepetitionPenalty(1.3);
    setGenerationPrompt("");
    setActiveSection("model");
  };

  const handleClose = () => {
    doReset();
    onClose();
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/generate-pairs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept: conceptDescription,
          primaryClean: cleanPrompt,
          primaryCorrupted: corruptedPrompt,
          gpuTier: picker.gpuTier,
        }),
      });
      const json = await res.json() as { pairs?: ExtraPair[]; error?: string };
      if (!res.ok) {
        setGenerateError(json.error ?? "Generation failed.");
      } else {
        setExtraPairs(json.pairs ?? []);
        setGenerateError(null);
      }
    } catch {
      setGenerateError("Network error during generation.");
    } finally {
      setGenerating(false);
    }
  };

  const removePair = (index: number) => {
    setExtraPairs(prev => prev.filter((_, i) => i !== index));
  };

  const cleanPreview = useTokenPreview(isOpen ? picker.activeModelId : "", cleanPrompt);
  const corruptedPreview = useTokenPreview(isOpen ? picker.activeModelId : "", corruptedPrompt);
  const positionOk = positionMode === "last" || (customPosition.trim() !== "" && !isNaN(parseInt(customPosition)));
  const canRun = picker.modelOk && positionOk && cleanPrompt.trim() !== "" && corruptedPrompt.trim() !== "";

  const pairCap = picker.selectedGpuTier ? (TIER_PAIR_CAPS[picker.selectedGpuTier] ?? DEFAULT_PAIR_CAP) : DEFAULT_PAIR_CAP;
  const totalPairs = 1 + extraPairs.length;
  const canGenerate = mode === "research" && conceptDescription.trim() !== "" && cleanPrompt.trim() !== "" && corruptedPrompt.trim() !== "" && !generating && !!session;

  const handleRun = () => {
    if (!canRun) return;
    const { modelName, gpuTier } = picker;
    const targetPosition: number | "last" = positionMode === "last" ? "last" : parseInt(customPosition);
    const layer = injectionLayer.trim() !== "" && !isNaN(parseInt(injectionLayer)) ? parseInt(injectionLayer) : -1;
    onSubmit({
      modelName,
      cleanPrompt,
      corruptedPrompt,
      generationPrompt,
      gpuTier,
      targetPosition,
      injectionLayer: layer,
      extraPairs: mode === "research" && extraPairs.length > 0 ? extraPairs : undefined,
      temperature,
      repetitionPenalty,
    });
    doReset();
  };

  if (!isOpen) return null;

  const radioCls = "flex cursor-pointer items-center gap-1.5 text-xs text-foreground";
  const radioInputCls = "h-[13px] w-[13px] shrink-0 cursor-pointer accent-[var(--accent)]";
  const smallInputCls = "rounded-[5px] bg-background text-[11px] text-foreground outline-none transition-colors";
  const helpTextCls = "m-0 mt-[5px] text-[10px] leading-normal text-muted";
  const sliderCls = "w-full cursor-pointer accent-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45";

  const displayName = picker.modelName || null;
  const pairSummary = mode === "research" && extraPairs.length > 0
    ? `${totalPairs} pairs`
    : "1 pair";
  const injectionSum = `${injectionSummary(injectionLayer)} · ${positionMode === "custom" && customPosition.trim() ? "pos " + customPosition.trim() : "last"}`;
  const genSum = generationSummary(temperature, repetitionPenalty);

  const sections: LedgerSection[] = [
    {
      id: "model",
      label: "Model",
      summary: modelSummary(displayName),
      body: (
        <div className="flex flex-col gap-4">
          <ModelPicker
            picker={picker}
            models={availableModels}
            modelsLoading={modelsLoading}
            gridMaxHeight={200}
            tutorialMode={tutorialMode}
            tutorialVariant="input"
          />
        </div>
      ),
    },
    {
      id: "pair",
      label: "Contrast pair",
      summary: pairSummary,
      body: (
        <div className="flex flex-col gap-4">
          {/* Mode toggle */}
          <div>
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Mode
            </label>
            <div className="flex overflow-hidden rounded-md border border-card-border">
              {(["quick", "research"] as const).map((m, i) => (
                <button
                  key={m}
                  onClick={() => { if (tutorialMode) return; setMode(m); if (m === "quick") { setExtraPairs([]); setGenerateError(null); } }}
                  disabled={tutorialMode}
                  className={cn(
                    "flex-1 cursor-pointer border-none py-1.5 text-[11px] transition-colors disabled:cursor-default",
                    i === 0 && "border-r border-card-border",
                    mode === m
                      ? "bg-surface-border font-semibold text-foreground"
                      : cn("bg-transparent font-normal text-muted", tutorialMode && "opacity-45"),
                  )}
                >
                  {m === "quick" ? "Quick  (1 pair)" : `Research  (up to ${pairCap} pairs)`}
                </button>
              ))}
            </div>
            <p className={helpTextCls}>
              {mode === "quick"
                ? "Single pair. Faster and noisier."
                : "Averages the difference-in-means vector over LLM-generated pairs. Around 100 pairs gives a stable vector."}
            </p>
          </div>

          {/* Seed pair (research) / prompt pair (quick) */}
          <div className={cn(mode === "research" && "border-l-2 border-dashed border-accent pl-3")}>
            {mode === "research" && (
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
                  Seed Pair
                </span>
                <span className="text-[9px] leading-[1.4] text-muted">
                  pair 1 of {totalPairs > 1 ? totalPairs : pairCap}
                </span>
              </div>
            )}
            {mode === "research" && (
              <p className="m-0 mb-2.5 text-[10px] leading-normal text-muted">
                A format reference for generation, and the first pair in the dataset.
              </p>
            )}

            <div className="mb-3">
              <PromptField
                label={mode === "research" ? "Seed · Clean" : "Reference Prompt"}
                value={cleanPrompt}
                onChange={setCleanPrompt}
                preview={cleanPreview}
                placeholder="Where the behavior you want to steer occurs"
                disabled={tutorialMode}
              />
            </div>

            <PromptField
              label={mode === "research" ? "Seed · Corrupted" : "Counterfactual Prompt"}
              value={corruptedPrompt}
              onChange={setCorruptedPrompt}
              preview={corruptedPreview}
              placeholder="A variation that represents the direction to steer toward"
              disabled={tutorialMode}
            />
          </div>

          {/* Research mode: LLM pair generation */}
          {mode === "research" && (
            <div className="border-t border-surface-border pt-4">
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                Generate Dataset Pairs with Claude
              </label>
              {!tutorialMode && !session && (
                <p className="m-0 mb-2 text-[10px] leading-normal text-amber-600">
                  Sign in to generate pairs.
                </p>
              )}
              <textarea
                value={tutorialMode ? "English → French (LLM-style questions)" : conceptDescription}
                onChange={e => setConceptDescription(e.target.value)}
                rows={2}
                placeholder={`Describe the steering concept, e.g. "the model mentions Paris" or "confident vs. hesitant tone"`}
                disabled={tutorialMode || !session}
                className={cn(
                  "box-border w-full resize-y rounded-md border px-2.5 py-2 font-[inherit] text-[11px] leading-normal text-foreground outline-none",
                  !tutorialMode && conceptDescription.trim() && session ? "border-accent" : "border-card-border",
                  tutorialMode || !session ? "bg-surface-border" : "bg-background",
                  tutorialMode ? "cursor-default opacity-70" : session ? "opacity-100" : "opacity-60",
                )}
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted">
                  {tutorialMode
                    ? `${tutorialConfig?.nPairs ?? 40} pairs total`
                    : extraPairs.length > 0
                      ? `${totalPairs} pairs total (seed + ${extraPairs.length} generated)`
                      : `Will generate ${pairCap - 1} pairs (${pairCap} total with seed)`}
                </span>
                <button
                  onClick={handleGenerate}
                  disabled={tutorialMode || !canGenerate}
                  className={cn(
                    "shrink-0 whitespace-nowrap rounded-md border-none px-3 py-[5px] text-[11px] font-medium transition-colors",
                    !tutorialMode && canGenerate
                      ? "cursor-pointer bg-accent text-accent-fg"
                      : "cursor-not-allowed bg-surface-border text-muted",
                    tutorialMode && "opacity-70",
                  )}
                >
                  {tutorialMode
                    ? `${tutorialConfig?.nPairs ?? 40} pairs generated`
                    : generating ? "Generating…"
                    : extraPairs.length > 0 ? "Regenerate" : "Generate pairs"}
                </button>
              </div>
              {!tutorialMode && generateError && (
                <p className="m-0 mt-1.5 text-[10px] leading-normal text-red-600">
                  ✗ {generateError}
                </p>
              )}

              {/* Generated pair list */}
              {extraPairs.length > 0 && (
                <div className="mt-2.5">
                  <div className="mb-[5px] flex items-center justify-between">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.06em] text-muted">
                      Generated pairs ({extraPairs.length})
                    </span>
                    {!tutorialMode && (
                      <button
                        onClick={() => setExtraPairs([])}
                        className="cursor-pointer border-none bg-transparent px-0.5 text-[9px] text-muted"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  <div className="flex max-h-[180px] flex-col gap-[3px] overflow-y-auto">
                    {extraPairs.map((pair, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-1.5 rounded-[5px] border border-surface-border bg-background px-[7px] py-[5px]"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-1 overflow-hidden text-[9px] leading-[1.4] text-foreground">
                            {pair.clean}
                          </div>
                          <div className="mt-px line-clamp-1 overflow-hidden text-[9px] leading-[1.4] text-muted">
                            {pair.corrupted}
                          </div>
                        </div>
                        {!tutorialMode && (
                          <button
                            onClick={() => removePair(i)}
                            className="mt-px shrink-0 cursor-pointer border-none bg-transparent px-px text-[11px] leading-none text-muted"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "injection",
      label: "Injection",
      summary: injectionSum,
      body: (
        <div className="flex flex-col gap-4">
          <div>
            <span className="mb-2 block text-[11px] font-medium text-foreground">Position (DIM vector source)</span>
            <div className="flex flex-col gap-[7px]">
              <label className={radioCls}>
                <input type="radio" name="steer-position" checked={positionMode === "last"} onChange={() => setPositionMode("last")} disabled={tutorialMode} className={radioInputCls} />
                Last token
              </label>
              <label className={cn(radioCls, "items-start")}>
                <input type="radio" name="steer-position" checked={positionMode === "custom"} onChange={() => setPositionMode("custom")} disabled={tutorialMode} className={cn(radioInputCls, "mt-0.5")} />
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

          <div>
            <span className="mb-1 block text-[11px] font-medium text-foreground">
              Injection layer
              <span className="ml-1.5 text-[10px] font-normal text-muted">optional, defaults to middle layer</span>
            </span>
            <input
              type="number" min={0}
              placeholder="e.g. 12"
              value={injectionLayer}
              onChange={e => setInjectionLayer(e.target.value)}
              disabled={tutorialMode}
              className={cn(smallInputCls, "w-[100px] border px-2 py-1", injectionLayer.trim() ? "border-accent" : "border-card-border")}
            />
            <p className={helpTextCls}>
              Defaults to the middle layer, a reasonable starting point. Use Attribution to find the most causally relevant layer.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "generation",
      label: "Generation",
      summary: genSum,
      body: (
        <div className="flex flex-col gap-4">
          <div>
            <FieldLabel meta={generationPrompt.trim() ? generationPrompt.trim().split(/\s+/).length + "w" : "optional"}>
              Generation Prompt
            </FieldLabel>
            <textarea
              value={generationPrompt}
              onChange={e => setGenerationPrompt(e.target.value)}
              disabled={tutorialMode}
              rows={2}
              placeholder={`Leave empty to use the clean prompt.`}
              className={cn(
                "box-border w-full resize-y rounded-md border bg-background px-2.5 py-2 font-[inherit] text-xs leading-normal text-foreground outline-none disabled:cursor-default disabled:opacity-70",
                generationPrompt.trim() ? "border-accent" : "border-card-border",
              )}
            />
            <p className={helpTextCls}>
              The vector is extracted from the pair above; this prompt is only used for generation.
            </p>
          </div>

          <div>
            <div className="mb-[5px] flex items-center justify-between">
              <span className="text-[11px] font-medium text-foreground">Temperature</span>
              <span className="min-w-[28px] text-right text-[10px] text-muted">
                {temperature.toFixed(1)}
              </span>
            </div>
            <input
              type="range" min={0.1} max={2.0} step={0.1}
              value={temperature}
              onChange={e => setTemperature(parseFloat(e.target.value))}
              disabled={tutorialMode}
              className={sliderCls}
            />
            <p className="m-0 mt-1 text-[10px] leading-normal text-muted">
              Lower is more deterministic. 1.0 is standard sampling.
            </p>
          </div>

          <div>
            <div className="mb-[5px] flex items-center justify-between">
              <span className="text-[11px] font-medium text-foreground">Repetition penalty</span>
              <span className="min-w-[28px] text-right text-[10px] text-muted">
                {repetitionPenalty.toFixed(2)}
              </span>
            </div>
            <input
              type="range" min={1.0} max={2.0} step={0.05}
              value={repetitionPenalty}
              onChange={e => setRepetitionPenalty(parseFloat(e.target.value))}
              disabled={tutorialMode}
              className={sliderCls}
            />
            <p className="m-0 mt-1 text-[10px] leading-normal text-muted">
              Divides logits for already-generated tokens. 1.0 is no penalty; 1.3 is the default.
            </p>
          </div>
        </div>
      ),
    },
  ];

  const runLabel = mode === "research" && extraPairs.length > 0 ? `Run steering (${totalPairs})` : "Run steering";

  return (
    <ConfigLedger
      title="Steering — new card"
      sections={sections}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      footerSummary={`${modelSummary(displayName)} · ${pairSummary} · ${injectionSum} · ${genSum}`}
      canRun={canRun}
      runLabel={runLabel}
      onRun={handleRun}
      onClose={handleClose}
    />
  );
}
