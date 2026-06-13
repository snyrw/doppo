"use client";

import { useState, useEffect } from "react";
import { useTokenPreview } from "../hooks/useTokenPreview";
import { useModelSelection, type ModelInfo } from "../hooks/useModelSelection";
import ConfigPaneShell from "./ConfigPaneShell";
import ModelPicker from "./ModelPicker";
import TokenPreview from "./TokenPreview";

type DlaConfigPaneProps = {
  isOpen: boolean;
  availableModels: ModelInfo[];
  modelsLoading: boolean;
  onSubmit: (config: {
    modelName: string;
    prompt: string;
    gpuTier?: string;
    targetPosition: number | "last";
    targetToken: string | null;
    contrastiveToken: string | null;
  }) => void;
  onClose: () => void;
  tutorialMode?: boolean;
  tutorialConfig?: {
    modelName: string;
    prompt: string;
    gpuTier: string;
    targetPosition: number | "last";
    targetToken: string | null;
    contrastiveToken: string | null;
  };
};

const DEFAULT_PROMPT = "The capital of France is Paris. The capital of Germany is";


export default function DlaConfigPane({
  isOpen,
  availableModels,
  modelsLoading,
  onSubmit,
  onClose,
  tutorialMode,
  tutorialConfig,
}: DlaConfigPaneProps) {
  const picker = useModelSelection(availableModels);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [positionMode, setPositionMode] = useState<"last" | "custom">("last");
  const [customPosition, setCustomPosition] = useState("");
  const [tokenMode, setTokenMode] = useState<"auto" | "custom">("auto");
  const [customToken, setCustomToken] = useState("");
  const [contrastiveToken, setContrastiveToken] = useState("");

  useEffect(() => {
    if (tutorialMode && tutorialConfig) {
      setPrompt(tutorialConfig.prompt);
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
    setPrompt(DEFAULT_PROMPT);
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

  const tokenPreview = useTokenPreview(isOpen ? picker.activeModelId : "", prompt);
  const targetTokenPreview = useTokenPreview(isOpen ? picker.activeModelId : "", tokenMode === "custom" ? customToken : "");
  const contrastivePreview = useTokenPreview(isOpen ? picker.activeModelId : "", contrastiveToken);
  const positionOk = positionMode === "last" || (customPosition.trim() !== "" && !isNaN(parseInt(customPosition)));
  const tokenOk = tokenMode === "auto" || customToken.trim() !== "";
  const canRun = picker.modelOk && positionOk && tokenOk;

  const handleRun = () => {
    if (!canRun) return;
    const { modelName, gpuTier } = picker;
    const targetPosition: number | "last" = positionMode === "last" ? "last" : parseInt(customPosition);
    const targetToken: string | null = tokenMode === "auto" ? null : (customToken || null);
    const contrastiveTokenVal: string | null = contrastiveToken || null;
    onSubmit({ modelName, prompt, gpuTier, targetPosition, targetToken, contrastiveToken: contrastiveTokenVal });
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
      title="New DLA"
      canRun={canRun}
      runLabel="Run DLA →"
      onRun={handleRun}
      onClose={handleClose}
    >
        {/* Featured models / model selection */}
        <ModelPicker
          picker={picker}
          models={availableModels}
          modelsLoading={modelsLoading}
          tutorialMode={tutorialMode}
          tutorialModelName={tutorialConfig?.modelName}
        />

        {/* Prompt */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>
            Prompt
          </label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            disabled={tutorialMode}
            rows={5}
            style={{
              width: "100%",
              border: "1px solid var(--card-border)",
              borderRadius: 6,
              padding: "8px 10px",
              fontSize: 13,
              color: "var(--text)",
              background: "var(--bg)",
              resize: "vertical",
              outline: "none",
              fontFamily: "inherit",
              lineHeight: 1.5,
              boxSizing: "border-box",
              ...(tutorialMode ? { opacity: 0.7, cursor: "default" } : {}),
            }}
          />
          <TokenPreview tokens={tokenPreview.tokens} loading={tokenPreview.loading} />
        </div>

        {/* Analysis target section */}
        <div style={{ borderTop: "1px solid var(--surface-border)", paddingTop: 16, marginBottom: 4 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 12 }}>
            Analysis Target
          </label>

          {/* Position */}
          <div style={{ marginBottom: 14 }}>
            <span style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--text)", marginBottom: 8 }}>
              Position
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <label style={radioStyle}>
                <input
                  type="radio"
                  name="dla-position"
                  checked={positionMode === "last"}
                  onChange={() => setPositionMode("last")}
                  disabled={tutorialMode}
                  style={radioInputStyle}
                />
                Last token
                <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 2 }}>
                  — next-token prediction (most common)
                </span>
              </label>
              <label style={{ ...radioStyle, alignItems: "flex-start" }}>
                <input
                  type="radio"
                  name="dla-position"
                  checked={positionMode === "custom"}
                  onChange={() => setPositionMode("custom")}
                  disabled={tutorialMode}
                  style={{ ...radioInputStyle, marginTop: 2 }}
                />
                <span>Token index</span>
                <input
                  type="number"
                  min={0}
                  placeholder="e.g. 3"
                  value={customPosition}
                  onFocus={() => setPositionMode("custom")}
                  onChange={e => { setPositionMode("custom"); setCustomPosition(e.target.value); }}
                  disabled={tutorialMode}
                  style={{
                    width: 72,
                    marginLeft: 6,
                    border: `1px solid ${positionMode === "custom" ? "var(--accent)" : "var(--card-border)"}`,
                    borderRadius: 5,
                    padding: "3px 6px",
                    fontSize: 11,
                    fontFamily: "var(--font-ibm-plex-sans), sans-serif",
                    color: "var(--text)",
                    background: "var(--bg)",
                    outline: "none",
                    transition: "border-color 120ms",
                  }}
                />
              </label>
            </div>
          </div>

          {/* Target token */}
          <div style={{ marginBottom: 14 }}>
            <span style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--text)", marginBottom: 8 }}>
              Target token
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <label style={radioStyle}>
                <input
                  type="radio"
                  name="dla-token"
                  checked={tokenMode === "auto"}
                  onChange={() => setTokenMode("auto")}
                  disabled={tutorialMode}
                  style={radioInputStyle}
                />
                Top prediction
                <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 2 }}>
                  — attribute the model&apos;s most likely next token
                </span>
              </label>
              <label style={{ ...radioStyle, alignItems: "flex-start" }}>
                <input
                  type="radio"
                  name="dla-token"
                  checked={tokenMode === "custom"}
                  onChange={() => setTokenMode("custom")}
                  disabled={tutorialMode}
                  style={{ ...radioInputStyle, marginTop: 2 }}
                />
                <span style={{ flexShrink: 0 }}>Specify</span>
                <input
                  type="text"
                  placeholder={`e.g. " Paris"`}
                  value={customToken}
                  onFocus={() => setTokenMode("custom")}
                  onChange={e => { setTokenMode("custom"); setCustomToken(e.target.value); }}
                  disabled={tutorialMode}
                  style={{
                    flex: 1,
                    marginLeft: 6,
                    border: `1px solid ${tokenMode === "custom" ? "var(--accent)" : "var(--card-border)"}`,
                    borderRadius: 5,
                    padding: "3px 6px",
                    fontSize: 11,
                    fontFamily: "var(--font-ibm-plex-sans), sans-serif",
                    color: "var(--text)",
                    background: "var(--bg)",
                    outline: "none",
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
              placeholder={`e.g. " Berlin" — enables logit difference`}
              value={contrastiveToken}
              onChange={e => setContrastiveToken(e.target.value)}
              disabled={tutorialMode}
              style={{
                width: "100%",
                border: `1px solid ${contrastiveToken.trim() ? "var(--accent)" : "var(--card-border)"}`,
                borderRadius: 5,
                padding: "4px 8px",
                fontSize: 11,
                fontFamily: "var(--font-ibm-plex-sans), sans-serif",
                color: "var(--text)",
                background: "var(--bg)",
                outline: "none",
                transition: "border-color 120ms",
                boxSizing: "border-box",
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
              When set, uses logit difference (target − contrastive) as the attribution direction — the standard metric for contrastive tasks like IOI.
            </p>
          </div>
        </div>
    </ConfigPaneShell>
  );
}
