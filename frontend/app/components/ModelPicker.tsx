"use client";

import { TIER_LABELS } from "../lib/tiers";
import type { ModelInfo, ModelSelection } from "../hooks/useModelSelection";

const labelStyle = {
  display: "block",
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.08em",
  color: "var(--color-text-muted)",
  textTransform: "uppercase",
  marginBottom: 8,
} as const;

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
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Model</label>
        <div style={{ padding: "8px 16px 4px", fontSize: 12, color: "var(--color-text)", fontFamily: "var(--font-ibm-plex-sans), sans-serif" }}>
          {tutorialModelName}
        </div>
      </div>
    );
  }

  return (
    <>
      {!tutorialMode && (
        <>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Featured Models</label>

            {modelsLoading ? (
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", padding: "12px 0" }}>Loading models…</div>
            ) : (
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 7,
                maxHeight: gridMaxHeight,
                overflowY: "auto",
                paddingRight: 2,
              }}>
                {models.map(m => {
                  const isSelected = picker.selectedModel === m.id && !picker.usingCustom;
                  return (
                    <button
                      key={m.id}
                      onClick={() => picker.selectFeaturedModel(m.id)}
                      title={m.description}
                      style={{
                        border: `1.5px solid ${isSelected ? "var(--color-accent)" : "var(--color-card-border)"}`,
                        borderRadius: 7,
                        padding: "8px 9px",
                        background: isSelected ? "var(--color-surface-border)" : "var(--color-card)",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "border-color 120ms, background 120ms",
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-accent)"; }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-card-border)"; }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 600, color: isSelected ? "var(--color-accent)" : "var(--color-text)", lineHeight: 1.3 }}>
                        {m.display_name}
                      </span>
                      <span style={{
                        fontSize: 10,
                        color: "var(--color-text-muted)",
                        lineHeight: 1.4,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}>
                        {m.description}
                      </span>
                      {m.requires_hf_token && (
                        <span style={{ fontSize: 9, color: "var(--color-text-muted)", marginTop: 1, letterSpacing: "0.02em" }}>
                          HF token required
                        </span>
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
            <span style={{ fontSize: 10, color: "var(--color-text-muted)", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              or
            </span>
            <div style={{ flex: 1, height: 1, background: "var(--color-surface-border)" }} />
          </div>
        </>
      )}

      {/* Any HuggingFace model */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Any HuggingFace Model</label>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            type="text"
            placeholder="username/model-name"
            value={picker.customRepoId}
            onChange={e => picker.setCustomRepo(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && picker.customRepoId.trim()) picker.validateCustomRepo(); }}
            disabled={tutorialMode}
            style={{
              flex: 1,
              border: `1px solid ${picker.usingCustom ? "var(--color-accent)" : "var(--color-card-border)"}`,
              borderRadius: 6,
              padding: "6px 8px",
              fontSize: 11,
              fontFamily: "var(--font-ibm-plex-sans), sans-serif",
              color: "var(--color-text)",
              background: "var(--color-bg)",
              outline: "none",
              transition: "border-color 120ms",
              ...(tutorialMode ? { opacity: 0.7, cursor: "default" } : {}),
            }}
          />
          <button
            onClick={picker.validateCustomRepo}
            disabled={tutorialMode || !picker.customRepoId.trim() || picker.customValidating}
            style={{
              border: "1px solid var(--color-card-border)",
              borderRadius: 6,
              padding: "6px 10px",
              fontSize: 11,
              background: "var(--color-surface-border)",
              color: "var(--color-text-muted)",
              cursor: (tutorialMode || !picker.customRepoId.trim() || picker.customValidating) ? "not-allowed" : "pointer",
              opacity: (tutorialMode || !picker.customRepoId.trim() || picker.customValidating) ? 0.5 : 1,
              whiteSpace: "nowrap",
              transition: "background 120ms",
            }}
          >
            {picker.customValidating ? "…" : "Validate"}
          </button>
        </div>
        {picker.customValidation && (
          <p style={{ marginTop: 6, fontSize: 11, color: picker.customValidation.valid ? "#16a34a" : "#dc2626", margin: "6px 0 0" }}>
            {picker.customValidation.valid
              ? `✓ Valid — ${picker.customValidation.gpu_tier ? TIER_LABELS[picker.customValidation.gpu_tier] ?? picker.customValidation.gpu_tier : "unknown GPU"}`
              : `✗ ${picker.customValidation.reason}`}
          </p>
        )}
      </div>
    </>
  );
}
