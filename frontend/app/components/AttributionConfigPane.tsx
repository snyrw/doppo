"use client";

import { useState, useEffect } from "react";
import { useTokenPreview } from "../hooks/useTokenPreview";
import { useModelSelection, type ModelInfo } from "../hooks/useModelSelection";
import ConfigPaneShell from "./ConfigPaneShell";
import ModelPicker from "./ModelPicker";
import TokenPreview from "./TokenPreview";

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

  const radioStyle = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
    fontSize: 12,
    color: "var(--text)",
  } as const;

  const radioInputStyle = {
    accentColor: "var(--accent)",
    cursor: "pointer",
    width: 13,
    height: 13,
    flexShrink: 0,
  } as const;

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
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <label style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--text-muted)", textTransform: "uppercase" }}>
              Reference Prompt
            </label>
            <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-ibm-plex-sans), sans-serif" }}>
              {cleanPrompt.trim() ? cleanPrompt.trim().split(/\s+/).length : 0}w
            </span>
          </div>
          <textarea
            value={cleanPrompt}
            onChange={e => setCleanPrompt(e.target.value)}
            disabled={tutorialMode}
            rows={3}
            placeholder="Where the behavior you want to explain occurs"
            style={{
              width: "100%", border: "1px solid var(--card-border)", borderRadius: 6,
              padding: "8px 10px", fontSize: 12, color: "var(--text)",
              background: "var(--bg)", resize: "vertical", outline: "none",
              fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box",
              ...(tutorialMode ? { opacity: 0.7, cursor: "default" } : {}),
            }}
          />
          <TokenPreview tokens={cleanPreview.tokens} loading={cleanPreview.loading} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <label style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--text-muted)", textTransform: "uppercase" }}>
              Counterfactual Prompt
            </label>
            <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-ibm-plex-sans), sans-serif" }}>
              {corruptedPrompt.trim() ? corruptedPrompt.trim().split(/\s+/).length : 0}w
            </span>
          </div>
          <textarea
            value={corruptedPrompt}
            onChange={e => setCorruptedPrompt(e.target.value)}
            disabled={tutorialMode}
            rows={3}
            placeholder="A variation that changes the behavior"
            style={{
              width: "100%", border: "1px solid var(--card-border)", borderRadius: 6,
              padding: "8px 10px", fontSize: 12, color: "var(--text)",
              background: "var(--bg)", resize: "vertical", outline: "none",
              fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box",
              ...(tutorialMode ? { opacity: 0.7, cursor: "default" } : {}),
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
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
            Attribution patching scores each component by how much its activation change (reference → counterfactual) points toward the target token.{" "}
            <em>Verify top K</em> on the result card then runs causal activation patches on the top candidates to confirm.
          </p>
        </div>

        {/* Analysis target */}
        <div style={{ borderTop: "1px solid var(--surface-border)", paddingTop: 16, marginBottom: 4 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 12 }}>
            Analysis Target
          </label>

          <div style={{ marginBottom: 14 }}>
            <span style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--text)", marginBottom: 8 }}>Position</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <label style={radioStyle}>
                <input type="radio" name="attr-position" checked={positionMode === "last"} onChange={() => setPositionMode("last")} disabled={tutorialMode} style={radioInputStyle} />
                Last token
                <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 2 }}>— next-token prediction (most common)</span>
              </label>
              <label style={{ ...radioStyle, alignItems: "flex-start" }}>
                <input type="radio" name="attr-position" checked={positionMode === "custom"} onChange={() => setPositionMode("custom")} disabled={tutorialMode} style={{ ...radioInputStyle, marginTop: 2 }} />
                <span>Token index</span>
                <input
                  type="number" min={0} placeholder="e.g. 3"
                  value={customPosition}
                  onFocus={() => setPositionMode("custom")}
                  onChange={e => { setPositionMode("custom"); setCustomPosition(e.target.value); }}
                  disabled={tutorialMode}
                  style={{
                    width: 72, marginLeft: 6,
                    border: `1px solid ${positionMode === "custom" ? "var(--accent)" : "var(--card-border)"}`,
                    borderRadius: 5, padding: "3px 6px", fontSize: 11,
                    fontFamily: "var(--font-ibm-plex-sans), sans-serif",
                    color: "var(--text)", background: "var(--bg)", outline: "none",
                    transition: "border-color 120ms",
                  }}
                />
              </label>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <span style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--text)", marginBottom: 8 }}>Target token</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <label style={radioStyle}>
                <input type="radio" name="attr-token" checked={tokenMode === "auto"} onChange={() => setTokenMode("auto")} disabled={tutorialMode} style={radioInputStyle} />
                Top prediction
                <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 2 }}>— attribute the model&apos;s most likely next token</span>
              </label>
              <label style={{ ...radioStyle, alignItems: "flex-start" }}>
                <input type="radio" name="attr-token" checked={tokenMode === "custom"} onChange={() => setTokenMode("custom")} disabled={tutorialMode} style={{ ...radioInputStyle, marginTop: 2 }} />
                <span style={{ flexShrink: 0 }}>Specify</span>
                <input
                  type="text" placeholder={`e.g. " Mary"`}
                  value={customToken}
                  onFocus={() => setTokenMode("custom")}
                  onChange={e => { setTokenMode("custom"); setCustomToken(e.target.value); }}
                  disabled={tutorialMode}
                  style={{
                    flex: 1, marginLeft: 6,
                    border: `1px solid ${tokenMode === "custom" ? "var(--accent)" : "var(--card-border)"}`,
                    borderRadius: 5, padding: "3px 6px", fontSize: 11,
                    fontFamily: "var(--font-ibm-plex-sans), sans-serif",
                    color: "var(--text)", background: "var(--bg)", outline: "none",
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
            <span style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--text)", marginBottom: 4 }}>
              Contrastive token
              <span style={{ fontSize: 10, fontWeight: 400, color: "var(--text-muted)", marginLeft: 6 }}>optional</span>
            </span>
            <input
              type="text"
              placeholder={`e.g. " John" — enables logit difference`}
              value={contrastiveToken}
              onChange={e => setContrastiveToken(e.target.value)}
              disabled={tutorialMode}
              style={{
                width: "100%",
                border: `1px solid ${contrastiveToken.trim() ? "var(--accent)" : "var(--card-border)"}`,
                borderRadius: 5, padding: "4px 8px", fontSize: 11,
                fontFamily: "var(--font-ibm-plex-sans), sans-serif",
                color: "var(--text)", background: "var(--bg)", outline: "none",
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
            <p style={{ margin: "5px 0 0", fontSize: 10, color: "var(--text-muted)", lineHeight: 1.5 }}>
              When set, the gradient metric becomes logit(target) − logit(contrastive). Recommended for IOI-style tasks.
            </p>
          </div>
        </div>
    </ConfigPaneShell>
  );
}
