"use client";

import { TIER_LABELS } from "../lib/tiers";
import { cn } from "../lib/cn";
import type { ModelInfo, ModelSelection } from "../hooks/useModelSelection";

const labelCls = "mb-2 block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted";

type ModelPickerProps = {
  picker: ModelSelection;
  models: ModelInfo[];
  modelsLoading: boolean;
  gridMaxHeight?: number;
  tutorialMode?: boolean;
  tutorialModelName?: string;
  /**
   * How the picker renders in tutorial mode: "static" shows just the pinned
   * model name; "input" keeps the (disabled) custom-ID field visible.
   */
  tutorialVariant?: "static" | "input";
};

/** Featured-model grid + custom HuggingFace ID input, driven by useModelSelection. */
export default function ModelPicker({
  picker,
  models,
  modelsLoading,
  gridMaxHeight = 260,
  tutorialMode,
  tutorialModelName,
  tutorialVariant = "static",
}: ModelPickerProps) {
  if (tutorialMode && tutorialVariant === "static") {
    return (
      <div className="mb-5">
        <label className={labelCls}>Model</label>
        <div className="px-4 pb-1 pt-2 text-xs text-foreground">
          {tutorialModelName}
        </div>
      </div>
    );
  }

  return (
    <>
      {!tutorialMode && (
        <>
          <div className="mb-5">
            <label className={labelCls}>Featured Models</label>

            {modelsLoading ? (
              <div className="py-3 text-xs text-muted">Loading models…</div>
            ) : (
              <div
                className="grid grid-cols-2 gap-[7px] overflow-y-auto pr-0.5"
                style={{ maxHeight: gridMaxHeight }}
              >
                {models.map(m => {
                  const isSelected = picker.selectedModel === m.id && !picker.usingCustom;
                  return (
                    <button
                      key={m.id}
                      onClick={() => picker.selectFeaturedModel(m.id)}
                      title={m.description}
                      className={cn(
                        "flex cursor-pointer flex-col gap-[3px] rounded-[7px] border-[1.5px] px-[9px] py-2 text-left transition-colors",
                        isSelected
                          ? "border-accent bg-surface-border"
                          : "border-card-border bg-card hover:border-accent",
                      )}
                    >
                      <span className={cn("text-[11px] font-semibold leading-[1.3]", isSelected ? "text-accent" : "text-foreground")}>
                        {m.display_name}
                      </span>
                      <span className="line-clamp-2 overflow-hidden text-[10px] leading-[1.4] text-muted">
                        {m.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="mb-4 flex items-center gap-2">
            <div className="h-px flex-1 bg-surface-border" />
            <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted">
              or
            </span>
            <div className="h-px flex-1 bg-surface-border" />
          </div>
        </>
      )}

      {/* Any HuggingFace model */}
      <div className="mb-5">
        <label className={labelCls}>Custom</label>
        <div className="flex gap-1.5">
          <input
            type="text"
            placeholder="username/model-name"
            value={picker.customRepoId}
            onChange={e => picker.setCustomRepo(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && picker.customRepoId.trim()) picker.validateCustomRepo(); }}
            disabled={tutorialMode}
            className={cn(
              "flex-1 rounded-md border bg-background px-2 py-1.5 text-[11px] text-foreground outline-none transition-colors disabled:cursor-default disabled:opacity-70",
              picker.usingCustom ? "border-accent" : "border-card-border",
            )}
          />
          <button
            onClick={picker.validateCustomRepo}
            disabled={tutorialMode || !picker.customRepoId.trim() || picker.customValidating}
            className="cursor-pointer whitespace-nowrap rounded-md border border-card-border bg-surface-border px-2.5 py-1.5 text-[11px] text-muted transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {picker.customValidating ? "…" : "Validate"}
          </button>
        </div>
        {picker.customValidation && (
          <p className={cn("m-0 mt-1.5 text-[11px]", picker.customValidation.valid ? "text-green-600" : "text-red-600")}>
            {picker.customValidation.valid
              ? `✓ Valid — ${picker.customValidation.gpu_tier ? TIER_LABELS[picker.customValidation.gpu_tier] ?? picker.customValidation.gpu_tier : "unknown GPU"}`
              : `✗ ${picker.customValidation.reason}`}
            {picker.customValidation.valid && picker.customValidation.adapter && (
              <span className="block text-muted">
                Adapter → merges onto {picker.customValidation.adapter.base_id}
              </span>
            )}
          </p>
        )}
      </div>
    </>
  );
}