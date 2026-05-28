"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { interpolateColor, interpolateColorDivergent } from "../lib/palette";
import { CREDIT_PACKS } from "../lib/rates";
import WaveformLayers from "./WaveformLayers";

type Tab = "techniques" | "inference" | "pricing";

const TAB_ORDER: Tab[] = ["techniques", "inference", "pricing"];

// ─── Motifs ────────────────────────────────────────────────────────────────

function MiniHeatmap() {
  const probs = [
    [0.08, 0.15, 0.22, 0.18],
    [0.22, 0.42, 0.55, 0.38],
    [0.44, 0.68, 0.77, 0.61],
    [0.62, 0.88, 0.93, 0.84],
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {probs.map((row, y) => (
        <div key={y} style={{ display: "flex", gap: 2 }}>
          {row.map((p, x) => (
            <div
              key={x}
              style={{
                width: 12,
                height: 8,
                borderRadius: 1,
                backgroundColor: interpolateColor("warm-mono", p),
              }}
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
    [0.72, 0.14, 0.09, 0.05],
    [0.18, 0.61, 0.14, 0.07],
    [0.07, 0.24, 0.53, 0.16],
    [0.04, 0.10, 0.31, 0.55],
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {weights.map((row, y) => (
        <div key={y} style={{ display: "flex", gap: 2 }}>
          {row.map((w, x) => (
            <div
              key={x}
              style={{
                width: 12,
                height: 12,
                borderRadius: 1,
                backgroundColor: interpolateColor("warm-mono", w),
              }}
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
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {vals.map((v, i) => {
        const color = interpolateColorDivergent("rdbu", v, maxAbs);
        const barW = (Math.abs(v) / maxAbs) * halfW;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ width: halfW, display: "flex", justifyContent: "flex-end" }}>
              {v < 0 && (
                <div style={{ width: barW, height: 5, backgroundColor: color, borderRadius: "2px 0 0 2px" }} />
              )}
            </div>
            <div style={{ width: 1, height: 7, backgroundColor: "var(--color-surface-border)", flexShrink: 0 }} />
            <div style={{ width: halfW }}>
              {v > 0 && (
                <div style={{ width: barW, height: 5, backgroundColor: color, borderRadius: "0 2px 2px 0" }} />
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
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ width: r.attr * 68, height: 4, borderRadius: 1, backgroundColor: amber }} />
          <div style={{ width: r.effect * 68, height: 4, borderRadius: 1, backgroundColor: green }} />
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 1 }}>
        {([{ color: amber, label: "pred" }, { color: green, label: "actual" }] as const).map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <div style={{ width: 8, height: 3, borderRadius: 1, backgroundColor: color }} />
            <span style={{ fontSize: 7, color: "var(--color-text-muted)", fontFamily: "var(--font-azeret-mono), monospace" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniSteeringMotif() {
  const amber = "rgba(175,118,32,0.75)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {[
        { label: "base", tokens: ["Mary", "gave"], highlight: false },
        { label: "strd", tokens: ["John", "took"], highlight: true },
      ].map(({ label, tokens, highlight }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 6, width: 22, flexShrink: 0, color: "var(--color-text-muted)", fontFamily: "var(--font-azeret-mono), monospace" }}>
            {label}
          </span>
          <div style={{ display: "flex", gap: 2 }}>
            {tokens.map((t, i) => (
              <div
                key={i}
                style={{
                  fontSize: 6,
                  padding: "1px 3px",
                  border: `1px solid ${highlight ? amber : "var(--color-surface-border)"}`,
                  borderRadius: 2,
                  fontFamily: "var(--font-azeret-mono), monospace",
                  color: highlight ? "var(--color-text)" : "var(--color-text-muted)",
                  backgroundColor: highlight ? "rgba(175,118,32,0.08)" : "transparent",
                }}
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
      "Reads the residual stream at each layer, projects it through the unembedding matrix, and shows the resulting probability distribution as a heatmap. Each row is one layer's best guess at the next token. Per-layer entropy is also computed from these projections and available as a separate heatmap.",
    motif: <MiniHeatmap />,
  },
  {
    name: "attention patterns",
    description:
      "Shows the attention weight matrix for each head at each layer — which source positions each destination token attends to. Useful for identifying induction heads, copy heads, and other head-level specialisation.",
    motif: <MiniAttnGrid />,
  },
  {
    name: "direct logit attribution",
    description:
      "Decomposes the final token logit into additive contributions from each attention head and MLP sub-layer. Positive values push the model toward a target token; negative values suppress it.",
    motif: <MiniDlaBars />,
  },
  {
    name: "attribution & activation patching",
    description:
      "Attribution uses backward-pass gradients to rank each attention head and MLP by how much they influence a target token's logit. Activation patching then tests those rankings causally: activations from a clean run are substituted into a corrupted run, and the resulting logit change is compared against the predicted score.",
    motif: <MiniPatchBars />,
  },
  {
    name: "steering",
    description:
      "Computes a difference-in-means direction from paired prompts and injects it into the residual stream at chosen layers to shift model generation. Injection strength is tunable after the initial run.",
    motif: <MiniSteeringMotif />,
  },
];

const GPU_TIERS = [
  { tier: "L4",        range: "< 4B params",    microsPerSec: 190  },
  { tier: "L40S",      range: "4–10B params",   microsPerSec: 530  },
  { tier: "A100-80GB", range: "10–25B params",  microsPerSec: 760  },
  { tier: "H200",      range: "25–70B params",  microsPerSec: 1550 },
];

// ─── Root ──────────────────────────────────────────────────────────────────

export default function HeroContent() {
  const [tab, setTab] = useState<Tab>("techniques");
  const tabIndex = TAB_ORDER.indexOf(tab);

  return (
    <main
      style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: "1fr 2.5fr",
        overflow: "hidden",
      }}
    >
      {/* ── Left rail ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 36px 0 52px",
          borderRight: "1px solid var(--color-surface-border)",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-azeret-mono), monospace",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--color-text-muted)",
            margin: "0 0 16px",
          }}
        >
          doppo
        </p>

        <h1
          style={{
            fontFamily: "var(--font-azeret-mono), monospace",
            fontSize: "clamp(15px, 1.3vw, 20px)",
            fontWeight: 500,
            lineHeight: 1.6,
            letterSpacing: "-0.01em",
            color: "var(--color-text)",
            margin: "0 0 18px",
          }}
        >
          No-code mechanistic interpretability for transformer models on HuggingFace.
        </h1>

        <p
          style={{
            fontFamily: "var(--font-azeret-mono), monospace",
            fontSize: 11,
            lineHeight: 1.85,
            color: "var(--color-text-muted)",
            margin: "0 0 28px",
          }}
        >
          Run logit lens, attribution, and steering on any model from HuggingFace Hub.
          No environment setup, no notebook.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 40 }}>
          <Link
            href="/tutorial"
            className="btn-accent"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 16px",
              borderRadius: 6,
              fontFamily: "var(--font-azeret-mono), monospace",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.02em",
              textDecoration: "none",
            }}
          >
            <span aria-hidden>→</span> Interactive walkthrough
          </Link>
          <Link
            href="/projects"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "9px 16px",
              borderRadius: 6,
              fontFamily: "var(--font-azeret-mono), monospace",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.02em",
              textDecoration: "none",
              color: "var(--color-text)",
              border: "1px solid var(--color-surface-border)",
            }}
          >
            Projects
          </Link>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 7,
            paddingTop: 20,
            borderTop: "1px solid var(--color-surface-border)",
          }}
        >
          {["TransformerLens 3.0", "Any HF model", "GPU-accelerated", "Saved projects"].map((tag) => (
            <span
              key={tag}
              style={{
                fontFamily: "var(--font-azeret-mono), monospace",
                fontSize: 10,
                color: "var(--color-text-muted)",
                letterSpacing: "0.04em",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Waveform */}
        <div
          style={{
            flex: "0 0 38%",
            borderBottom: "1px solid var(--color-surface-border)",
            overflow: "hidden",
          }}
        >
          <WaveformLayers />
        </div>

        {/* Tabs + content */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "24px 44px",
            overflow: "hidden",
          }}
        >
          {/* Tab strip */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid var(--color-surface-border)",
              marginBottom: 20,
              flexShrink: 0,
            }}
          >
            {TAB_ORDER.map((t) => {
              const isActive = tab === t;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    fontFamily: "var(--font-azeret-mono), monospace",
                    fontSize: 10,
                    letterSpacing: "0.06em",
                    color: isActive ? "var(--color-text)" : "var(--color-text-muted)",
                    background: "none",
                    border: "none",
                    borderBottom: "2px solid transparent",
                    padding: "0 0 10px",
                    marginBottom: -1,
                    marginRight: 24,
                    cursor: "pointer",
                    transition: "color 180ms ease",
                    position: "relative",
                  }}
                >
                  {t}
                  <span
                    style={{
                      position: "absolute",
                      bottom: -1,
                      left: 0,
                      right: 0,
                      height: 1,
                      background: "var(--color-text)",
                      transform: isActive ? "scaleX(1)" : "scaleX(0)",
                      transformOrigin: "left center",
                      transition: "transform 220ms cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                  />
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div
            style={{
              flex: 1,
              overflow: "hidden",
              position: "relative",
              background: "var(--color-card)",
              border: "1px solid var(--color-card-border)",
              borderRadius: 10,
            }}
          >
            {TAB_ORDER.map((t) => {
              const isActive = tab === t;
              const dir = TAB_ORDER.indexOf(t) - tabIndex;
              return (
                <div
                  key={t}
                  style={{
                    position: "absolute",
                    inset: 0,
                    overflow: "hidden",
                    padding: "18px 20px",
                    opacity: isActive ? 1 : 0,
                    transform: isActive
                      ? "translateY(0px)"
                      : dir > 0
                      ? "translateY(6px)"
                      : "translateY(-6px)",
                    transition: "opacity 220ms ease, transform 220ms cubic-bezier(0.4, 0, 0.2, 1)",
                    pointerEvents: isActive ? "auto" : "none",
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
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {TECHNIQUES.map((t, i) => (
          <div
            key={t.name}
            style={{
              display: "flex",
              gap: 16,
              padding: "13px 0",
              borderBottom: i < TECHNIQUES.length - 1 ? "1px solid var(--color-surface-border)" : "none",
              alignItems: "stretch",
              flex: "1 1 0",
            }}
          >
            <div style={{ width: 82, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {t.motif}
            </div>
            <div>
              <p
                style={{
                  fontFamily: "var(--font-azeret-mono), monospace",
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  color: "var(--color-text)",
                  margin: "0 0 5px",
                }}
              >
                {t.name}
              </p>
              <p
                style={{
                  fontFamily: "var(--font-azeret-mono), monospace",
                  fontSize: 10,
                  lineHeight: 1.7,
                  color: "var(--color-text-muted)",
                  margin: 0,
                }}
              >
                {t.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Inference tab ─────────────────────────────────────────────────────────

function InferenceTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26, height: "100%", overflow: "hidden" }}>
      <div>
        <SectionLabel>GPU tiers</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {GPU_TIERS.map((tier) => (
            <div key={tier.tier} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ width: 96, fontFamily: "var(--font-azeret-mono), monospace", fontSize: 11, color: "var(--color-text)", fontWeight: 500 }}>
                {tier.tier}
              </div>
              <div style={{ flex: 1, fontFamily: "var(--font-azeret-mono), monospace", fontSize: 10, color: "var(--color-text-muted)" }}>
                {tier.range}
              </div>
              <div style={{ fontFamily: "var(--font-azeret-mono), monospace", fontSize: 10, color: "var(--color-text-muted)" }}>
                ${(tier.microsPerSec / 1_000_000).toFixed(6)}/sec
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Infrastructure</SectionLabel>
        <FactList items={[
          ["Runtime",    "Modal serverless — billed per second of GPU compute, no idle cost"],
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
    <div style={{ display: "flex", flexDirection: "column", gap: 26, height: "100%", overflow: "hidden" }}>
      <div>
        <SectionLabel>Free tier</SectionLabel>
        <p style={{ fontFamily: "var(--font-azeret-mono), monospace", fontSize: 11, color: "var(--color-text)", lineHeight: 1.75, margin: "0 0 8px" }}>
          Every account receives $1.00 in GPU credits each month, automatically. No payment method required to get started.
        </p>
        <p style={{ fontFamily: "var(--font-azeret-mono), monospace", fontSize: 10, color: "var(--color-text-muted)", lineHeight: 1.7, margin: 0 }}>
          On the L4 tier (GPT-2–scale models), $1.00 covers roughly 87 minutes of active inference time.
        </p>
      </div>

      <div>
        <SectionLabel>Credit packs</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {CREDIT_PACKS.map((pack) => (
            <div key={pack.label} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ width: 48, fontFamily: "var(--font-azeret-mono), monospace", fontSize: 11, color: "var(--color-text)" }}>
                {pack.label}
              </div>
              <div style={{ flex: 1, fontFamily: "var(--font-azeret-mono), monospace", fontSize: 10, color: "var(--color-text-muted)" }}>
                ${(pack.creditMicros / 1_000_000).toFixed(2)} in GPU credit
              </div>
              <div style={{ fontFamily: "var(--font-azeret-mono), monospace", fontSize: 10, color: "var(--color-text-muted)" }}>
                ${(pack.chargeCents / 100).toFixed(2)} charged
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontFamily: "var(--font-azeret-mono), monospace", fontSize: 9, color: "var(--color-text-muted)", opacity: 0.65, margin: "12px 0 0", lineHeight: 1.6 }}>
          The difference between credit value and charge is Stripe's processing fee.
          GPU compute is priced at Modal serverless rates with no additional markup.
        </p>
      </div>

      <div>
        <SectionLabel>How billing works</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            "Credits are deducted per second of GPU compute at the rate for your model's tier.",
            "Cached analyses (logit lens, DLA, attribution) don't consume credits on repeat runs with the same model and prompt.",
            "Activation patching and steering are not cached — each run is billed separately.",
          ].map((line, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontFamily: "var(--font-azeret-mono), monospace", fontSize: 9, color: "var(--color-text-muted)", opacity: 0.4, paddingTop: 2, flexShrink: 0 }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <p style={{ fontFamily: "var(--font-azeret-mono), monospace", fontSize: 10, color: "var(--color-text)", lineHeight: 1.65, margin: 0 }}>
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
    <p
      style={{
        fontFamily: "var(--font-azeret-mono), monospace",
        fontSize: 9,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--color-text-muted)",
        margin: "0 0 11px",
      }}
    >
      {children}
    </p>
  );
}

function FactList({ items }: { items: [string, string][] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map(([label, value]) => (
        <div key={label} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div
            style={{
              width: 76,
              flexShrink: 0,
              fontFamily: "var(--font-azeret-mono), monospace",
              fontSize: 9,
              color: "var(--color-text-muted)",
              letterSpacing: "0.04em",
              paddingTop: 1,
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontFamily: "var(--font-azeret-mono), monospace",
              fontSize: 10,
              color: "var(--color-text)",
              lineHeight: 1.65,
            }}
          >
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}
