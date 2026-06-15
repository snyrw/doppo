"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "../lib/auth-client";
import { cn } from "../lib/cn";
import { interpolateColor, interpolateColorDivergent } from "../lib/palette";
import { CREDIT_PACKS, TIER_RATES_MICROS_PER_SEC } from "../lib/rates";
import WaveformLayers from "./WaveformLayers";

type Tab = "techniques" | "inference" | "pricing";

const TAB_ORDER: Tab[] = ["techniques", "inference", "pricing"];

// Repeated responsive type scales (static — clamp values port to arbitrary utilities).
const TXT_BODY = "text-[clamp(9px,0.7vw,13px)]";
const TXT_SMALL = "text-[clamp(8px,0.6vw,11px)]";
const TXT_EMPH = "text-[clamp(10px,0.78vw,14px)]";

// ─── Motifs ────────────────────────────────────────────────────────────────

function MiniHeatmap() {
  const probs = [
    [0.08, 0.15, 0.22, 0.18],
    [0.22, 0.42, 0.55, 0.38],
    [0.44, 0.68, 0.77, 0.61],
    [0.62, 0.88, 0.93, 0.84],
  ];
  return (
    <div className="flex flex-col gap-0.5">
      {probs.map((row, y) => (
        <div key={y} className="flex gap-0.5">
          {row.map((p, x) => (
            <div
              key={x}
              className="h-2 w-3 rounded-[1px]"
              style={{ backgroundColor: interpolateColor("warm-mono", p) }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function MiniAttnGrid() {
  // Causal attention weights — diagonal-heavy, realistic for self-attention
  const weights = [
    [0.72, 0.00, 0.00, 0.00],
    [0.68, 0.61, 0.00, 0.00],
    [0.52, 0.24, 0.53, 0.00],
    [0.60, 0.10, 0.31, 0.55],
  ];
  return (
    <div className="flex flex-col gap-0.5">
      {weights.map((row, y) => (
        <div key={y} className="flex gap-0.5">
          {row.map((w, x) => (
            <div
              key={x}
              className="h-3 w-3 rounded-[1px]"
              style={{ backgroundColor: interpolateColor("warm-mono", w) }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function MiniDlaBars() {
  const vals = [0.31, -0.42, 0.94, -0.28, 1.42, -0.51];
  const maxAbs = 1.6;
  const halfW = 36;
  return (
    <div className="flex flex-col gap-[3px]">
      {vals.map((v, i) => {
        const color = interpolateColorDivergent("rdbu", v, maxAbs);
        const barW = (Math.abs(v) / maxAbs) * halfW;
        return (
          <div key={i} className="flex items-center">
            <div className="flex w-9 justify-end">
              {v < 0 && (
                <div className="h-[5px] rounded-l-[2px]" style={{ width: barW, backgroundColor: color }} />
              )}
            </div>
            <div className="h-[7px] w-px shrink-0 bg-surface-border" />
            <div className="w-9">
              {v > 0 && (
                <div className="h-[5px] rounded-r-[2px]" style={{ width: barW, backgroundColor: color }} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MiniPatchBars() {
  const amber = "rgba(175,118,32,0.75)";
  const green = "#4a9e6b";
  const rows = [
    { attr: 0.85, effect: 0.81 },
    { attr: 0.72, effect: 0.68 },
    { attr: 0.61, effect: 0.13 },
  ];
  return (
    <div className="flex flex-col gap-[5px]">
      {rows.map((r, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          <div className="h-1 rounded-[1px]" style={{ width: r.attr * 68, backgroundColor: amber }} />
          <div className="h-1 rounded-[1px]" style={{ width: r.effect * 68, backgroundColor: green }} />
        </div>
      ))}
      <div className="mt-px flex gap-2">
        {([{ color: amber, label: "pred" }, { color: green, label: "actual" }] as const).map(({ color, label }) => (
          <div key={label} className="flex items-center gap-[3px]">
            <div className="h-[3px] w-2 rounded-[1px]" style={{ backgroundColor: color }} />
            <span className="text-[7px] text-muted">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniSteeringMotif() {
  return (
    <div className="flex flex-col gap-[5px]">
      {[
        { label: "base", tokens: ["Mary", "gave"], highlight: false },
        { label: "strd", tokens: ["John", "took"], highlight: true },
      ].map(({ label, tokens, highlight }) => (
        <div key={label} className="flex items-center gap-1">
          <span className="w-[22px] shrink-0 text-[6px] text-muted">
            {label}
          </span>
          <div className="flex gap-0.5">
            {tokens.map((t, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-[2px] border px-[3px] py-px text-[6px]",
                  highlight
                    ? "border-[rgba(175,118,32,0.75)] bg-[rgba(175,118,32,0.08)] text-foreground"
                    : "border-surface-border bg-transparent text-muted",
                )}
              >
                {t}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────

const TECHNIQUES: { name: string; description: string; motif: ReactNode }[] = [
  {
    name: "logit lens",
    description:
      "Projects each layer's residual stream through the unembedding matrix — each row is one layer's probability distribution over the vocabulary, shown as a heatmap.",
    motif: <MiniHeatmap />,
  },
  {
    name: "attention patterns",
    description:
      "Shows the attention weight matrix for each head at each layer — which source positions each destination token attends to.",
    motif: <MiniAttnGrid />,
  },
  {
    name: "direct logit attribution",
    description:
      "Decomposes the final-token logit into signed additive contributions from each attention head and MLP layer.",
    motif: <MiniDlaBars />,
  },
  {
    name: "attribution & activation patching",
    description:
      "Gradient attribution ranks components by influence; activation patching verifies those rankings causally by substituting activations from a clean run into a corrupted one.",
    motif: <MiniPatchBars />,
  },
  {
    name: "steering",
    description:
      "Computes a difference-in-means direction from paired prompts and injects it into the residual stream at chosen layers to shift generation.",
    motif: <MiniSteeringMotif />,
  },
];

const GPU_TIERS = [
  { tier: "L4",        range: "< 4B params",    microsPerSec: TIER_RATES_MICROS_PER_SEC.tl_small   },
  { tier: "L40S",      range: "4–10B params",   microsPerSec: TIER_RATES_MICROS_PER_SEC.tl_medium  },
  { tier: "A100-80GB", range: "10–25B params",  microsPerSec: TIER_RATES_MICROS_PER_SEC.tl_large   },
  { tier: "H200",      range: "25–69B params",  microsPerSec: TIER_RATES_MICROS_PER_SEC.tl_xlarge  },
  { tier: "B200",      range: "70B–100B params", microsPerSec: TIER_RATES_MICROS_PER_SEC.tl_xxlarge },
];

// ─── Root ──────────────────────────────────────────────────────────────────

export default function HeroContent() {
  const [tab, setTab] = useState<Tab>("techniques");
  const router = useRouter();
  const { data: session } = useSession();
  const tabIndex = TAB_ORDER.indexOf(tab);

  return (
    <main className="grid flex-1 grid-cols-[1fr_2.5fr] overflow-hidden">
      {/* ── Left rail ── */}
      <div className="flex flex-col justify-center border-r border-surface-border pr-[clamp(24px,2.5vw,56px)] pl-[clamp(28px,3.5vw,72px)]">
        <p className="m-0 mb-[clamp(12px,1.1vw,22px)] text-[clamp(9px,0.65vw,13px)] font-semibold uppercase tracking-[0.1em] text-muted">
          doppo
        </p>

        <h1 className="m-0 mb-[clamp(14px,1.2vw,24px)] text-[clamp(14px,1.3vw,24px)] font-medium leading-[1.6] tracking-[-0.01em] text-foreground">
          A no-code mechanistic interpretability sandbox on TransformerLens models up to 100B parameters.
        </h1>

        <p className="m-0 mb-[clamp(20px,1.8vw,36px)] text-[clamp(10px,0.8vw,15px)] leading-[1.85] text-muted">
          Run logit lens, attention analysis, patching, and steering on thousands of compatible models.
          Compute, environment set-up, and visualization are handled by us.
        </p>

        <div className="mb-[clamp(28px,2.8vw,56px)] flex flex-col gap-[clamp(6px,0.5vw,10px)]">
          <button
            className="btn-accent inline-flex cursor-pointer items-center rounded-md border-none px-[clamp(12px,1.1vw,22px)] py-[clamp(7px,0.65vw,12px)] text-[clamp(10px,0.8vw,14px)] font-medium tracking-[0.02em]"
            onClick={() => {
              if (session?.user) {
                router.push("/projects");
              } else {
                window.dispatchEvent(new CustomEvent("doppo:open-auth", { detail: { mode: "signup" } }));
              }
            }}
          >
            Projects
          </button>
          <Link
            href="/tutorial"
            className="inline-flex items-center rounded-md border border-surface-border px-[clamp(12px,1.1vw,22px)] py-[clamp(7px,0.65vw,12px)] text-[clamp(10px,0.8vw,14px)] font-medium tracking-[0.02em] text-foreground no-underline"
          >
            Tutorial
          </Link>
        </div>

        <div className="flex flex-col gap-[clamp(5px,0.5vw,9px)] border-t border-surface-border pt-[clamp(14px,1.4vw,28px)]">
          {["TransformerLens 3.0", "On-demand compute", "Saved projects", "Easily shareable results"].map((tag) => (
            <span key={tag} className="text-[clamp(9px,0.65vw,13px)] tracking-[0.04em] text-muted">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="relative overflow-hidden">
        {/* Waveform — fills entire right panel as background */}
        <div className="absolute inset-0">
          <WaveformLayers />
        </div>

        {/* Floating tab card */}
        <div
          className="absolute left-1/2 top-1/2 flex h-[72%] w-4/5 flex-col overflow-hidden rounded-xl border border-card-border px-[clamp(20px,2.4vw,48px)] py-[clamp(16px,1.8vw,32px)]"
          style={{
            transform: "translate(-50%, -50%)",
            background: "color-mix(in srgb, var(--card) 90%, transparent)",
            boxShadow: "0 8px 48px rgba(0,0,0,0.14), 0 2px 12px rgba(0,0,0,0.08)",
          }}
        >
          {/* Tab strip */}
          <div className="mb-[clamp(14px,1.4vw,28px)] flex shrink-0 border-b border-surface-border">
            {TAB_ORDER.map((t) => {
              const isActive = tab === t;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "relative -mb-px mr-[clamp(16px,1.8vw,36px)] cursor-pointer border-none border-b-2 border-b-transparent bg-transparent pb-[clamp(8px,0.75vw,14px)] text-[clamp(9px,0.65vw,12px)] tracking-[0.06em] transition-colors duration-[180ms]",
                    isActive ? "text-foreground" : "text-muted",
                  )}
                >
                  {t}
                  <span
                    className="absolute -bottom-px left-0 right-0 h-px origin-left bg-[var(--text)] transition-transform duration-[220ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
                    style={{ transform: isActive ? "scaleX(1)" : "scaleX(0)" }}
                  />
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="relative flex-1 overflow-hidden">
            {TAB_ORDER.map((t) => {
              const isActive = tab === t;
              const dir = TAB_ORDER.indexOf(t) - tabIndex;
              return (
                <div
                  key={t}
                  className={cn(
                    "absolute inset-0 overflow-y-auto transition-[opacity,transform] duration-[220ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
                    isActive ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
                  )}
                  style={{
                    transform: isActive
                      ? "translateY(0px)"
                      : dir > 0
                      ? "translateY(6px)"
                      : "translateY(-6px)",
                  }}
                >
                  {t === "techniques" && <TechniquesTab />}
                  {t === "inference"  && <InferenceTab />}
                  {t === "pricing"    && <PricingTab />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}

// ─── Techniques tab ────────────────────────────────────────────────────────

function TechniquesTab() {
  return (
    <div className="flex h-full flex-col justify-between">
      {TECHNIQUES.map((t, i) => (
        <div
          key={t.name}
          className={cn(
            "flex items-center gap-[clamp(10px,1vw,18px)] py-[clamp(6px,0.6vw,12px)]",
            i < TECHNIQUES.length - 1 && "border-b border-surface-border",
          )}
        >
          <div className="flex w-[clamp(60px,5.5vw,100px)] shrink-0 items-center justify-center">
            {t.motif}
          </div>
          <div>
            <p className={cn("m-0 mb-[clamp(3px,0.3vw,6px)] font-semibold tracking-[0.04em] text-foreground", TXT_BODY)}>
              {t.name}
            </p>
            <p className={cn("m-0 leading-[1.55] text-muted", TXT_BODY)}>
              {t.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Inference tab ─────────────────────────────────────────────────────────

function InferenceTab() {
  return (
    <div className="flex h-full flex-col justify-between gap-[clamp(16px,2vw,36px)]">
      <div>
        <SectionLabel>GPU tiers</SectionLabel>
        <div className="flex flex-col gap-[clamp(5px,0.55vw,9px)]">
          {GPU_TIERS.map((tier) => (
            <div key={tier.tier} className="flex items-center">
              <div className={cn("w-[clamp(72px,6.5vw,120px)] font-medium text-foreground", TXT_EMPH)}>
                {tier.tier}
              </div>
              <div className={cn("flex-1 text-muted", TXT_BODY)}>
                {tier.range}
              </div>
              <div className={cn("text-muted", TXT_BODY)}>
                ${(tier.microsPerSec / 1_000_000).toFixed(6)}/sec
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Infrastructure</SectionLabel>
        <FactList items={[
          ["Runtime",    "Modal serverless — billed per second at exactly our GPU + CPU + memory cost, no markup"],
          ["Framework",  "TransformerLens 3.0 running PyTorch 2.6"],
          ["Cold start", "First request loads model weights — expect 30–120s depending on model size"],
          ["Caching",    "Logit lens, DLA, and attribution results are stored; repeat queries on the same model and prompt don't consume credits"],
        ]} />
      </div>

      <div>
        <SectionLabel>Models</SectionLabel>
        <FactList items={[
          ["Scope",     "Any decoder-only transformer on HuggingFace Hub, up to 70B parameters"],
          ["Gated",     "Supported — HuggingFace access token required at run time"],
          ["Discovery", "A curated list of commonly-used models is available; the input also accepts any valid HF model ID directly"],
        ]} />
      </div>
    </div>
  );
}

// ─── Pricing tab ───────────────────────────────────────────────────────────

function PricingTab() {
  return (
    <div className="flex h-full flex-col justify-between gap-[clamp(16px,2vw,36px)]">
      <div>
        <SectionLabel>Free tier</SectionLabel>
        <p className={cn("m-0 mb-[clamp(6px,0.55vw,10px)] leading-[1.75] text-foreground", TXT_EMPH)}>
          Every account receives $1.00 in GPU credits each month, automatically. No payment method required to get started.
        </p>
        <p className={cn("m-0 leading-[1.7] text-muted", TXT_BODY)}>
          On the L4 tier (GPT-2–scale models), $1.00 covers roughly 87 minutes of active inference time.
        </p>
      </div>

      <div>
        <SectionLabel>Credit packs</SectionLabel>
        <div className="flex flex-col gap-[clamp(5px,0.55vw,9px)]">
          {CREDIT_PACKS.map((pack) => (
            <div key={pack.label} className="flex items-center">
              <div className={cn("w-[clamp(36px,3.2vw,60px)] text-foreground", TXT_EMPH)}>
                {pack.label}
              </div>
              <div className={cn("flex-1 text-muted", TXT_BODY)}>
                ${(pack.creditMicros / 1_000_000).toFixed(2)} in GPU credit
              </div>
              <div className={cn("text-muted", TXT_BODY)}>
                ${(pack.chargeCents / 100).toFixed(2)} charged
              </div>
            </div>
          ))}
        </div>
        <p className={cn("m-0 mt-[clamp(8px,0.8vw,14px)] leading-[1.6] text-muted opacity-65", TXT_SMALL)}>
          The difference between credit value and charge is Stripe&apos;s processing fee.
          GPU compute is priced at Modal serverless rates with no additional markup.
        </p>
      </div>

      <div>
        <SectionLabel>How billing works</SectionLabel>
        <div className="flex flex-col gap-[clamp(6px,0.65vw,11px)]">
          {[
            "Credits are deducted per second of GPU compute at the rate for your model's tier.",
            "Cached analyses (logit lens, DLA, attribution) don't consume credits on repeat runs with the same model and prompt.",
            "Activation patching and steering are not cached — each run is billed separately.",
          ].map((line, i) => (
            <div key={i} className="flex items-start gap-[clamp(7px,0.75vw,14px)]">
              <span className={cn("shrink-0 pt-0.5 text-muted opacity-40", TXT_SMALL)}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className={cn("m-0 leading-[1.65] text-foreground", TXT_BODY)}>
                {line}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Shared sub-components ─────────────────────────────────────────────────

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className={cn("m-0 mb-[clamp(8px,0.8vw,14px)] uppercase tracking-[0.08em] text-muted", TXT_SMALL)}>
      {children}
    </p>
  );
}

function FactList({ items }: { items: [string, string][] }) {
  return (
    <div className="flex flex-col gap-[clamp(5px,0.6vw,10px)]">
      {items.map(([label, value]) => (
        <div key={label} className="flex items-start gap-[clamp(8px,1vw,18px)]">
          <div className={cn("w-[clamp(56px,5.5vw,96px)] shrink-0 pt-px tracking-[0.04em] text-muted", TXT_SMALL)}>
            {label}
          </div>
          <div className={cn("leading-[1.65] text-foreground", TXT_BODY)}>
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}
