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
};

const DEFAULT_CLEAN_PROMPT = "When Mary and John went to the store, John gave a drink to";
const DEFAULT_CORRUPTED_PROMPT = "When Mary and John went to the store, Mary gave a drink to";

export default function AttributionConfigPane({
  isOpen,
  availableModels,
  modelsLoading,
  onSubmit,
  onClose,
}: AttributionConfigPaneProps) {
  const { data: session } = useSession();
  const [selectedModel, setSelectedModel] = useState("");
  const [cleanPrompt, setCleanPrompt] = useState(DEFAULT_CLEAN_PROMPT);
  const [corruptedPrompt, setCorruptedPrompt] = useState(DEFAULT_CORRUPTED_PROMPT);
  const [customRepoId, setCustomRepoId] = useState("");
  const [customValidation, setCustomValidation] = useState<CustomValidation | null>(null);
  const [customValidating, setCustomValidating] = useState(false);
  const [positionMode, setPositionMode] = useState<"last" | "custom">("last");
  const [customPosition, setCustomPosition] = useState("");
  const [tokenMode, setTokenMode] = useState<"auto" | "custom">("auto");
  const [customToken, setCustomToken] = useState("");
  const [contrastiveToken, setContrastiveToken] = useState("");

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
    setTokenMode("auto");
    setCustomToken("");
    setContrastiveToken("");
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

  const usingCustom = customRepoId.trim() !== "";
  const activeModelId = usingCustom
    ? (customValidation?.valid ? customRepoId.trim() : "")
    : selectedModel;
  const cleanPreview = useTokenPreview(isOpen ? activeModelId : "", cleanPrompt);
  const corruptedPreview = useTokenPreview(isOpen ? activeModelId : "", corruptedPrompt);
  const targetTokenPreview = useTokenPreview(isOpen ? activeModelId : "", tokenMode === "custom" ? customToken : "");
  const contrastivePreview = useTokenPreview(isOpen ? activeModelId : "", contrastiveToken);
  const modelOk = usingCustom ? customValidation?.valid === true : selectedModel !== "";
  const positionOk = positionMode === "last" || (customPosition.trim() !== "" && !isNaN(parseInt(customPosition)));
  const tokenOk = tokenMode === "auto" || customToken.trim() !== "";
  const canRun = modelOk && positionOk && tokenOk && cleanPrompt.trim() !== "" && corruptedPrompt.trim() !== "";

  const selectedGpuTier = usingCustom
    ? (customValidation?.gpu_tier ?? null)
    : (availableModels.find(m => m.id === selectedModel)?.gpu_tier ?? null);
  const isLockedByAuth = !session && selectedGpuTier !== null && selectedGpuTier !== "tl_small";

  const handleRun = () => {
    if (!canRun) return;
    const modelName = usingCustom ? customRepoId.trim() : selectedModel;
    const gpuTier = usingCustom
      ? (customValidation?.gpu_tier ?? undefined)
      : (availableModels.find(m => m.id === selectedModel)?.gpu_tier ?? undefined);
    const targetPosition: number | "last" = positionMode === "last" ? "last" : parseInt(customPosition);
    const targetToken: string | null = tokenMode === "auto" ? null : (customToken || null);
    const contrastiveTokenVal: string | null = contrastiveToken || null;
    onSubmit({ modelName, cleanPrompt, corruptedPrompt, gpuTier, targetPosition, targetToken, contrastiveToken: contrastiveTokenVal });
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
      <style>{`@keyframes cfgDropIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>

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
            New Attribution
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
                fontFamily: "var(--font-ibm-plex-sans), sans-serif",
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

        {/* Prompts */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <label style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--color-text-muted)", textTransform: "uppercase" }}>
              Reference Prompt
            </label>
            <span style={{ fontSize: 9, color: "var(--color-text-muted)", fontFamily: "var(--font-ibm-plex-sans), sans-serif" }}>
              {cleanPrompt.trim() ? cleanPrompt.trim().split(/\s+/).length : 0}w
            </span>
          </div>
          <textarea
            value={cleanPrompt}
            onChange={e => setCleanPrompt(e.target.value)}
            rows={3}
            placeholder="Where the behavior you want to explain occurs"
            style={{
              width: "100%", border: "1px solid var(--color-card-border)", borderRadius: 6,
              padding: "8px 10px", fontSize: 12, color: "var(--color-text)",
              background: "var(--color-bg)", resize: "vertical", outline: "none",
              fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box",
            }}
          />
          <TokenPreview tokens={cleanPreview.tokens} loading={cleanPreview.loading} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <label style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--color-text-muted)", textTransform: "uppercase" }}>
              Counterfactual Prompt
            </label>
            <span style={{ fontSize: 9, color: "var(--color-text-muted)", fontFamily: "var(--font-ibm-plex-sans), sans-serif" }}>
              {corruptedPrompt.trim() ? corruptedPrompt.trim().split(/\s+/).length : 0}w
            </span>
          </div>
          <textarea
            value={corruptedPrompt}
            onChange={e => setCorruptedPrompt(e.target.value)}
            rows={3}
            placeholder="A variation that changes the behavior"
            style={{
              width: "100%", border: "1px solid var(--color-card-border)", borderRadius: 6,
              padding: "8px 10px", fontSize: 12, color: "var(--color-text)",
              background: "var(--color-bg)", resize: "vertical", outline: "none",
              fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box",
            }}
          />
          <TokenPreview tokens={corruptedPreview.tokens} loading={corruptedPreview.loading} />
          {/* Token count mismatch warning — upgrade to real token count when available */}
          {(() => {
            const cleanToks = cleanPreview.tokens?.length;
            const corruptedToks = corruptedPreview.tokens?.length;
            if (cleanToks != null && corruptedToks != null && cleanToks !== corruptedToks) {
              return (
                <p style={{ margin: "6px 0 0", fontSize: 10, color: "#d97706", lineHeight: 1.5 }}>
                  ⚠ Token counts differ ({cleanToks} vs {corruptedToks}). Patching works best when prompts tokenize to the same length — consider using a minimal substitution (e.g. swap one name).
                </p>
              );
            }
            const cw = cleanPrompt.trim().split(/\s+/).length;
            const rw = corruptedPrompt.trim().split(/\s+/).length;
            return cleanToks == null && cleanPrompt.trim() && corruptedPrompt.trim() && cw !== rw ? (
              <p style={{ margin: "6px 0 0", fontSize: 10, color: "#d97706", lineHeight: 1.5 }}>
                ⚠ Word counts differ ({cw} vs {rw}). Patching works best when prompts tokenize to the same length — consider using a minimal substitution (e.g. swap one name).
              </p>
            ) : null;
          })()}
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--color-text-muted)", lineHeight: 1.6 }}>
            Attribution patching scores each component by how much its activation change (reference → counterfactual) points toward the target token.{" "}
            <em>Verify top K</em> on the result card then runs causal activation patches on the top candidates to confirm.
          </p>
        </div>

        {/* Analysis target */}
        <div style={{ borderTop: "1px solid var(--color-surface-border)", paddingTop: 16, marginBottom: 4 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: 12 }}>
            Analysis Target
          </label>

          <div style={{ marginBottom: 14 }}>
            <span style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--color-text)", marginBottom: 8 }}>Position</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <label style={radioStyle}>
                <input type="radio" name="attr-position" checked={positionMode === "last"} onChange={() => setPositionMode("last")} style={radioInputStyle} />
                Last token
                <span style={{ fontSize: 10, color: "var(--color-text-muted)", marginLeft: 2 }}>— next-token prediction (most common)</span>
              </label>
              <label style={{ ...radioStyle, alignItems: "flex-start" }}>
                <input type="radio" name="attr-position" checked={positionMode === "custom"} onChange={() => setPositionMode("custom")} style={{ ...radioInputStyle, marginTop: 2 }} />
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
                    fontFamily: "var(--font-ibm-plex-sans), sans-serif",
                    color: "var(--color-text)", background: "var(--color-bg)", outline: "none",
                    transition: "border-color 120ms",
                  }}
                />
              </label>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <span style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--color-text)", marginBottom: 8 }}>Target token</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <label style={radioStyle}>
                <input type="radio" name="attr-token" checked={tokenMode === "auto"} onChange={() => setTokenMode("auto")} style={radioInputStyle} />
                Top prediction
                <span style={{ fontSize: 10, color: "var(--color-text-muted)", marginLeft: 2 }}>— attribute the model&apos;s most likely next token</span>
              </label>
              <label style={{ ...radioStyle, alignItems: "flex-start" }}>
                <input type="radio" name="attr-token" checked={tokenMode === "custom"} onChange={() => setTokenMode("custom")} style={{ ...radioInputStyle, marginTop: 2 }} />
                <span style={{ flexShrink: 0 }}>Specify</span>
                <input
                  type="text" placeholder={`e.g. " Mary"`}
                  value={customToken}
                  onFocus={() => setTokenMode("custom")}
                  onChange={e => { setTokenMode("custom"); setCustomToken(e.target.value); }}
                  style={{
                    flex: 1, marginLeft: 6,
                    border: `1px solid ${tokenMode === "custom" ? "var(--color-accent)" : "var(--color-card-border)"}`,
                    borderRadius: 5, padding: "3px 6px", fontSize: 11,
                    fontFamily: "var(--font-ibm-plex-sans), sans-serif",
                    color: "var(--color-text)", background: "var(--color-bg)", outline: "none",
                    transition: "border-color 120ms",
                  }}
                />
              </label>
            </div>
            {tokenMode === "custom" && (targetTokenPreview.tokens || targetTokenPreview.loading) && (
              <div style={{ marginLeft: 22, marginTop: 2 }}>
                <TokenPreview tokens={targetTokenPreview.tokens} loading={targetTokenPreview.loading} />
                {targetTokenPreview.tokens && targetTokenPreview.tokens.length > 1 && (
                  <p style={{ margin: "3px 0 0", fontSize: 10, color: "#d97706" }}>
                    ⚠ Multi-token — only the first will be used. Try adding a leading space (e.g. &ldquo;{" " + customToken.trim()}&rdquo;).
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Contrastive token (optional) */}
          <div>
            <span style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--color-text)", marginBottom: 4 }}>
              Contrastive token
              <span style={{ fontSize: 10, fontWeight: 400, color: "var(--color-text-muted)", marginLeft: 6 }}>optional</span>
            </span>
            <input
              type="text"
              placeholder={`e.g. " John" — enables logit difference`}
              value={contrastiveToken}
              onChange={e => setContrastiveToken(e.target.value)}
              style={{
                width: "100%",
                border: `1px solid ${contrastiveToken.trim() ? "var(--color-accent)" : "var(--color-card-border)"}`,
                borderRadius: 5, padding: "4px 8px", fontSize: 11,
                fontFamily: "var(--font-ibm-plex-sans), sans-serif",
                color: "var(--color-text)", background: "var(--color-bg)", outline: "none",
                transition: "border-color 120ms", boxSizing: "border-box",
              }}
            />
            {(contrastivePreview.tokens || contrastivePreview.loading) && (
              <div style={{ marginTop: 2 }}>
                <TokenPreview tokens={contrastivePreview.tokens} loading={contrastivePreview.loading} />
                {contrastivePreview.tokens && contrastivePreview.tokens.length > 1 && (
                  <p style={{ margin: "3px 0 0", fontSize: 10, color: "#d97706" }}>
                    ⚠ Multi-token — only the first will be used. Try adding a leading space (e.g. &ldquo;{" " + contrastiveToken.trim()}&rdquo;).
                  </p>
                )}
              </div>
            )}
            <p style={{ margin: "5px 0 0", fontSize: 10, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
              When set, the gradient metric becomes logit(target) − logit(contrastive). Recommended for IOI-style tasks.
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
          {isLockedByAuth ? "Sign in to run →" : "Run Attribution →"}
        </button>
      </div>
    </div>
  );
}
