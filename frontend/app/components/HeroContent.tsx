"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "../lib/auth-client";
import { interpolateColor, interpolateColorDivergent } from "../lib/palette";
import { CREDIT_PACKS, TIER_RATES_MICROS_PER_SEC } from "../lib/rates";
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
    [0.72, 0.00, 0.00, 0.00],
    [0.68, 0.61, 0.00, 0.00],
    [0.52, 0.24, 0.53, 0.00],
    [0.60, 0.10, 0.31, 0.55],
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
            <span style={{ fontSize: 7, color: "var(--color-text-muted)", fontFamily: "var(--font-ibm-plex-sans), sans-serif" }}>{label}</span>
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
          <span style={{ fontSize: 6, width: 22, flexShrink: 0, color: "var(--color-text-muted)", fontFamily: "var(--font-ibm-plex-sans), sans-serif" }}>
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
                  fontFamily: "var(--font-ibm-plex-sans), sans-serif",
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
  { tier: "L4",        range: "< 4B params",   microsPerSec: TIER_RATES_MICROS_PER_SEC.tl_small  },
  { tier: "L40S",      range: "4–10B params",  microsPerSec: TIER_RATES_MICROS_PER_SEC.tl_medium },
  { tier: "A100-80GB", range: "10–25B params", microsPerSec: TIER_RATES_MICROS_PER_SEC.tl_large  },
  { tier: "H200",      range: "25–70B params", microsPerSec: TIER_RATES_MICROS_PER_SEC.tl_xlarge },
];

// ─── Root ──────────────────────────────────────────────────────────────────

export default function HeroContent() {
  const [tab, setTab] = useState<Tab>("techniques");
  const router = useRouter();
  const { data: session } = useSession();
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
          padding: "0 clamp(24px, 2.5vw, 56px) 0 clamp(28px, 3.5vw, 72px)",
          borderRight: "1px solid var(--color-surface-border)",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-ibm-plex-sans), sans-serif",
            fontSize: "clamp(9px, 0.65vw, 13px)",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--color-text-muted)",
            margin: "0 0 clamp(12px, 1.1vw, 22px)",
          }}
        >
          doppo
        </p>

        <h1
          style={{
            fontFamily: "var(--font-ibm-plex-sans), sans-serif",
            fontSize: "clamp(14px, 1.3vw, 24px)",
            fontWeight: 500,
            lineHeight: 1.6,
            letterSpacing: "-0.01em",
            color: "var(--color-text)",
            margin: "0 0 clamp(14px, 1.2vw, 24px)",
          }}
        >
          No-code mechanistic interpretability for transformer models on HuggingFace.
        </h1>

        <p
          style={{
            fontFamily: "var(--font-ibm-plex-sans), sans-serif",
            fontSize: "clamp(10px, 0.8vw, 15px)",
            lineHeight: 1.85,
            color: "var(--color-text-muted)",
            margin: "0 0 clamp(20px, 1.8vw, 36px)",
          }}
        >
          Run logit lens, attribution, and steering on any model from HuggingFace Hub.
          No environment setup, no notebook.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "clamp(6px, 0.5vw, 10px)", marginBottom: "clamp(28px, 2.8vw, 56px)" }}>
          <button
            className="btn-accent"
            onClick={() => {
              if (session?.user) {
                router.push("/projects");
              } else {
                window.dispatchEvent(new CustomEvent("doppo:open-auth", { detail: { mode: "signup" } }));
              }
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "clamp(7px, 0.65vw, 12px) clamp(12px, 1.1vw, 22px)",
              borderRadius: 6,
              fontFamily: "var(--font-ibm-plex-sans), sans-serif",
              fontSize: "clamp(10px, 0.8vw, 14px)",
              fontWeight: 500,
              letterSpacing: "0.02em",
              border: "none",
              cursor: "pointer",
            }}
          >
            Projects
          </button>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "clamp(7px, 0.65vw, 12px) clamp(12px, 1.1vw, 22px)",
              borderRadius: 6,
              fontFamily: "var(--font-ibm-plex-sans), sans-serif",
              fontSize: "clamp(10px, 0.8vw, 14px)",
              fontWeight: 500,
              letterSpacing: "0.02em",
              color: "var(--color-text-muted)",
              border: "1px solid var(--color-surface-border)",
              cursor: "not-allowed",
              userSelect: "none",
            }}
          >
            Tutorial (coming soon)
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "clamp(5px, 0.5vw, 9px)",
            paddingTop: "clamp(14px, 1.4vw, 28px)",
            borderTop: "1px solid var(--color-surface-border)",
          }}
        >
          {["TransformerLens 3.0", "Any HF model", "GPU-accelerated", "Saved projects"].map((tag) => (
            <span
              key={tag}
              style={{
                fontFamily: "var(--font-ibm-plex-sans), sans-serif",
                fontSize: "clamp(9px, 0.65vw, 13px)",
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
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Waveform — fills entire right panel as background */}
        <div style={{ position: "absolute", inset: 0 }}>
          <WaveformLayers />
        </div>

        {/* Floating tab card */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "80%",
            height: "72%",
            display: "flex",
            flexDirection: "column",
            padding: "clamp(16px, 1.8vw, 32px) clamp(20px, 2.4vw, 48px)",
            background: "color-mix(in srgb, var(--color-card) 90%, transparent)",
            border: "1px solid var(--color-card-border)",
            borderRadius: 12,
            boxShadow: "0 8px 48px rgba(0,0,0,0.14), 0 2px 12px rgba(0,0,0,0.08)",
            overflow: "hidden",
          }}
        >
          {/* Tab strip */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid var(--color-surface-border)",
              marginBottom: "clamp(14px, 1.4vw, 28px)",
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
                    fontFamily: "var(--font-ibm-plex-sans), sans-serif",
                    fontSize: "clamp(9px, 0.65vw, 12px)",
                    letterSpacing: "0.06em",
                    color: isActive ? "var(--color-text)" : "var(--color-text-muted)",
                    background: "none",
                    border: "none",
                    borderBottom: "2px solid transparent",
                    padding: "0 0 clamp(8px, 0.75vw, 14px)",
                    marginBottom: -1,
                    marginRight: "clamp(16px, 1.8vw, 36px)",
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
                    overflowY: "auto",
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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
      {TECHNIQUES.map((t, i) => (
        <div
          key={t.name}
          style={{
            display: "flex",
            gap: "clamp(10px, 1vw, 18px)",
            padding: "clamp(6px, 0.6vw, 12px) 0",
            borderBottom: i < TECHNIQUES.length - 1 ? "1px solid var(--color-surface-border)" : "none",
            alignItems: "center",
          }}
        >
          <div style={{ width: "clamp(60px, 5.5vw, 100px)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {t.motif}
          </div>
          <div>
            <p
              style={{
                fontFamily: "var(--font-ibm-plex-sans), sans-serif",
                fontSize: "clamp(9px, 0.7vw, 13px)",
                fontWeight: 600,
                letterSpacing: "0.04em",
                color: "var(--color-text)",
                margin: "0 0 clamp(3px, 0.3vw, 6px)",
              }}
            >
              {t.name}
            </p>
            <p
              style={{
                fontFamily: "var(--font-ibm-plex-sans), sans-serif",
                fontSize: "clamp(9px, 0.7vw, 13px)",
                lineHeight: 1.55,
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
  );
}

// ─── Inference tab ─────────────────────────────────────────────────────────

function InferenceTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "clamp(16px, 2vw, 36px)", height: "100%", justifyContent: "space-between" }}>
      <div>
        <SectionLabel>GPU tiers</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: "clamp(5px, 0.55vw, 9px)" }}>
          {GPU_TIERS.map((tier) => (
            <div key={tier.tier} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ width: "clamp(72px, 6.5vw, 120px)", fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: "clamp(10px, 0.78vw, 14px)", color: "var(--color-text)", fontWeight: 500 }}>
                {tier.tier}
              </div>
              <div style={{ flex: 1, fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: "clamp(9px, 0.7vw, 13px)", color: "var(--color-text-muted)" }}>
                {tier.range}
              </div>
              <div style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: "clamp(9px, 0.7vw, 13px)", color: "var(--color-text-muted)" }}>
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
    <div style={{ display: "flex", flexDirection: "column", gap: "clamp(16px, 2vw, 36px)", height: "100%", justifyContent: "space-between" }}>
      <div>
        <SectionLabel>Free tier</SectionLabel>
        <p style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: "clamp(10px, 0.78vw, 14px)", color: "var(--color-text)", lineHeight: 1.75, margin: "0 0 clamp(6px, 0.55vw, 10px)" }}>
          Every account receives $1.00 in GPU credits each month, automatically. No payment method required to get started.
        </p>
        <p style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: "clamp(9px, 0.7vw, 13px)", color: "var(--color-text-muted)", lineHeight: 1.7, margin: 0 }}>
          On the L4 tier (GPT-2–scale models), $1.00 covers roughly 87 minutes of active inference time.
        </p>
      </div>

      <div>
        <SectionLabel>Credit packs</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: "clamp(5px, 0.55vw, 9px)" }}>
          {CREDIT_PACKS.map((pack) => (
            <div key={pack.label} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ width: "clamp(36px, 3.2vw, 60px)", fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: "clamp(10px, 0.78vw, 14px)", color: "var(--color-text)" }}>
                {pack.label}
              </div>
              <div style={{ flex: 1, fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: "clamp(9px, 0.7vw, 13px)", color: "var(--color-text-muted)" }}>
                ${(pack.creditMicros / 1_000_000).toFixed(2)} in GPU credit
              </div>
              <div style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: "clamp(9px, 0.7vw, 13px)", color: "var(--color-text-muted)" }}>
                ${(pack.chargeCents / 100).toFixed(2)} charged
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: "clamp(8px, 0.6vw, 11px)", color: "var(--color-text-muted)", opacity: 0.65, margin: "clamp(8px, 0.8vw, 14px) 0 0", lineHeight: 1.6 }}>
          The difference between credit value and charge is Stripe's processing fee.
          GPU compute is priced at Modal serverless rates with no additional markup.
        </p>
      </div>

      <div>
        <SectionLabel>How billing works</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: "clamp(6px, 0.65vw, 11px)" }}>
          {[
            "Credits are deducted per second of GPU compute at the rate for your model's tier.",
            "Cached analyses (logit lens, DLA, attribution) don't consume credits on repeat runs with the same model and prompt.",
            "Activation patching and steering are not cached — each run is billed separately.",
          ].map((line, i) => (
            <div key={i} style={{ display: "flex", gap: "clamp(7px, 0.75vw, 14px)", alignItems: "flex-start" }}>
              <span style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: "clamp(8px, 0.6vw, 11px)", color: "var(--color-text-muted)", opacity: 0.4, paddingTop: 2, flexShrink: 0 }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <p style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: "clamp(9px, 0.7vw, 13px)", color: "var(--color-text)", lineHeight: 1.65, margin: 0 }}>
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
        fontFamily: "var(--font-ibm-plex-sans), sans-serif",
        fontSize: "clamp(8px, 0.6vw, 11px)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--color-text-muted)",
        margin: "0 0 clamp(8px, 0.8vw, 14px)",
      }}
    >
      {children}
    </p>
  );
}

function FactList({ items }: { items: [string, string][] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "clamp(5px, 0.6vw, 10px)" }}>
      {items.map(([label, value]) => (
        <div key={label} style={{ display: "flex", gap: "clamp(8px, 1vw, 18px)", alignItems: "flex-start" }}>
          <div
            style={{
              width: "clamp(56px, 5.5vw, 96px)",
              flexShrink: 0,
              fontFamily: "var(--font-ibm-plex-sans), sans-serif",
              fontSize: "clamp(8px, 0.6vw, 11px)",
              color: "var(--color-text-muted)",
              letterSpacing: "0.04em",
              paddingTop: 1,
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontFamily: "var(--font-ibm-plex-sans), sans-serif",
              fontSize: "clamp(9px, 0.7vw, 13px)",
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
