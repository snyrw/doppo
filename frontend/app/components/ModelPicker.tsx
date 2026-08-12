"use client";

import { TIER_LABELS } from "../lib/tiers";
import { cn } from "../lib/cn";
import { PANEL_HEADING, PANEL_LABEL, PANEL_META } from "./configledger/panel-type";
import { formatModelMeta } from "./configledger/model-row";
import { BLOCK_GAP, TIGHT_GAP, MICRO_GAP, GRID_MAX_H } from "./configledger/ledger-geometry";
import type { ModelInfo, ModelSelection } from "../hooks/useModelSelection";

type ModelPickerProps = {
  picker: ModelSelection;
  models: ModelInfo[];
  modelsLoading: boolean;
};

/** Featured-model grid + custom HuggingFace ID input, driven by useModelSelection. */
export default function ModelPicker({
  picker,
  models,
  modelsLoading,
}: ModelPickerProps) {
  return (
    <>
      <div style={{ marginBottom: BLOCK_GAP }}>
        <h3 className={cn(PANEL_HEADING, "m-0")} style={{ marginBottom: TIGHT_GAP }}>Model</h3>

        {modelsLoading ? (
          <div className={cn(PANEL_META, "py-3")}>Loading models…</div>
        ) : (
          <div
            className="flex flex-col overflow-y-auto pr-0.5"
            style={{ maxHeight: GRID_MAX_H, gap: MICRO_GAP }}
          >
            {models.map(m => {
              const isSelected = picker.selectedModel === m.id && !picker.usingCustom;
              return (
                <button
                  key={m.id}
                  onClick={() => picker.selectFeaturedModel(m.id)}
                  title={m.description}
                  className={cn(
                    "flex cursor-pointer items-baseline justify-between gap-2 rounded-[var(--ctl-radius-xs)] border-[1.5px] px-[9px] py-1.5 text-left transition-colors",
                    isSelected
                      ? "border-accent bg-surface-border"
                      : "border-card-border bg-card hover:border-accent",
                  )}
                >
                  <span className={cn(
                    "min-w-0 truncate",
                    isSelected ? "text-[11px] leading-[14px] font-semibold text-accent" : PANEL_LABEL,
                  )}>
                    {m.display_name}
                  </span>
                  <span className={cn(PANEL_META, "shrink-0")}>
                    {formatModelMeta(m.description, m.display_name, m.gpu_tier)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* The custom-ID row extends the list above rather than opening a second
          block: once the list is one column, the old featured/or/custom-ID
          split was 82px of chrome between a list and the input that extends it. */}
      <div>
        {/* Mini rule, recycled from ConfigLedger's section divider, sized to
            the label's own width (plus a small overhang) rather than full-bleed,
            so it reads as "Model" and "Use Your Own" being two sections. */}
        <div
          className="inline-block border-t border-surface-border"
          style={{ paddingTop: TIGHT_GAP, paddingRight: BLOCK_GAP }}
        >
          <label className={cn(PANEL_LABEL, "block")} style={{ marginBottom: TIGHT_GAP }}>
            Use Your Own
          </label>
        </div>
        <div className="flex" style={{ gap: TIGHT_GAP }}>
          <input
            type="text"
            placeholder="username/model-name"
            value={picker.customRepoId}
            onChange={e => picker.setCustomRepo(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && picker.customRepoId.trim()) picker.validateCustomRepo(); }}
            className={cn(
              "flex-1 rounded-[var(--ctl-radius-xs)] border bg-background px-2 py-1.5 text-[11px] text-foreground outline-none transition-colors disabled:cursor-default disabled:opacity-70",
              picker.usingCustom ? "border-accent" : "border-card-border",
            )}
          />
          <button
            onClick={picker.validateCustomRepo}
            disabled={!picker.customRepoId.trim() || picker.customValidating}
            className="cursor-pointer whitespace-nowrap rounded-[var(--ctl-radius-xs)] border border-card-border bg-surface-border px-2.5 py-1.5 text-[11px] text-muted transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {picker.customValidating ? "…" : "Validate"}
          </button>
        </div>
        {picker.customValidation && (
          <p className={cn("m-0 text-[11px]", picker.customValidation.valid ? "text-green-600" : "text-red-600")} style={{ marginTop: TIGHT_GAP }}>
            {picker.customValidation.valid
              ? `✓ Valid, ${picker.customValidation.gpu_tier ? TIER_LABELS[picker.customValidation.gpu_tier] ?? picker.customValidation.gpu_tier : "unknown GPU"}`
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