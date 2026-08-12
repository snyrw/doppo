"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/app/lib/auth-client";
import { TIER_PAIR_CAPS, DEFAULT_PAIR_CAP } from "../lib/tiers";
import { useTokenPreview } from "../hooks/useTokenPreview";
import { useModelSelection, type ModelInfo } from "../hooks/useModelSelection";
import ConfigLedger, { type LedgerSection } from "./configledger/ConfigLedger";
import { useConfigPaneLifecycle } from "./configledger/useConfigPaneLifecycle";
import { FieldLabel, PromptField, smallInputCls } from "./configledger/fields";
import { PANEL_LABEL, PANEL_META } from "./configledger/panel-type";
import { modelSummary, injectionSummary, generationSummary } from "./configledger/summaries";
import ModelPicker from "./ModelPicker";
import { cn } from "../lib/cn";
import { techniqueForCard } from "../lib/techniques";
import {
  saveSteeringPairSet,
  listSteeringPairSetSummaries,
  loadSteeringPairSet,
  deleteSteeringPairSet,
} from "../actions";

export type ExtraPair = { clean: string; corrupted: string };

type SavedSetSummary = { id: string; name: string; pairCount: number; createdAt: Date };
type SavedSetDetail = { cleanPrompt: string; corruptedPrompt: string; extraPairs: ExtraPair[] };

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
  onPairsSaved?: (summary: { id: string; name: string; pairCount: number; createdAt: Date }) => void;
};

const DEFAULT_CLEAN_PROMPT = "When Mary and John went to the store, John gave a drink to";
const DEFAULT_CORRUPTED_PROMPT = "When Mary and John went to the store, Mary gave a drink to";

export default function SteeringConfigPane({
  isOpen,
  availableModels,
  modelsLoading,
  onSubmit,
  onClose,
  onPairsSaved,
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

  // Full mode state
  const [mode, setMode] = useState<"quick" | "full" | "saved">("quick");
  const [conceptDescription, setConceptDescription] = useState("");
  const [extraPairs, setExtraPairs] = useState<ExtraPair[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [savedSets, setSavedSets] = useState<SavedSetSummary[]>([]);
  const [savedSetsLoading, setSavedSetsLoading] = useState(false);
  const [savedSetsError, setSavedSetsError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, SavedSetDetail>>({});
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const { activeSection, setActiveSection, doReset, handleClose } = useConfigPaneLifecycle(onClose, () => {
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
    setSaving(false);
    setSaveError(null);
    setJustSaved(false);
    setTemperature(1.0);
    setRepetitionPenalty(1.3);
    setGenerationPrompt("");
  });

  useEffect(() => {
    if (mode !== "saved") return;
    let cancelled = false;
    setSavedSetsLoading(true);
    setSavedSetsError(null);
    listSteeringPairSetSummaries()
      .then((rows) => { if (!cancelled) setSavedSets(rows); })
      .catch((err) => { if (!cancelled) setSavedSetsError(err instanceof Error ? err.message : "Failed to load saved sets."); })
      .finally(() => { if (!cancelled) setSavedSetsLoading(false); });
    return () => { cancelled = true; };
  }, [mode]);

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

  const handleSavePairs = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const name = conceptDescription.trim() || `Untitled set - ${new Date().toLocaleDateString()}`;
      const { id } = await saveSteeringPairSet(name, cleanPrompt, corruptedPrompt, extraPairs);
      setJustSaved(true);
      setSavedSets((prev) => [
        { id, name, pairCount: 1 + extraPairs.length, createdAt: new Date() },
        ...prev,
      ]);
      onPairsSaved?.({ id, name, pairCount: 1 + extraPairs.length, createdAt: new Date() });
      setTimeout(() => setJustSaved(false), 1500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const ensureDetail = async (id: string): Promise<SavedSetDetail> => {
    if (detailCache[id]) return detailCache[id];
    setDetailLoadingId(id);
    try {
      const detail = await loadSteeringPairSet(id);
      setDetailCache((prev) => ({ ...prev, [id]: detail }));
      return detail;
    } finally {
      setDetailLoadingId(null);
    }
  };

  const handleToggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    try {
      await ensureDetail(id);
    } catch {
      setExpandedId(null);
    }
  };

  const handleLoadSavedSet = async (id: string) => {
    try {
      const detail = await ensureDetail(id);
      setCleanPrompt(detail.cleanPrompt);
      setCorruptedPrompt(detail.corruptedPrompt);
      setExtraPairs(detail.extraPairs);
      setMode("full");
    } catch {
      // ensureDetail already surfaced via detailLoadingId clearing; leave the
      // Saved tab open so the user can retry.
    }
  };

  const handleDeleteSavedSet = async (id: string) => {
    await deleteSteeringPairSet(id);
    setSavedSets((prev) => prev.filter((s) => s.id !== id));
    setDetailCache((prev) => {
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
    if (expandedId === id) setExpandedId(null);
  };

  const cleanPreview = useTokenPreview(isOpen ? picker.activeModelId : "", cleanPrompt);
  const corruptedPreview = useTokenPreview(isOpen ? picker.activeModelId : "", corruptedPrompt);
  const positionOk = positionMode === "last" || (customPosition.trim() !== "" && !isNaN(parseInt(customPosition)));
  const canRun = picker.modelOk && positionOk && cleanPrompt.trim() !== "" && corruptedPrompt.trim() !== "";

  const pairCap = picker.selectedGpuTier ? (TIER_PAIR_CAPS[picker.selectedGpuTier] ?? DEFAULT_PAIR_CAP) : DEFAULT_PAIR_CAP;
  const totalPairs = 1 + extraPairs.length;
  const canGenerate = mode === "full" && conceptDescription.trim() !== "" && cleanPrompt.trim() !== "" && corruptedPrompt.trim() !== "" && !generating && !!session;

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
      extraPairs: mode === "full" && extraPairs.length > 0 ? extraPairs : undefined,
      temperature,
      repetitionPenalty,
    });
    doReset();
  };

  if (!isOpen) return null;

  const radioCls = "flex cursor-pointer items-center gap-1.5 text-xs text-foreground";
  const radioInputCls = "h-[13px] w-[13px] shrink-0 cursor-pointer accent-[var(--accent)]";
  const helpTextCls = cn(PANEL_META, "m-0 mt-[5px]");
  const sliderCls = "w-full cursor-pointer accent-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45";

  const displayName = picker.modelName || null;
  const pairSummary = mode === "full" && extraPairs.length > 0
    ? `${totalPairs} pairs`
    : "1 pair";
  const injectionSum = `${injectionSummary(injectionLayer)} · ${positionMode === "custom" && customPosition.trim() ? "pos " + customPosition.trim() : "last"}`;
  const genSum = generationSummary(temperature, repetitionPenalty);

  const sections: LedgerSection[] = [
    {
      id: "model",
      label: "Model",
      body: (
        <div className="flex flex-col gap-4">
          <ModelPicker
            picker={picker}
            models={availableModels}
            modelsLoading={modelsLoading}
          />
        </div>
      ),
    },
    {
      id: "pair",
      label: "Contrast pair",
      body: (
        <div className="flex flex-col gap-4">
          {/* Mode toggle */}
          <div>
            <label className={cn(PANEL_LABEL, "mb-2 block")}>
              Mode
            </label>
            <div className="flex overflow-hidden rounded-[var(--ctl-radius-xs)] border border-card-border">
              {(["quick", "full", "saved"] as const).map((m, i) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); if (m === "quick") { setExtraPairs([]); setGenerateError(null); } }}
                  className={cn(
                    "flex-1 cursor-pointer border-none py-1 text-[10px] transition-colors disabled:cursor-default",
                    i < 2 && "border-r border-card-border",
                    mode === m
                      ? "bg-surface-border font-semibold text-foreground"
                      : "bg-transparent font-normal text-muted",
                  )}
                >
                  {m === "quick" ? "Quick (1 pair)" : m === "full" ? `Full (up to ${pairCap} pairs)` : "Saved"}
                </button>
              ))}
            </div>
            <p className={helpTextCls}>
              {mode === "quick"
                ? "Single pair. Faster and noisier."
                : mode === "full"
                  ? "Averages the difference-in-means vector over LLM-generated pairs. Around 100 pairs gives a stable vector."
                  : "Reuse a set of pairs you generated and saved earlier."}
            </p>
          </div>

          {/* Seed pair (full) / prompt pair (quick) */}
          <div className={cn(mode === "full" && "border-l-2 border-dashed border-accent pl-3")}>
            {mode === "full" && (
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-[10px] font-semibold text-accent">
                  Seed pair
                </span>
                <span className={PANEL_META}>
                  pair 1 of {totalPairs > 1 ? totalPairs : pairCap}
                </span>
              </div>
            )}
            {mode === "full" && (
              <p className={cn(PANEL_META, "m-0 mb-2.5")}>
                A format reference for generation, and the first pair in the dataset.
              </p>
            )}

            <div className="mb-3">
              <PromptField
                label={mode === "full" ? "Seed · Clean" : "Reference Prompt"}
                value={cleanPrompt}
                onChange={setCleanPrompt}
                preview={cleanPreview}
                placeholder="Where the behavior you want to steer occurs"
              />
            </div>

            <PromptField
              label={mode === "full" ? "Seed · Corrupted" : "Counterfactual Prompt"}
              value={corruptedPrompt}
              onChange={setCorruptedPrompt}
              preview={corruptedPreview}
              placeholder="A variation that represents the direction to steer toward"
            />
          </div>

          {/* Full mode: LLM pair generation */}
          {mode === "full" && (
            <div className="border-t border-surface-border pt-4">
              <label className={cn(PANEL_LABEL, "mb-2 block")}>
                Generate dataset pairs with Claude Haiku
              </label>
              {!session && (
                <p className="m-0 mb-2 text-[10px] leading-normal text-amber-600">
                  Sign in to generate pairs.
                </p>
              )}
              <textarea
                value={conceptDescription}
                onChange={e => setConceptDescription(e.target.value)}
                rows={2}
                placeholder={`Describe the steering concept, e.g. "the model mentions Paris" or "confident vs. hesitant tone"`}
                disabled={!session}
                className={cn(
                  "box-border w-full resize-y rounded-[var(--ctl-radius-xs)] border px-2.5 py-2 font-[inherit] text-[11px] leading-normal text-foreground outline-none",
                  conceptDescription.trim() && session ? "border-accent" : "border-card-border",
                  !session ? "bg-surface-border" : "bg-background",
                  session ? "opacity-100" : "opacity-60",
                )}
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className={PANEL_META}>
                  {extraPairs.length > 0
                    ? `${totalPairs} pairs total (seed + ${extraPairs.length} generated)`
                    : `Will generate ${pairCap - 1} pairs (${pairCap} total with seed)`}
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={handleGenerate}
                    disabled={!canGenerate}
                    className={cn(
                      "whitespace-nowrap rounded-[var(--ctl-radius-xs)] border-none px-2.5 py-[5px] text-[10px] font-medium transition-colors",
                      canGenerate
                        ? "cursor-pointer bg-accent text-accent-fg"
                        : "cursor-not-allowed bg-surface-border text-muted",
                    )}
                  >
                    {generating ? "Generating…"
                      : extraPairs.length > 0 ? "Regenerate" : "Generate pairs"}
                  </button>
                  <button
                    onClick={handleSavePairs}
                    disabled={extraPairs.length === 0 || saving}
                    className={cn(
                      "whitespace-nowrap rounded-[var(--ctl-radius-xs)] border-none px-2.5 py-[5px] text-[10px] font-medium transition-colors",
                      extraPairs.length > 0 && !saving
                        ? "cursor-pointer bg-accent text-accent-fg"
                        : "cursor-not-allowed bg-surface-border text-muted",
                    )}
                  >
                    {saving ? "Saving…" : justSaved ? "Saved ✓" : "Save Pairs"}
                  </button>
                </div>
              </div>
              {generateError && (
                <p className="m-0 mt-1.5 text-[10px] leading-normal text-red-600">
                  ✗ {generateError}
                </p>
              )}
              {saveError && (
                <p className="m-0 mt-1.5 text-[10px] leading-normal text-red-600">
                  ✗ {saveError}
                </p>
              )}

              {/* Generated pair list */}
              {extraPairs.length > 0 && (
                <div className="mt-2.5">
                  <div className="mb-[5px] flex items-center justify-between">
                    <span className={PANEL_META}>
                      Generated pairs ({extraPairs.length})
                    </span>
                    <button
                      onClick={() => setExtraPairs([])}
                      className={cn(PANEL_META, "cursor-pointer border-none bg-transparent px-0.5")}
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="flex max-h-[180px] flex-col gap-[3px] overflow-y-auto">
                    {extraPairs.map((pair, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-1.5 rounded-[var(--ctl-radius-xs)] border border-surface-border bg-background px-[7px] py-[5px]"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-1 overflow-hidden text-[9px] leading-[1.4] text-foreground">
                            {pair.clean}
                          </div>
                          <div className="mt-px line-clamp-1 overflow-hidden text-[9px] leading-[1.4] text-muted">
                            {pair.corrupted}
                          </div>
                        </div>
                        <button
                          onClick={() => removePair(i)}
                          className="mt-px shrink-0 cursor-pointer border-none bg-transparent px-px text-[11px] leading-none text-muted"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === "saved" && (
            <div className="border-t border-surface-border pt-4">
              {savedSetsLoading && (
                <p className={cn(PANEL_META, "m-0")}>Loading saved sets…</p>
              )}
              {!savedSetsLoading && savedSetsError && (
                <p className="m-0 text-[10px] leading-normal text-red-600">✗ {savedSetsError}</p>
              )}
              {!savedSetsLoading && !savedSetsError && savedSets.length === 0 && (
                <p className={cn(PANEL_META, "m-0")}>
                  No saved sets yet. Generate pairs in Full mode, then Save Pairs.
                </p>
              )}
              {!savedSetsLoading && savedSets.length > 0 && (
                <div className="flex max-h-[260px] flex-col gap-[3px] overflow-y-auto">
                  {savedSets.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-[var(--ctl-radius-xs)] border border-surface-border bg-background px-[7px] py-[5px]"
                    >
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleToggleExpand(s.id)}
                          className="min-w-0 flex-1 cursor-pointer border-none bg-transparent p-0 text-left"
                        >
                          <div className="line-clamp-1 overflow-hidden text-[10px] leading-[1.4] text-foreground">
                            {s.name}
                          </div>
                          <div className={cn(PANEL_META, "mt-px")}>
                            {s.pairCount} pairs · {new Date(s.createdAt).toLocaleDateString()}
                          </div>
                        </button>
                        <button
                          onClick={() => handleLoadSavedSet(s.id)}
                          disabled={detailLoadingId === s.id}
                          className="shrink-0 cursor-pointer whitespace-nowrap rounded-[var(--ctl-radius-xs)] border-none bg-accent px-2 py-[3px] text-[9px] font-medium text-accent-fg disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Load
                        </button>
                        <button
                          onClick={() => handleDeleteSavedSet(s.id)}
                          className="shrink-0 cursor-pointer border-none bg-transparent px-px text-[11px] leading-none text-muted"
                        >
                          ×
                        </button>
                      </div>
                      {expandedId === s.id && (
                        <div className="mt-2 flex flex-col gap-[3px] border-t border-surface-border pt-2">
                          {detailLoadingId === s.id && (
                            <p className={cn(PANEL_META, "m-0")}>Loading pairs…</p>
                          )}
                          {detailCache[s.id]?.extraPairs.map((pair, i) => (
                            <div
                              key={i}
                              className="rounded-[var(--ctl-radius-xs)] border border-surface-border bg-background px-[7px] py-[5px]"
                            >
                              <div className="line-clamp-1 overflow-hidden text-[9px] leading-[1.4] text-foreground">
                                {pair.clean}
                              </div>
                              <div className="mt-px line-clamp-1 overflow-hidden text-[9px] leading-[1.4] text-muted">
                                {pair.corrupted}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
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
      body: (
        <div className="flex flex-col gap-4">
          <div>
            <span className={cn(PANEL_LABEL, "mb-2 block")}>Position (DIM vector source)</span>
            <div className="flex flex-col gap-[7px]">
              <label className={radioCls}>
                <input type="radio" name="steer-position" checked={positionMode === "last"} onChange={() => setPositionMode("last")} className={radioInputCls} />
                Last token
              </label>
              <label className={cn(radioCls, "items-start")}>
                <input type="radio" name="steer-position" checked={positionMode === "custom"} onChange={() => setPositionMode("custom")} className={cn(radioInputCls, "mt-0.5")} />
                <span>Token index</span>
                <input
                  type="number" min={0} placeholder="e.g. 3"
                  value={customPosition}
                  onFocus={() => setPositionMode("custom")}
                  onChange={e => { setPositionMode("custom"); setCustomPosition(e.target.value); }}
                  className={cn(smallInputCls, "ml-1.5 w-[72px] border px-1.5 py-[3px]", positionMode === "custom" ? "border-accent" : "border-card-border")}
                />
              </label>
            </div>
          </div>

          <div>
            <span className={cn(PANEL_LABEL, "mb-1 block")}>
              Injection layer
              <span className={cn(PANEL_META, "ml-1.5")}>optional, defaults to middle layer</span>
            </span>
            <input
              type="number" min={0}
              placeholder="e.g. 12"
              value={injectionLayer}
              onChange={e => setInjectionLayer(e.target.value)}
              className={cn(smallInputCls, "w-[100px] border px-2 py-1", injectionLayer.trim() ? "border-accent" : "border-card-border")}
            />
            <p className={helpTextCls}>
              Defaults to the middle layer. Try different ones to gauge steering effect.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "generation",
      label: "Generation",
      body: (
        <div className="flex flex-col gap-4">
          <div>
            <FieldLabel meta={generationPrompt.trim() ? generationPrompt.trim().split(/\s+/).length + "w" : "optional"}>
              Generation Prompt
            </FieldLabel>
            <textarea
              value={generationPrompt}
              onChange={e => setGenerationPrompt(e.target.value)}
              rows={2}
              placeholder={`Leave empty to use the clean prompt.`}
              className={cn(
                "box-border w-full resize-y rounded-[var(--ctl-radius-xs)] border bg-background px-2.5 py-2 font-[inherit] text-xs leading-normal text-foreground outline-none disabled:cursor-default disabled:opacity-70",
                generationPrompt.trim() ? "border-accent" : "border-card-border",
              )}
            />
            <p className={helpTextCls}>
              The vector is extracted from the pair above; this prompt is only used for generation.
            </p>
          </div>

          <div>
            <div className="mb-[5px] flex items-center justify-between">
              <span className={PANEL_LABEL}>Temperature</span>
              <span className={cn(PANEL_META, "min-w-[28px] text-right")}>
                {temperature.toFixed(1)}
              </span>
            </div>
            <input
              type="range" min={0.1} max={2.0} step={0.1}
              value={temperature}
              onChange={e => setTemperature(parseFloat(e.target.value))}
              className={sliderCls}
            />
            <p className={cn(PANEL_META, "m-0 mt-1")}>
              Lower is more deterministic, higher is more variable. 1.0 represents a balanced output.
            </p>
          </div>

          <div>
            <div className="mb-[5px] flex items-center justify-between">
              <span className={PANEL_LABEL}>Repetition penalty</span>
              <span className={cn(PANEL_META, "min-w-[28px] text-right")}>
                {repetitionPenalty.toFixed(2)}
              </span>
            </div>
            <input
              type="range" min={1.0} max={2.0} step={0.05}
              value={repetitionPenalty}
              onChange={e => setRepetitionPenalty(parseFloat(e.target.value))}
              className={sliderCls}
            />
            <p className={cn(PANEL_META, "m-0 mt-1")}>
              Divides logits for already-generated tokens. 1.0 is no penalty; 1.3 is the default.
            </p>
          </div>
        </div>
      ),
    },
  ];

  const runLabel = mode === "full" && extraPairs.length > 0 ? `Run (${totalPairs})` : "Run";

  return (
    <ConfigLedger
      title="Steering"
      accent={techniqueForCard("steering").band}
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
