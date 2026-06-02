"use client";

import { useState } from "react";

type Props = {
  onStart: () => void;
};

const LINKS = [
  { label: "Wang et al. 2022 — Interpretability in the Wild (IOI circuit paper)", url: "https://arxiv.org/abs/2211.00593" },
  { label: "ARENA Chapter 1 — Mechanistic Interpretability curriculum", url: "https://learn.arena.education/chapter1_transformer_interp/21_ioi/" },
  { label: "Neel Nanda — IOI walkthrough", url: "https://www.neelnanda.io/mechanistic-interpretability/walkthrough-ioi" },
];

export default function TutorialWelcomeModal({ onStart }: Props) {
  const [fadingOut, setFadingOut] = useState(false);

  const handleStart = () => setFadingOut(true);

  return (
    <div
      onAnimationEnd={(e) => {
        if (fadingOut && e.target === e.currentTarget) onStart();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        animation: fadingOut
          ? "fadeIn 180ms ease reverse forwards"
          : "fadeIn 180ms ease",
      }}
    >
      <div
        style={{
          background: "var(--color-card)",
          border: "1px solid var(--color-card-border)",
          borderRadius: 12,
          boxShadow: "0 16px 64px rgba(0,0,0,0.24)",
          width: "100%",
          maxWidth: 560,
          padding: "36px 40px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          animation: "fadeUp 220ms ease",
        }}
      >
        <div>
          <p style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: "0 0 10px" }}>
            Tutorial
          </p>
          <h1 style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 22, fontWeight: 500, color: "var(--color-text)", margin: 0, lineHeight: 1.4, letterSpacing: "-0.01em" }}>
            Six tools for reading a transformer
          </h1>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 14, lineHeight: 1.75, color: "var(--color-text-muted)", margin: 0 }}>
            Mechanistic interpretability tries to reverse-engineer the algorithms implemented by neural networks — not just what they do, but how they do it. These six tools are the core of that toolkit.
          </p>
          <p style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 14, lineHeight: 1.75, color: "var(--color-text-muted)", margin: 0 }}>
            For steps 1–5 you'll trace a complete circuit in GPT-2 Small using the Indirect Object Identification task — a canonical benchmark from Wang et al. 2022 where the model must predict the indirect object of a sentence. Step 6 pivots to a different question: instead of tracing how a behavior is implemented, can you directly control it?
          </p>
          <p style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 14, lineHeight: 1.75, color: "var(--color-text-muted)", margin: 0 }}>
            Each step loads pre-computed results instantly — no GPU required. Configure and run each analysis using the Add + button, as you would in a real project.
          </p>
        </div>

        <div>
          <p style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: "0 0 8px" }}>
            Background reading
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {LINKS.map(l => (
              <a
                key={l.url}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 12, color: "var(--color-text)", textDecoration: "none", borderBottom: "1px solid var(--color-surface-border)", paddingBottom: 5 }}
              >
                {l.label} ↗
              </a>
            ))}
          </div>
        </div>

        <button
          onClick={handleStart}
          style={{
            marginTop: 4,
            padding: "10px 20px",
            background: "var(--color-accent)",
            color: "var(--color-accent-fg)",
            border: "none",
            borderRadius: 6,
            fontFamily: "var(--font-ibm-plex-sans), sans-serif",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            alignSelf: "flex-start",
          }}
        >
          Start →
        </button>
      </div>
    </div>
  );
}
