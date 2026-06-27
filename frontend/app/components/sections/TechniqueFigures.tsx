"use client";

import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import { cn } from "../../lib/cn";
import { STEERING_EXAMPLES } from "./techniqueCardData";
import {
  BAR_LIP, CELL_LIP, ATTN_CELL_LIP,
  LENS_COLS, LENS_ROWS, LENS_GRID, type LensCell,
  ATTN_TOKENS, ATTN_GRID, type AttnStrength,
  DLA_BARS,
} from "./techniqueFigureData";

// The five decorative figures that sit in the left column of each technique card
// (Figma nodes 134-2/3/5/6/7). These are static, on-brand recreations built from
// flex/grid + clamp() — NOT the real data-driven workbench visualizations — so
// they scale with the modal at any width. Palettes are transcribed verbatim from
// the mock (one-off decorative colors, intentionally literal, matching the
// `techniqueBars.ts` precedent). `TECHNIQUE_FIGURES` is indexed parallel to
// TECHNIQUES / TECHNIQUE_CARDS.
//
// Depth: every cell/bar sits on a darker bottom "lip" via a non-blurred offset
// drop shadow (`0 Npx 0 0 lip`) — the same extruded look as the house tactile
// system, so the graphics read as raised tiles like the Figma mock.

// Shared rounded inner box that frames each figure (Figma's inner panel: same
// surface as the card with a hairline border). `inline-flex` so it hugs its
// content snugly — the card centers it in the figure column.
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
  0: { face: "#efdede", lip: "#e2cccc" },
  1: { face: "#e7b8b8", lip: "#d49f9f" },
  2: { face: "#d88585", lip: "#c06e6e" },
  3: { face: "#c26868", lip: "#a04747" },
};

export function LensFigure() {
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
          <LensRow key={`r${r}`} label={`L${LENS_ROWS[r]}`} row={row} />
        ))}
      </div>
    </FigureBox>
  );
}

function LensRow({ label, row }: { label: string; row: LensCell[] }) {
  return (
    <>
      <span className={cn(LABEL, LABEL_SIZE, "pr-[clamp(4px,0.6vw,10px)] text-right tabular-nums")}>{label}</span>
      {row.map((cell, ci) => {
        const { face, lip } = LENS_LEVEL[cell.level];
        return (
          <span
            key={ci}
            className="flex h-[clamp(16px,1.8vw,28px)] w-[clamp(30px,3.6vw,54px)] items-center justify-center overflow-hidden rounded-[2px] px-[2px]"
            style={{ background: face, boxShadow: `0 ${CELL_LIP} 0 0 ${lip}` }}
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
// strength → {face, lip}: strong = darkest amber, weak = pale amber
const ATTN_FACE: Record<"weak" | "strong", { face: string; lip: string }> = {
  strong: { face: "#86744c", lip: "#4b412a" },
  weak: { face: "#e6d4ac", lip: "#cab07a" },
};
const ATTN_EMPTY_LIP = "#c4c3bc";

export function AttentionFigure() {
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
            className="aspect-square w-[clamp(24px,2.9vw,42px)] rounded-[2px]"
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
function Bar({ len, face, lip }: { len: number; face: string; lip: string }) {
  return (
    <div
      className="h-[clamp(15px,1.8vw,30px)] rounded-[2px]"
      style={{ width: `${len * 100}%`, background: face, boxShadow: `0 ${BAR_LIP} 0 0 ${lip}` }}
    />
  );
}

// ── 2. Direct Logit Attribution — per-layer divergent bars (8× stride) ─────────
const DLA_FACE = { pos: "#739157", neg: "#a2ba8b" } as const;
const DLA_LIP = { pos: "#446327", neg: "#699440" } as const;

export function DlaFigure() {
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
                {neg && <Bar len={len} face={DLA_FACE[kind]} lip={DLA_LIP[kind]} />}
              </div>
              <div className="flex flex-1 justify-start">
                {!neg && <Bar len={len} face={DLA_FACE[kind]} lip={DLA_LIP[kind]} />}
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

// ── 3. Patching — left-aligned bars, alternating predict / actual ─────────────
type PatchBar = { len: number; kind: "predict" | "actual" };
const PATCH_BARS: PatchBar[] = [
  { len: 0.72, kind: "predict" },
  { len: 0.18, kind: "actual" },
  { len: 0.44, kind: "predict" },
  { len: 0.53, kind: "actual" },
  { len: 0.86, kind: "predict" },
  { len: 0.65, kind: "actual" },
];
const PATCH_FACE = { predict: "#7399a6", actual: "#9dc1cd" } as const;
const PATCH_LIP = { predict: "#487c8d", actual: "#6f9aa9" } as const;

export function PatchingFigure() {
  return (
    <FigureBox>
      <div className="flex w-[clamp(205px,25vw,300px)] flex-col gap-[clamp(9px,1.1vw,18px)]">
        {PATCH_BARS.map((b, i) => (
          <Bar key={i} len={b.len} face={PATCH_FACE[b.kind]} lip={PATCH_LIP[b.kind]} />
        ))}
        <span className={cn(LABEL, LABEL_SIZE, "mt-[clamp(3px,0.6vw,9px)]")}>dark = predict, light = actual</span>
      </div>
    </FigureBox>
  );
}

// ── 4. Steering — single example, cycling library → Gollum → Seattle ──────────
const STEER_INTERVAL_MS = 3400;

export function SteeringFigure() {
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

        <span className="self-start rounded-[4px] bg-[#d9d9d9] px-[0.6em] py-[0.3em] font-mono text-[clamp(9px,0.9vw,14px)] leading-none text-[#555]">
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
