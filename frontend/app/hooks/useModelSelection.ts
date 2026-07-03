"use client";

import { useState, useEffect } from "react";

export type ModelInfo = {
  id: string;
  display_name: string;
  description: string;
  requires_hf_token: boolean;
  gpu_tier: string;
};

export type CustomValidation = {
  valid: boolean;
  gpu_tier: string | null;
  reason: string;
  adapter?: { base_id: string; adapter_id: string };
};

/**
 * Shared model-selection state machine for all ConfigPanes: featured-model
 * grid and free-text HuggingFace ID are mutually exclusive — picking a card
 * clears the text input, typing clears the card selection. Custom IDs must
 * pass an explicit validate step before the pane's Run button enables.
 */
export function useModelSelection(availableModels: ModelInfo[]) {
  const [selectedModel, setSelectedModel] = useState("");
  const [customRepoId, setCustomRepoId] = useState("");
  const [customValidation, setCustomValidation] = useState<CustomValidation | null>(null);
  const [customValidating, setCustomValidating] = useState(false);

  useEffect(() => {
    if (selectedModel === "" && availableModels.length > 0 && customRepoId === "") {
      setSelectedModel(availableModels[0].id);
    }
  }, [availableModels, selectedModel, customRepoId]);

  const usingCustom = customRepoId.trim() !== "";
  /** Model ID safe to tokenize against — empty until a custom ID validates. */
  const activeModelId = usingCustom
    ? (customValidation?.valid ? customRepoId.trim() : "")
    : selectedModel;
  const modelOk = usingCustom ? customValidation?.valid === true : selectedModel !== "";
  const selectedGpuTier = usingCustom
    ? (customValidation?.gpu_tier ?? null)
    : (availableModels.find(m => m.id === selectedModel)?.gpu_tier ?? null);
  const modelName = usingCustom ? customRepoId.trim() : selectedModel;
  const gpuTier = selectedGpuTier ?? undefined;

  const selectFeaturedModel = (id: string) => {
    setSelectedModel(id);
    setCustomRepoId("");
    setCustomValidation(null);
  };

  const setCustomRepo = (value: string) => {
    setCustomRepoId(value);
    setSelectedModel("");
    setCustomValidation(null);
  };

  const validateCustomRepo = async () => {
    setCustomValidating(true);
    setCustomValidation(null);
    try {
      const res = await fetch("/api/validate-model", {
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

  const reset = () => {
    setSelectedModel(availableModels[0]?.id ?? "");
    setCustomRepoId("");
    setCustomValidation(null);
    setCustomValidating(false);
  };

  /** Tutorial pre-fill: pin a featured model by name, bypassing the grid. */
  const forceModel = (name: string) => {
    setSelectedModel(name);
    setCustomRepoId("");
  };

  /** Tutorial pre-fill for non-featured models: pin a custom ID as already validated. */
  const forceCustomModel = (repoId: string, tier: string) => {
    setCustomRepoId(repoId);
    setSelectedModel("");
    setCustomValidation({ valid: true, gpu_tier: tier, reason: "" });
  };

  return {
    selectedModel, customRepoId, customValidation, customValidating,
    usingCustom, activeModelId, modelOk, selectedGpuTier, modelName, gpuTier,
    selectFeaturedModel, setCustomRepo, validateCustomRepo, reset, forceModel, forceCustomModel,
  };
}

export type ModelSelection = ReturnType<typeof useModelSelection>;
