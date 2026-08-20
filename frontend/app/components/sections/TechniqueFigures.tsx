"use client";

import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import { cn } from "../../lib/cn";
import { STEERING_EXAMPLES } from "./techniqueCardData";
import {
  BAR_LIP, CELL_LIP, ATTN_CELL_LIP,
  LENS_COLS, LENS_ROWS, LENS_GRID, LENS_LEVELS, type LensCell,
  ATTN_TOKENS, ATTN_GRID, ATTN_LEVELS, type AttnStrength,
  DLA_BARS, DLA_LEVELS, dlaStrongestLabel,
  PATCH_PAIRS, PATCH_LEVELS, patchAlwaysOverestimates,
} from "./techniqueFigureData";

// The five decorative figures that sit in the left column of each technique card.
function FigureBox({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-[12px] border border-card-border bg-card p-[clamp(14px,1.9vw,28px)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

const LABEL = "font-mono text-muted leading-none";
const LABEL_SIZE = "text-[clamp(9px,0.95vw,15px)]";

// ── 0. Logit Lens — 8×4 warm heatmap ─────────────────────────────────────────
// confidence level → {face, lip}: pale (low) → saturated warm (high)
const LENS_LEVEL: Record<LensCell["level"], { face: string; lip: string }> = {
  0: LENS_LEVELS[0], 1: LENS_LEVELS[1], 2: LENS_LEVELS[2], 3: LENS_LEVELS[3],
};

function LensFigure() {
  return (
    <FigureBox>
      <div
        className="grid items-center gap-x-[clamp(5px,0.6vw,9px)] gap-y-[clamp(6px,0.8vw,12px)]"
        style={{ gridTemplateColumns: "auto repeat(4, minmax(0, 1fr))" }}
      >
        {/* header row: empty corner + column position-token labels */}
        <span />
        {LENS_COLS.map((c, i) => (
          <span key={`h${i}`} className={cn(LABEL, LABEL_SIZE, "pb-[clamp(2px,0.4vw,6px)] text-center")}>
            {c}
          </span>
        ))}
        {/* 8 layer rows: layer label + 4 predicted-token cells */}
        {LENS_GRID.map((row, r) => (
          <LensRow key={`r${r}`} label={`L${LENS_ROWS[r]}`} row={row} rowIndex={r} />
        ))}
      </div>
    </FigureBox>
  );
}

const ROW_STAGGER_MS = 70;

function LensRow({ label, row, rowIndex }: { label: string; row: LensCell[]; rowIndex: number }) {
  const delay = { animationDelay: `${rowIndex * ROW_STAGGER_MS}ms` };
  return (
    <>
      <span
        className={cn(LABEL, LABEL_SIZE, "animate-fade-in pr-[clamp(4px,0.6vw,10px)] text-right tabular-nums")}
        style={delay}
      >
        {label}
      </span>
      {row.map((cell, ci) => {
        const { face, lip } = LENS_LEVEL[cell.level];
        return (
          <span
            key={ci}
            className="animate-fade-in flex h-[clamp(16px,1.8vw,28px)] w-[clamp(30px,3.6vw,54px)] items-center justify-center overflow-hidden rounded-[2px] px-[2px]"
            style={{ background: face, boxShadow: `0 ${CELL_LIP} 0 0 ${lip}`, ...delay }}
          >
            <span className="truncate font-mono text-[clamp(7px,0.78vw,12px)] leading-none text-[#3a2a2a]">
              {cell.token}
            </span>
          </span>
        );
      })}
    </>
  );
}

// ── 1. Attention Analysis — 5×5 lower-triangular grid ─────────────────────────
// strength → {face, lip}: off-white (weak) through light yellow (medium) to the
// technique's own button yellow (strong) — see ATTN_LEVELS in techniqueFigureData.
const ATTN_FACE: Record<"weak" | "medium" | "strong", { face: string; lip: string }> = {
  weak: ATTN_LEVELS[0], medium: ATTN_LEVELS[1], strong: ATTN_LEVELS[2],
};
const ATTN_EMPTY_LIP = "#c4c3bc";

function AttentionFigure() {
  return (
    <FigureBox className="flex-col items-stretch">
      {/* "darker = more attention" legend */}
      <span className={cn(LABEL, "mb-[clamp(6px,0.8vw,12px)] self-start text-[clamp(8px,0.8vw,13px)]")}>
        darker = more attention
      </span>
      <div
        className="grid items-center gap-x-[clamp(5px,0.55vw,8px)] gap-y-[clamp(6px,0.7vw,11px)]"
        style={{ gridTemplateColumns: "auto repeat(5, minmax(0, 1fr))" }}
      >
        {ATTN_GRID.map((row, r) => (
          <AttnRow key={r} token={ATTN_TOKENS[r]} row={row} />
        ))}
        {/* bottom axis: blank corner + column (key) token labels */}
        <span />
        {ATTN_TOKENS.map((t, i) => (
          <span key={`b${i}`} className={cn(LABEL, "pt-[clamp(2px,0.4vw,6px)] text-center text-[clamp(8px,0.8vw,13px)]")}>
            {t}
          </span>
        ))}
      </div>
      {/* axis cues */}
      <span className={cn(LABEL, "mt-[clamp(5px,0.7vw,10px)] self-end text-[clamp(8px,0.8vw,13px)]")}>
        query ↓ &nbsp; key →
      </span>
    </FigureBox>
  );
}

function AttnRow({ token, row }: { token: string; row: AttnStrength[] }) {
  return (
    <>
      <span className={cn(LABEL, LABEL_SIZE, "pr-[clamp(4px,0.6vw,10px)] text-right")}>{token}</span>
      {row.map((strength, cKey) => {
        const filled = strength !== "";
        const color = filled ? ATTN_FACE[strength] : null;
        return (
          <span
            key={cKey}
            className="aspect-square w-[clamp(26px,2.9vw,38px)] rounded-[2px]"
            style={{
              background: color ? color.face : "#ffffff",
              boxShadow: `0 ${ATTN_CELL_LIP} 0 0 ${color ? color.lip : ATTN_EMPTY_LIP}`,
            }}
          />
        );
      })}
    </>
  );
}

// ── Shared horizontal bar (face + darker bottom lip) ──────────────────────────
function useRevealed(): boolean {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return revealed;
}

function Bar({ len, face, lip, delayMs = 0 }: { len: number; face: string; lip: string; delayMs?: number }) {
  const revealed = useRevealed();
  return (
    <div
      className="h-[clamp(15px,1.8vw,30px)] rounded-[2px] transition-[width] duration-500 ease-out motion-reduce:transition-none"
      style={{
        width: `${(revealed ? len : 0) * 100}%`,
        background: face,
        boxShadow: `0 ${BAR_LIP} 0 0 ${lip}`,
        transitionDelay: `${delayMs}ms`,
      }}
    />
  );
}

// ── 2. Direct Logit Attribution — per-layer divergent bars (8× stride) ─────────
const DLA_FACE = { pos: DLA_LEVELS[3].face, neg: DLA_LEVELS[1].face } as const;
const DLA_LIP = { pos: DLA_LEVELS[3].lip, neg: DLA_LEVELS[1].lip } as const;

function DlaFigure() {
  return (
    <FigureBox>
      <div className="flex w-[clamp(210px,26vw,320px)] flex-col gap-[clamp(9px,1.1vw,18px)]">
        {DLA_BARS.map((b, i) => {
          const neg = b.signed < 0;
          const len = Math.abs(b.signed);
          const kind = neg ? "neg" : "pos";
          return (
            <div key={i} className="flex w-full items-center gap-[clamp(6px,0.8vw,12px)]">
              <span className={cn(LABEL, LABEL_SIZE, "w-[clamp(22px,2.6vw,38px)] shrink-0 text-right tabular-nums")}>
                {b.label}
              </span>
              <div className="flex flex-1 justify-end">
                {neg && <Bar len={len} face={DLA_FACE[kind]} lip={DLA_LIP[kind]} delayMs={i * 90} />}
              </div>
              <div className="flex flex-1 justify-start">
                {!neg && <Bar len={len} face={DLA_FACE[kind]} lip={DLA_LIP[kind]} delayMs={i * 90} />}
              </div>
            </div>
          );
        })}
        <div className="mt-[clamp(3px,0.6vw,9px)] flex w-full">
          <span className="w-[clamp(22px,2.6vw,38px)] shrink-0" />
          <span className={cn(LABEL, LABEL_SIZE, "flex-1 pr-2 text-right")}>neg</span>
          <span className={cn(LABEL, LABEL_SIZE, "flex-1 pl-2 text-left")}>pos</span>
        </div>
      </div>
    </FigureBox>
  );
}

// ── 3. Patching — grouped predict / actual pairs per component ─────────────────
const PATCH_FACE = { predict: PATCH_LEVELS[3].face, actual: PATCH_LEVELS[1].face } as const;
const PATCH_LIP = { predict: PATCH_LEVELS[3].lip, actual: PATCH_LEVELS[1].lip } as const;

function PatchingFigure() {
  return (
    <FigureBox>
      <div className="flex w-[clamp(210px,26vw,320px)] flex-col gap-[clamp(11px,1.4vw,22px)]">
        {PATCH_PAIRS.map((p, i) => (
          <div key={p.label} className="flex flex-col gap-[clamp(3px,0.5vw,7px)]">
            <span className={cn(LABEL, LABEL_SIZE, "tabular-nums")}>{p.label}</span>
            <Bar len={p.predict} face={PATCH_FACE.predict} lip={PATCH_LIP.predict} delayMs={i * 110} />
            <Bar len={p.actual} face={PATCH_FACE.actual} lip={PATCH_LIP.actual} delayMs={i * 110} />
          </div>
        ))}
        <span className={cn(LABEL, LABEL_SIZE, "mt-[clamp(2px,0.4vw,6px)]")}>dark = predict, light = actual</span>
      </div>
    </FigureBox>
  );
}

// ── 4. Steering — single example, cycling library → Gollum → Seattle ──────────
const STEER_INTERVAL_MS = 3400;

function SteeringFigure() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % STEERING_EXAMPLES.length), STEER_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
  const ex = STEERING_EXAMPLES[i];
  const body = "font-mono text-[clamp(11px,1vw,16px)] leading-[1.45] text-foreground";

  return (
    <FigureBox className="items-start">
      {/* key={i} replays the fade on each swap */}
      <div key={i} className="animate-fade-in flex w-[clamp(220px,26vw,320px)] flex-col gap-[clamp(4px,0.7vw,10px)]">
        <span className={cn(LABEL, LABEL_SIZE)}>question</span>
        <p className={cn(body, "m-0")}>{ex.question}</p>
        <div className="my-[clamp(2px,0.5vw,8px)] h-px w-3/5 bg-surface-border" />

        <span
          className="self-start rounded-[4px] bg-[#d9d9d9] px-[0.6em] py-[0.3em] font-mono text-[clamp(9px,0.9vw,14px)] leading-none text-[#555]"
          style={{ boxShadow: "0 3px 0 0 #b9b9b9" }}
        >
          base
        </span>
        <p className={cn(body, "m-0")}>{ex.base}</p>

        <span
          className="tactile mt-[clamp(2px,0.4vw,6px)] self-start"
          style={{ "--depth": "4px", "--tactile-side": "#5e286b" } as CSSProperties}
        >
          <span className="tactile__base rounded-[4px]" aria-hidden="true" />
          <span
            className="tactile__face rounded-[4px] px-[0.6em] py-[0.3em] font-mono text-[clamp(9px,0.9vw,14px)] leading-none text-white"
            style={{ background: "#7e5987" }}
          >
            steered
          </span>
        </span>
        <p className={cn(body, "m-0")}>{ex.steered}</p>
      </div>
    </FigureBox>
  );
}

export const TECHNIQUE_FIGURES = [
  LensFigure,
  AttentionFigure,
  DlaFigure,
  PatchingFigure,
  SteeringFigure,
] as const;
