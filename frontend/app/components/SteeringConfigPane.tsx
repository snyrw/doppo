"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/app/lib/auth-client";
import { TIER_LABELS } from "../lib/tiers";
import { useTokenPreview } from "../hooks/useTokenPreview";
import TokenPreview from "./TokenPreview";

type ModelInfo = {
  id: string;
  display_name: string;
  description: string;
  requires_hf_token: boolean;
  gpu_tier: string;
};

type CustomValidation = {
  valid: boolean;
  gpu_tier: string | null;
  reason: string;
};

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
};

// Tier-scaled caps must match /api/generate-pairs/route.ts TIER_CAPS.
const TIER_PAIR_CAPS: Record<string, number> = {
  tl_small: 40,
  tl_medium: 25,
  tl_large: 15,
  tl_xlarge: 10,
};
const DEFAULT_PAIR_CAP = 20;

const DEFAULT_CLEAN_PROMPT = "When Mary and John went to the store, John gave a drink to";
const DEFAULT_CORRUPTED_PROMPT = "When Mary and John went to the store, Mary gave a drink to";

export default function SteeringConfigPane({
  isOpen,
  availableModels,
  modelsLoading,
  onSubmit,
  onClose,
}: SteeringConfigPaneProps) {
  const { data: session } = useSession();
  const [selectedModel, setSelectedModel] = useState("");
  const [cleanPrompt, setCleanPrompt] = useState(DEFAULT_CLEAN_PROMPT);
  const [corruptedPrompt, setCorruptedPrompt] = useState(DEFAULT_CORRUPTED_PROMPT);
  const [customRepoId, setCustomRepoId] = useState("");
  const [customValidation, setCustomValidation] = useState<CustomValidation | null>(null);
  const [customValidating, setCustomValidating] = useState(false);
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

  useEffect(() => {
    if (selectedModel === "" && availableModels.length > 0 && customRepoId === "") {
      setSelectedModel(availableModels[0].id);
    }
  }, [availableModels, selectedModel, customRepoId]);

  const doReset = () => {
    setSelectedModel(availableModels[0]?.id ?? "");
    setCleanPrompt(DEFAULT_CLEAN_PROMPT);
    setCorruptedPrompt(DEFAULT_CORRUPTED_PROMPT);
    setCustomRepoId("");
    setCustomValidation(null);
    setCustomValidating(false);
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
  };

  const handleClose = () => {
    doReset();
    onClose();
  };

  const selectFeaturedModel = (id: string) => {
    setSelectedModel(id);
    setCustomRepoId("");
    setCustomValidation(null);
  };

  const handleCustomRepoChange = (value: string) => {
    setCustomRepoId(value);
    setSelectedModel("");
    setCustomValidation(null);
  };

  const validateCustomRepo = async () => {
    setCustomValidating(true);
    setCustomValidation(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/validate-model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_id: customRepoId.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCustomValidation({ valid: false, gpu_tier: null, reason: json.detail ?? "Validation failed." });
      } else {
        setCustomValidation(json);
      }
    } catch {
      setCustomValidation({ valid: false, gpu_tier: null, reason: "Network error during validation." });
    } finally {
      setCustomValidating(false);
    }
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
          gpuTier: selectedGpuTier ?? undefined,
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

  const usingCustom = customRepoId.trim() !== "";
  const activeModelId = usingCustom
    ? (customValidation?.valid ? customRepoId.trim() : "")
    : selectedModel;
  const cleanPreview = useTokenPreview(activeModelId, cleanPrompt);
  const corruptedPreview = useTokenPreview(activeModelId, corruptedPrompt);
  const modelOk = usingCustom ? customValidation?.valid === true : selectedModel !== "";
  const positionOk = positionMode === "last" || (customPosition.trim() !== "" && !isNaN(parseInt(customPosition)));
  const canRun = modelOk && positionOk && cleanPrompt.trim() !== "" && corruptedPrompt.trim() !== "";

  const selectedGpuTier = usingCustom
    ? (customValidation?.gpu_tier ?? null)
    : (availableModels.find(m => m.id === selectedModel)?.gpu_tier ?? null);
  const isLockedByAuth = !session && selectedGpuTier !== null && selectedGpuTier !== "tl_small";

  const pairCap = selectedGpuTier ? (TIER_PAIR_CAPS[selectedGpuTier] ?? DEFAULT_PAIR_CAP) : DEFAULT_PAIR_CAP;
  const totalPairs = 1 + extraPairs.length;
  const canGenerate = mode === "research" && conceptDescription.trim() !== "" && cleanPrompt.trim() !== "" && corruptedPrompt.trim() !== "" && !generating && !!session;

  const handleRun = () => {
    if (!canRun) return;
    const modelName = usingCustom ? customRepoId.trim() : selectedModel;
    const gpuTier = usingCustom
      ? (customValidation?.gpu_tier ?? undefined)
      : (availableModels.find(m => m.id === selectedModel)?.gpu_tier ?? undefined);
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

  const radioStyle = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
    fontSize: 12,
    color: "var(--color-text)",
  } as const;

  const radioInputStyle = {
    accentColor: "var(--color-accent)",
    cursor: "pointer",
    width: 13,
    height: 13,
    flexShrink: 0,
  } as const;

  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        left: 0,
        width: 400,
        maxWidth: "min(400px, calc(100vw - 24px))",
        maxHeight: "calc(100vh - 100px)",
        zIndex: 30,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--color-card)",
        border: "1px solid var(--color-card-border)",
        borderRadius: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
        animation: "cfgDropIn 140ms ease-out",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px 12px",
          borderBottom: "1px solid var(--color-surface-border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)", letterSpacing: "0.01em" }}>
            New Steering
          </span>
        </div>
        <button
          onClick={handleClose}
          style={{
            width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 4, border: "none", background: "transparent",
            color: "var(--color-text-muted)", cursor: "pointer", fontSize: 16, lineHeight: 1,
            transition: "background 120ms, color 120ms",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)"; }}
        >
          ×
        </button>
      </div>

      {/* Form body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>

        {/* Featured models */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: 8 }}>
            Featured Models
          </label>
          {modelsLoading ? (
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", padding: "12px 0" }}>Loading models…</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, maxHeight: 200, overflowY: "auto", paddingRight: 2 }}>
              {availableModels.map(m => {
                const isSelected = selectedModel === m.id && !usingCustom;
                return (
                  <button
                    key={m.id}
                    onClick={() => selectFeaturedModel(m.id)}
                    title={m.description}
                    style={{
                      border: `1.5px solid ${isSelected ? "var(--color-accent)" : "var(--color-card-border)"}`,
                      borderRadius: 7, padding: "8px 9px",
                      background: isSelected ? "var(--color-surface-border)" : "var(--color-card)",
                      cursor: "pointer", textAlign: "left",
                      transition: "border-color 120ms, background 120ms",
                      display: "flex", flexDirection: "column", gap: 3,
                    }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-accent)"; }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-card-border)"; }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 600, color: isSelected ? "var(--color-accent)" : "var(--color-text)", lineHeight: 1.3 }}>
                      {m.display_name}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--color-text-muted)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {m.description}
                    </span>
                    {m.requires_hf_token && (
                      <span style={{ fontSize: 9, color: "var(--color-text-muted)", marginTop: 1, letterSpacing: "0.02em" }}>HF token required</span>
                    )}
                    {!session && m.gpu_tier !== "tl_small" && (
                      <span style={{ fontSize: 9, color: "#d97706", marginTop: 1, letterSpacing: "0.02em" }}>Sign in to run</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: "var(--color-surface-border)" }} />
          <span style={{ fontSize: 10, color: "var(--color-text-muted)", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>or</span>
          <div style={{ flex: 1, height: 1, background: "var(--color-surface-border)" }} />
        </div>

        {/* Any HuggingFace model */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: 8 }}>
            Any HuggingFace Model
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="text"
              placeholder="username/model-name"
              value={customRepoId}
              onChange={e => handleCustomRepoChange(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && customRepoId.trim()) validateCustomRepo(); }}
              style={{
                flex: 1, border: `1px solid ${usingCustom ? "var(--color-accent)" : "var(--color-card-border)"}`,
                borderRadius: 6, padding: "6px 8px", fontSize: 11,
                fontFamily: "var(--font-azeret-mono), monospace",
                color: "var(--color-text)", background: "var(--color-bg)", outline: "none",
                transition: "border-color 120ms",
              }}
            />
            <button
              onClick={validateCustomRepo}
              disabled={!customRepoId.trim() || customValidating}
              style={{
                border: "1px solid var(--color-card-border)", borderRadius: 6, padding: "6px 10px",
                fontSize: 11, background: "var(--color-surface-border)", color: "var(--color-text-muted)",
                cursor: (!customRepoId.trim() || customValidating) ? "not-allowed" : "pointer",
                opacity: (!customRepoId.trim() || customValidating) ? 0.5 : 1,
                whiteSpace: "nowrap", transition: "background 120ms",
              }}
            >
              {customValidating ? "…" : "Validate"}
            </button>
          </div>
          {customValidation && (
            <p style={{ marginTop: 6, fontSize: 11, color: customValidation.valid ? "#16a34a" : "#dc2626", margin: "6px 0 0" }}>
              {customValidation.valid
                ? `✓ Valid — ${customValidation.gpu_tier ? TIER_LABELS[customValidation.gpu_tier] ?? customValidation.gpu_tier : "unknown GPU"}`
                : `✗ ${customValidation.reason}`}
            </p>
          )}
        </div>

        {/* Mode toggle */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: 8 }}>
            Mode
          </label>
          <div style={{ display: "flex", border: "1px solid var(--color-card-border)", borderRadius: 6, overflow: "hidden" }}>
            {(["quick", "research"] as const).map((m, i) => (
              <button
                key={m}
                onClick={() => { setMode(m); if (m === "quick") { setExtraPairs([]); setGenerateError(null); } }}
                style={{
                  flex: 1, padding: "6px 0", fontSize: 11,
                  fontWeight: mode === m ? 600 : 400,
                  border: "none",
                  borderRight: i === 0 ? "1px solid var(--color-card-border)" : "none",
                  background: mode === m ? "var(--color-surface-border)" : "transparent",
                  color: mode === m ? "var(--color-text)" : "var(--color-text-muted)",
                  cursor: "pointer", transition: "background 120ms, color 120ms",
                }}
              >
                {m === "quick" ? "Quick  (1 pair)" : `Research  (up to ${pairCap} pairs)`}
              </button>
            ))}
          </div>
          <p style={{ margin: "5px 0 0", fontSize: 10, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
            {mode === "quick"
              ? "Single pair — fast iteration, higher noise. Good for exploring whether a concept steers at all."
              : "Averages DIM vectors across multiple LLM-generated pairs — lower noise, more reliable. CAA-style."}
          </p>
        </div>

        {/* Seed pair (research) / prompt pair (quick) */}
        <div
          style={{
            marginBottom: mode === "research" ? 16 : 20,
            ...(mode === "research" ? {
              borderLeft: "2px dashed var(--color-accent)",
              paddingLeft: 12,
            } : {}),
          }}
        >
          {mode === "research" && (
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--color-accent)", textTransform: "uppercase" }}>
                Seed Pair
              </span>
              <span style={{ fontSize: 9, color: "var(--color-text-muted)", lineHeight: 1.4 }}>
                pair 1 of {totalPairs > 1 ? totalPairs : pairCap}
              </span>
            </div>
          )}
          {mode === "research" && (
            <p style={{ margin: "0 0 10px", fontSize: 10, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
              Shown to Claude as a format and register reference for generation. Also averaged as the first pair in the dataset.
            </p>
          )}

          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <label style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--color-text-muted)", textTransform: "uppercase" }}>
                {mode === "research" ? "Seed · Clean" : "Reference Prompt"}
              </label>
              <span style={{ fontSize: 9, color: "var(--color-text-muted)", fontFamily: "var(--font-azeret-mono), monospace" }}>
                {cleanPrompt.trim() ? cleanPrompt.trim().split(/\s+/).length : 0}w
              </span>
            </div>
            <textarea
              value={cleanPrompt}
              onChange={e => setCleanPrompt(e.target.value)}
              rows={3}
              placeholder="Where the behavior you want to steer occurs"
              style={{
                width: "100%", border: "1px solid var(--color-card-border)", borderRadius: 6,
                padding: "8px 10px", fontSize: 12, color: "var(--color-text)",
                background: "var(--color-bg)", resize: "vertical", outline: "none",
                fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box",
              }}
            />
            <TokenPreview tokens={cleanPreview.tokens} loading={cleanPreview.loading} />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <label style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--color-text-muted)", textTransform: "uppercase" }}>
                {mode === "research" ? "Seed · Corrupted" : "Counterfactual Prompt"}
              </label>
              <span style={{ fontSize: 9, color: "var(--color-text-muted)", fontFamily: "var(--font-azeret-mono), monospace" }}>
                {corruptedPrompt.trim() ? corruptedPrompt.trim().split(/\s+/).length : 0}w
              </span>
            </div>
            <textarea
              value={corruptedPrompt}
              onChange={e => setCorruptedPrompt(e.target.value)}
              rows={3}
              placeholder="A variation that represents the direction to steer toward"
              style={{
                width: "100%", border: "1px solid var(--color-card-border)", borderRadius: 6,
                padding: "8px 10px", fontSize: 12, color: "var(--color-text)",
                background: "var(--color-bg)", resize: "vertical", outline: "none",
                fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box",
              }}
            />
            <TokenPreview tokens={corruptedPreview.tokens} loading={corruptedPreview.loading} />
            {(() => {
              const cleanToks = cleanPreview.tokens?.length;
              const corruptedToks = corruptedPreview.tokens?.length;
              if (cleanToks != null && corruptedToks != null && cleanToks !== corruptedToks) {
                return (
                  <p style={{ margin: "6px 0 0", fontSize: 10, color: "#d97706", lineHeight: 1.5 }}>
                    ⚠ Token counts differ ({cleanToks} vs {corruptedToks}). For best results use a minimal substitution.
                  </p>
                );
              }
              const cw = cleanPrompt.trim().split(/\s+/).length;
              const rw = corruptedPrompt.trim().split(/\s+/).length;
              return cleanToks == null && cleanPrompt.trim() && corruptedPrompt.trim() && cw !== rw ? (
                <p style={{ margin: "6px 0 0", fontSize: 10, color: "#d97706", lineHeight: 1.5 }}>
                  ⚠ Word counts differ ({cw} vs {rw}). For best results use a minimal substitution.
                </p>
              ) : null;
            })()}
          </div>
        </div>

        {/* Research mode: LLM pair generation */}
        {mode === "research" && (
          <div style={{ marginBottom: 20, borderTop: "1px solid var(--color-surface-border)", paddingTop: 16 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: 8 }}>
              Generate Dataset Pairs with Claude
            </label>
            {!session && (
              <p style={{ margin: "0 0 8px", fontSize: 10, color: "#d97706", lineHeight: 1.5 }}>
                Sign in to generate pairs.
              </p>
            )}
            <textarea
              value={conceptDescription}
              onChange={e => setConceptDescription(e.target.value)}
              rows={2}
              placeholder={`Describe the steering concept — e.g. "the model mentions Paris" or "confident vs. hesitant tone"`}
              disabled={!session}
              style={{
                width: "100%", border: `1px solid ${conceptDescription.trim() && session ? "var(--color-accent)" : "var(--color-card-border)"}`,
                borderRadius: 6, padding: "8px 10px", fontSize: 11, color: "var(--color-text)",
                background: session ? "var(--color-bg)" : "var(--color-surface-border)",
                resize: "vertical", outline: "none", fontFamily: "inherit", lineHeight: 1.5,
                boxSizing: "border-box", opacity: session ? 1 : 0.6,
              }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 8 }}>
              <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>
                {extraPairs.length > 0
                  ? `${totalPairs} pairs total (seed + ${extraPairs.length} generated)`
                  : `Will generate ${pairCap - 1} pairs (${pairCap} total with seed)`}
              </span>
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                style={{
                  border: "none", borderRadius: 6, padding: "5px 12px",
                  fontSize: 11, fontWeight: 500,
                  background: canGenerate ? "var(--color-accent)" : "var(--color-surface-border)",
                  color: canGenerate ? "var(--color-accent-fg)" : "var(--color-text-muted)",
                  cursor: canGenerate ? "pointer" : "not-allowed",
                  whiteSpace: "nowrap", transition: "background 120ms", flexShrink: 0,
                }}
              >
                {generating ? "Generating…" : extraPairs.length > 0 ? "Regenerate" : "Generate pairs"}
              </button>
            </div>
            {generateError && (
              <p style={{ margin: "6px 0 0", fontSize: 10, color: "#dc2626", lineHeight: 1.5 }}>
                ✗ {generateError}
              </p>
            )}

            {/* Generated pair list */}
            {extraPairs.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>
                    Generated pairs ({extraPairs.length})
                  </span>
                  <button
                    onClick={() => setExtraPairs([])}
                    style={{ fontSize: 9, color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer", padding: "0 2px" }}
                  >
                    Clear all
                  </button>
                </div>
                <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
                  {extraPairs.map((pair, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 6,
                        padding: "5px 7px", borderRadius: 5,
                        background: "var(--color-bg)", border: "1px solid var(--color-surface-border)",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 9, fontFamily: "var(--font-azeret-mono), monospace", color: "var(--color-text)", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>
                          {pair.clean}
                        </div>
                        <div style={{ fontSize: 9, fontFamily: "var(--font-azeret-mono), monospace", color: "var(--color-text-muted)", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", marginTop: 1 }}>
                          {pair.corrupted}
                        </div>
                      </div>
                      <button
                        onClick={() => removePair(i)}
                        style={{ fontSize: 11, color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer", padding: "0 1px", flexShrink: 0, lineHeight: 1, marginTop: 1 }}
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

        {/* Injection options */}
        <div style={{ borderTop: "1px solid var(--color-surface-border)", paddingTop: 16, marginBottom: 4 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: 12 }}>
            Injection Options
          </label>

          <div style={{ marginBottom: 14 }}>
            <span style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--color-text)", marginBottom: 8 }}>Position (DIM vector source)</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <label style={radioStyle}>
                <input type="radio" name="steer-position" checked={positionMode === "last"} onChange={() => setPositionMode("last")} style={radioInputStyle} />
                Last token
                <span style={{ fontSize: 10, color: "var(--color-text-muted)", marginLeft: 2 }}>— most common</span>
              </label>
              <label style={{ ...radioStyle, alignItems: "flex-start" }}>
                <input type="radio" name="steer-position" checked={positionMode === "custom"} onChange={() => setPositionMode("custom")} style={{ ...radioInputStyle, marginTop: 2 }} />
                <span>Token index</span>
                <input
                  type="number" min={0} placeholder="e.g. 3"
                  value={customPosition}
                  onFocus={() => setPositionMode("custom")}
                  onChange={e => { setPositionMode("custom"); setCustomPosition(e.target.value); }}
                  style={{
                    width: 72, marginLeft: 6,
                    border: `1px solid ${positionMode === "custom" ? "var(--color-accent)" : "var(--color-card-border)"}`,
                    borderRadius: 5, padding: "3px 6px", fontSize: 11,
                    fontFamily: "var(--font-azeret-mono), monospace",
                    color: "var(--color-text)", background: "var(--color-bg)", outline: "none",
                    transition: "border-color 120ms",
                  }}
                />
              </label>
            </div>
          </div>

          <div>
            <span style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--color-text)", marginBottom: 4 }}>
              Injection layer
              <span style={{ fontSize: 10, fontWeight: 400, color: "var(--color-text-muted)", marginLeft: 6 }}>optional — defaults to middle layer</span>
            </span>
            <input
              type="number" min={0}
              placeholder="e.g. 12"
              value={injectionLayer}
              onChange={e => setInjectionLayer(e.target.value)}
              style={{
                width: 100,
                border: `1px solid ${injectionLayer.trim() ? "var(--color-accent)" : "var(--color-card-border)"}`,
                borderRadius: 5, padding: "4px 8px", fontSize: 11,
                fontFamily: "var(--font-azeret-mono), monospace",
                color: "var(--color-text)", background: "var(--color-bg)", outline: "none",
                transition: "border-color 120ms",
              }}
            />
            <p style={{ margin: "5px 0 0", fontSize: 10, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
              Computes a difference-in-means vector from the residual stream at this layer and applies it during generation. Use Attribution first to identify the most causally relevant layer.
            </p>
          </div>
        </div>

        {/* Generation options */}
        <div style={{ borderTop: "1px solid var(--color-surface-border)", paddingTop: 16, marginBottom: 4 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: 12 }}>
            Generation
          </label>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <label style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--color-text-muted)", textTransform: "uppercase" }}>
                Generation Prompt
              </label>
              <span style={{ fontSize: 9, color: "var(--color-text-muted)", fontFamily: "var(--font-azeret-mono), monospace" }}>
                {generationPrompt.trim() ? generationPrompt.trim().split(/\s+/).length + "w" : "optional"}
              </span>
            </div>
            <textarea
              value={generationPrompt}
              onChange={e => setGenerationPrompt(e.target.value)}
              rows={2}
              placeholder={`Leave empty to use the clean prompt.`}
              style={{
                width: "100%", border: `1px solid ${generationPrompt.trim() ? "var(--color-accent)" : "var(--color-card-border)"}`,
                borderRadius: 6, padding: "8px 10px", fontSize: 12, color: "var(--color-text)",
                background: "var(--color-bg)", resize: "vertical", outline: "none",
                fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box",
                transition: "border-color 120ms",
              }}
            />
            <p style={{ margin: "5px 0 0", fontSize: 10, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
              The DIM vector is always extracted from the clean/corrupted pair above. This prompt is only used for the baseline and steered generation — keep it separate for cleaner results.
            </p>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text)" }}>Temperature</span>
              <span style={{ fontSize: 10, fontFamily: "var(--font-azeret-mono), monospace", color: "var(--color-text-muted)", minWidth: 28, textAlign: "right" }}>
                {temperature.toFixed(1)}
              </span>
            </div>
            <input
              type="range" min={0.1} max={2.0} step={0.1}
              value={temperature}
              onChange={e => setTemperature(parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: "var(--color-accent)", cursor: "pointer" }}
            />
            <p style={{ margin: "4px 0 0", fontSize: 10, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
              Lower = more deterministic. 1.0 = standard sampling. Prevents repetition loops from heavy steering.
            </p>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text)" }}>Repetition penalty</span>
              <span style={{ fontSize: 10, fontFamily: "var(--font-azeret-mono), monospace", color: "var(--color-text-muted)", minWidth: 28, textAlign: "right" }}>
                {repetitionPenalty.toFixed(2)}
              </span>
            </div>
            <input
              type="range" min={1.0} max={2.0} step={0.05}
              value={repetitionPenalty}
              onChange={e => setRepetitionPenalty(parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: "var(--color-accent)", cursor: "pointer" }}
            />
            <p style={{ margin: "4px 0 0", fontSize: 10, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
              Divides logits for already-generated tokens. 1.0 = no penalty; 1.3 = moderate (default).
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--color-surface-border)" }}>
        {isLockedByAuth && (
          <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--color-text-muted)", textAlign: "center" }}>
            Sign in to run medium and large models
          </p>
        )}
        <button
          onClick={handleRun}
          disabled={!canRun || isLockedByAuth}
          style={{
            width: "100%", padding: "10px 0", borderRadius: 6, border: "none",
            background: (!canRun || isLockedByAuth) ? "var(--color-surface-border)" : "var(--color-accent)",
            color: (!canRun || isLockedByAuth) ? "var(--color-text-muted)" : "var(--color-accent-fg)",
            fontSize: 13, fontWeight: 600,
            cursor: (!canRun || isLockedByAuth) ? "not-allowed" : "pointer",
            letterSpacing: "0.02em", transition: "background 150ms",
          }}
          onMouseEnter={e => { if (canRun && !isLockedByAuth) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-accent-hover)"; }}
          onMouseLeave={e => { if (canRun && !isLockedByAuth) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-accent)"; }}
        >
          {isLockedByAuth
            ? "Sign in to run →"
            : mode === "research" && extraPairs.length > 0
              ? `Run Steering  (${totalPairs} pairs) →`
              : "Run Steering →"}
        </button>
      </div>
    </div>
  );
}
