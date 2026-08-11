"use client";

import React from "react";
import { cn } from "../../lib/cn";
import TokenPreview from "../TokenPreview";
import { PANEL_LABEL, PANEL_META } from "./panel-type";
import { BLOCK_GAP, TIGHT_GAP, MICRO_GAP } from "./ledger-geometry";

export type TokenPreviewResult = {
  tokens: { text: string; special: boolean }[] | null;
  loading: boolean;
};

const radioCls = "flex cursor-pointer items-center gap-1.5 text-xs text-foreground";
const radioInputCls = "h-[13px] w-[13px] shrink-0 cursor-pointer accent-[var(--accent)]";
export const smallInputCls = "rounded-[var(--ctl-radius-xs)] bg-background text-[11px] text-foreground outline-none transition-colors";
const promptCls = "box-border w-full resize-y rounded-[var(--ctl-radius-xs)] border border-card-border bg-background px-2.5 py-2 font-[inherit] text-xs leading-normal text-foreground outline-none disabled:cursor-default disabled:opacity-70";

export function FieldLabel({ children, meta }: { children: React.ReactNode; meta?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between" style={{ marginBottom: TIGHT_GAP }}>
      <span className={PANEL_LABEL}>{children}</span>
      {meta != null && <span className={PANEL_META}>{meta}</span>}
    </div>
  );
}

export function PromptField({
  label, value, onChange, preview, placeholder, rows = 3, disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  preview: TokenPreviewResult;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}) {
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between" style={{ marginBottom: TIGHT_GAP }}>
        <label className={PANEL_LABEL}>{label}</label>
        <span className={PANEL_META}>{wordCount}w</span>
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        rows={rows}
        placeholder={placeholder}
        className={promptCls}
      />
      <TokenPreview tokens={preview.tokens} loading={preview.loading} />
    </div>
  );
}

function PositionField({
  name, mode, custom, onModeChange, onCustomChange, disabled,
}: {
  name: string;
  mode: "last" | "custom";
  custom: string;
  onModeChange: (m: "last" | "custom") => void;
  onCustomChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ marginBottom: BLOCK_GAP }}>
      <span className={cn(PANEL_LABEL, "block")} style={{ marginBottom: TIGHT_GAP }}>Position</span>
      <div className="flex flex-col" style={{ gap: TIGHT_GAP }}>
        <label className={radioCls}>
          <input type="radio" name={name} checked={mode === "last"} onChange={() => onModeChange("last")} disabled={disabled} className={radioInputCls} />
          Last token
        </label>
        <label className={cn(radioCls, "items-start")}>
          <input type="radio" name={name} checked={mode === "custom"} onChange={() => onModeChange("custom")} disabled={disabled} className={cn(radioInputCls, "mt-0.5")} />
          <span>Token index</span>
          <input
            type="number" min={0} placeholder="e.g. 3"
            value={custom}
            onFocus={() => onModeChange("custom")}
            onChange={e => { onModeChange("custom"); onCustomChange(e.target.value); }}
            disabled={disabled}
            className={cn(smallInputCls, "ml-1.5 w-[72px] border px-1.5 py-[3px]", mode === "custom" ? "border-accent" : "border-card-border")}
          />
        </label>
      </div>
    </div>
  );
}

function TargetTokenField({
  name, mode, custom, onModeChange, onCustomChange, preview, disabled,
}: {
  name: string;
  mode: "auto" | "custom";
  custom: string;
  onModeChange: (m: "auto" | "custom") => void;
  onCustomChange: (v: string) => void;
  preview: TokenPreviewResult;
  disabled?: boolean;
}) {
  return (
    <div style={{ marginBottom: BLOCK_GAP }}>
      <span className={cn(PANEL_LABEL, "block")} style={{ marginBottom: TIGHT_GAP }}>Target token</span>
      <div className="flex flex-col" style={{ gap: TIGHT_GAP }}>
        <label className={radioCls}>
          <input type="radio" name={name} checked={mode === "auto"} onChange={() => onModeChange("auto")} disabled={disabled} className={radioInputCls} />
          Top prediction
        </label>
        <label className={cn(radioCls, "items-start")}>
          <input type="radio" name={name} checked={mode === "custom"} onChange={() => onModeChange("custom")} disabled={disabled} className={cn(radioInputCls, "mt-0.5")} />
          <span className="shrink-0">Specify</span>
          <input
            type="text" placeholder={`e.g. " Paris"`}
            value={custom}
            onFocus={() => onModeChange("custom")}
            onChange={e => { onModeChange("custom"); onCustomChange(e.target.value); }}
            disabled={disabled}
            className={cn(smallInputCls, "ml-1.5 flex-1 border px-1.5 py-[3px]", mode === "custom" ? "border-accent" : "border-card-border")}
          />
        </label>
      </div>
      {mode === "custom" && (preview.tokens || preview.loading) && (
        <div className="ml-[22px] mt-0.5">
          <TokenPreview tokens={preview.tokens} loading={preview.loading} />
          {preview.tokens && preview.tokens.length > 1 && (
            <p className="m-0 text-[10px] text-amber-600" style={{ marginTop: MICRO_GAP }}>
              ⚠ Multi-token: only the first is used. Add a leading space to combine (e.g. &ldquo;{" " + custom.trim()}&rdquo;).
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ContrastiveTokenField({
  value, onChange, preview, placeholder, help, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  preview: TokenPreviewResult;
  placeholder: string;
  help: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <span className={cn(PANEL_LABEL, "block")} style={{ marginBottom: MICRO_GAP }}>
        Contrastive token
        <span className={cn(PANEL_META, "ml-1.5")}>optional</span>
      </span>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className={cn(smallInputCls, "box-border w-full border px-2 py-1", value.trim() ? "border-accent" : "border-card-border")}
      />
      {(preview.tokens || preview.loading) && (
        <div className="mt-0.5">
          <TokenPreview tokens={preview.tokens} loading={preview.loading} />
          {preview.tokens && preview.tokens.length > 1 && (
            <p className="m-0 text-[10px] text-amber-600" style={{ marginTop: MICRO_GAP }}>
              ⚠ Multi-token: only the first is used. Add a leading space to combine (e.g. &ldquo;{" " + value.trim()}&rdquo;).
            </p>
          )}
        </div>
      )}
      <p className={cn(PANEL_META, "m-0")} style={{ marginTop: MICRO_GAP }}>{help}</p>
    </div>
  );
}

export type TargetSectionProps = {
  name: string;
  positionMode: "last" | "custom";
  customPosition: string;
  onPositionMode: (m: "last" | "custom") => void;
  onCustomPosition: (v: string) => void;
  tokenMode: "auto" | "custom";
  customToken: string;
  onTokenMode: (m: "auto" | "custom") => void;
  onCustomToken: (v: string) => void;
  targetTokenPreview: TokenPreviewResult;
  contrastiveToken: string;
  onContrastiveToken: (v: string) => void;
  contrastivePreview: TokenPreviewResult;
  contrastivePlaceholder: string;
  contrastiveHelp: string;
  disabled?: boolean;
};

/** Position + target token + contrastive token — shared by DLA and Attribution. */
export function TargetSection(props: TargetSectionProps) {
  return (
    <div>
      <PositionField
        name={`${props.name}-position`}
        mode={props.positionMode} custom={props.customPosition}
        onModeChange={props.onPositionMode} onCustomChange={props.onCustomPosition}
        disabled={props.disabled}
      />
      <TargetTokenField
        name={`${props.name}-token`}
        mode={props.tokenMode} custom={props.customToken}
        onModeChange={props.onTokenMode} onCustomChange={props.onCustomToken}
        preview={props.targetTokenPreview} disabled={props.disabled}
      />
      <ContrastiveTokenField
        value={props.contrastiveToken} onChange={props.onContrastiveToken}
        preview={props.contrastivePreview}
        placeholder={props.contrastivePlaceholder} help={props.contrastiveHelp}
        disabled={props.disabled}
      />
    </div>
  );
}
