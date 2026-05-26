"use client";

import { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import HeroSpecimen from "./HeroSpecimen";

type Mode = "logit-lens" | "dla" | "activation-patch";

const MODES: Mode[] = ["logit-lens", "dla", "activation-patch"];
const MODE_DURATION_MS = 9500;
const FADE_MS = 480;

const MODE_META: Record<Mode, { eyebrow: string; headline: ReactNode; description: string; tags: string[] }> = {
  "logit-lens": {
    eyebrow: "logit lens",
    headline: <>Watch token predictions form,<br /><em>layer by layer.</em></>,
    description:
      "Models from HuggingFace Hub, GPU-accelerated via Modal. Results in seconds. No code, no notebooks.",
    tags: ["TransformerLens 3.0 models", "Every layer", "GPU-accelerated", "Saved projects"],
  },
  "dla": {
    eyebrow: "direct logit attribution",
    headline: <>Trace which layers drive a prediction —<br /><em>and which suppress it.</em></>,
    description:
      "Decompose each layer's attention and MLP as signed influences on the final token. Layer view or per-head heatmap.",
    tags: ["Attention & MLP split", "Signed attribution", "Layer or head view", "Contrastive tokens"],
  },
  "activation-patch": {
    eyebrow: "activation patching",
    headline: <>Attribution estimated it.<br /><em>Patching confirmed it.</em></>,
    description:
      "Swap activations between a clean and corrupted prompt to verify which components are causally decisive.",
    tags: ["Clean vs. corrupted", "Top-K verification", "Causal confirmation", "Spearman ρ"],
  },
};

// Mounts at opacity 0, transitions to 1 after two rAFs so CSS transition fires.
// Remount via `key` to retrigger the fade-in.
function FadeInBlock({ children }: { children: ReactNode }) {
  const [opacity, setOpacity] = useState(0);
  useEffect(() => {
    const r1 = requestAnimationFrame(() => {
      const r2 = requestAnimationFrame(() => setOpacity(1));
      return () => cancelAnimationFrame(r2);
    });
    return () => cancelAnimationFrame(r1);
  }, []);
  return (
    <div style={{ opacity, transition: `opacity ${FADE_MS}ms ease` }}>
      {children}
    </div>
  );
}

// Renders the full left-column content for a given mode.
function LeftContent({ meta }: { meta: (typeof MODE_META)[Mode] }) {
  return (
    <>
      <p
        style={{
          fontFamily: "var(--font-azeret-mono), monospace",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.04em",
          color: "var(--color-text-muted)",
          margin: "0 0 18px",
        }}
      >
        {meta.eyebrow}
      </p>

      <h1
        style={{
          fontFamily: "var(--font-fraunces), Georgia, serif",
          fontSize: "clamp(36px, 3.2vw, 50px)",
          fontWeight: 400,
          lineHeight: 1.15,
          letterSpacing: "-0.02em",
          color: "var(--color-text)",
          margin: "0 0 22px",
        }}
      >
        {meta.headline}
      </h1>

      <p
        style={{
          fontFamily: "var(--font-azeret-mono), monospace",
          fontSize: 13,
          lineHeight: 2.0,
          color: "var(--color-text-muted)",
          margin: "0 0 34px",
          maxWidth: 360,
        }}
      >
        {meta.description}
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 44 }}>
        <Link
          href="/projects"
          className="btn-accent"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 20px",
            borderRadius: 6,
            fontFamily: "var(--font-azeret-mono), monospace",
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: "0.02em",
            textDecoration: "none",
          }}
        >
          <span aria-hidden>→</span> Open Sandbox
        </Link>
      </div>

      <div
        style={{
          display: "flex",
          gap: 20,
          paddingTop: 20,
          borderTop: "1px solid var(--color-surface-border)",
          flexWrap: "wrap",
        }}
      >
        {meta.tags.map((tag) => (
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
    </>
  );
}

export default function HeroContent() {
  const [mode, setMode] = useState<Mode>("logit-lens");
  const [prevMode, setPrevMode] = useState<Mode | null>(null);
  const [exiting, setExiting] = useState(false);
  // Ref so the interval callback always reads the latest mode without stale closure.
  const modeRef = useRef<Mode>("logit-lens");

  useEffect(() => {
    const id = setInterval(() => {
      const current = modeRef.current;
      const next = MODES[(MODES.indexOf(current) + 1) % MODES.length];

      // Batch update: outgoing mounts at opacity 1 (exiting=false), incoming mounts at opacity 0.
      setPrevMode(current);
      setExiting(false);
      setMode(next);
      modeRef.current = next;

      // Two rAFs: let React paint the outgoing at opacity 1, then start its fade-out.
      // FadeInBlock handles the incoming fade-in independently via its own two-rAF effect.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setExiting(true));
      });

      // Remove outgoing from DOM after transition completes.
      setTimeout(() => {
        setPrevMode(null);
        setExiting(false);
      }, FADE_MS + 150);
    }, MODE_DURATION_MS);

    return () => clearInterval(id);
  }, []);

  const meta = MODE_META[mode];
  const prevMeta = prevMode ? MODE_META[prevMode] : null;

  return (
    <main
      style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Center rule */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "12%",
          bottom: "12%",
          width: 1,
          background: "var(--color-surface-border)",
          pointerEvents: "none",
        }}
      />

      {/* Left column */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 60px 0 80px",
        }}
      >
        {/*
          Crossfade container. The outgoing copy sits as position:absolute so it
          doesn't affect layout height; the incoming copy is in normal flow and
          determines the container height.
        */}
        <div style={{ position: "relative", overflow: "hidden" }}>
          {/* Outgoing — absolute overlay, starts at opacity 1, fades to 0 */}
          {prevMeta && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                opacity: exiting ? 0 : 1,
                transition: `opacity ${FADE_MS}ms ease`,
                pointerEvents: "none",
                userSelect: "none",
              }}
            >
              <LeftContent meta={prevMeta} />
            </div>
          )}

          {/* Incoming — in flow, starts at opacity 0, fades to 1 */}
          <FadeInBlock key={mode}>
            <LeftContent meta={meta} />
          </FadeInBlock>
        </div>
      </div>

      {/* Right column */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 64px",
          backgroundImage:
            "radial-gradient(circle, var(--color-surface-border) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          borderLeft: "1px solid var(--color-surface-border)",
        }}
      >
        {/* key on FadeInBlock causes both FadeInBlock and HeroSpecimen to remount,
            triggering the fade-in and resetting all internal specimen animations. */}
        <FadeInBlock key={mode}>
          <HeroSpecimen mode={mode} />
        </FadeInBlock>
      </div>
    </main>
  );
}
