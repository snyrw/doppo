"use client";

import Link from "next/link";

type Props = {
  onDismiss: () => void;
};

const READING_LIST = [
  { label: "Wang et al. 2022 — IOI circuit paper (the experiment you just ran)", url: "https://arxiv.org/abs/2211.00593" },
  { label: "Neel Nanda — IOI walkthrough (with paper authors)", url: "https://www.neelnanda.io/mechanistic-interpretability/walkthrough-ioi" },
  { label: "ARENA Chapter 1 — full mech-interp curriculum", url: "https://learn.arena.education/chapter1_transformer_interp/21_ioi/" },
  { label: "Nanda — Attribution Patching at Industrial Scale", url: "https://www.neelnanda.io/mechanistic-interpretability/attribution-patching" },
  { label: "Panickssery et al. 2023 — Contrastive Activation Addition", url: "https://arxiv.org/abs/2312.06681" },
  { label: "Zou et al. 2023 — Representation Engineering", url: "https://arxiv.org/abs/2310.01405" },
  { label: "Tigges et al. 2024 — IOI circuit consistent across training and scale", url: "https://arxiv.org/abs/2407.10827" },
  { label: "Patterns and Mechanisms of CAA (2025)", url: "https://arxiv.org/abs/2505.03189" },
];

export default function TutorialCompleteModal({ onDismiss }: Props) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
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
          maxHeight: "calc(100vh - 48px)",
          overflowY: "auto",
          padding: "36px 40px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div>
          <p style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: "0 0 10px" }}>
            Complete
          </p>
          <h1 style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 22, fontWeight: 500, color: "var(--color-text)", margin: 0, lineHeight: 1.4, letterSpacing: "-0.01em" }}>
            Circuit traced.
          </h1>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 14, lineHeight: 1.75, color: "var(--color-text-muted)", margin: 0 }}>
            {`You’ve traced the IOI circuit end-to-end: from the logit lens showing when “ Mary” first appears, through the attention heads that spot the duplicate and suppress it, to the Name Movers that copy the answer — and verified the whole thing causally with activation patching.`}
          </p>
          <p style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 14, lineHeight: 1.75, color: "var(--color-text-muted)", margin: 0 }}>
            Step 6 showed the complementary approach: instead of asking how a behavior is implemented, you directly controlled it by injecting a learned direction in activation space. These two perspectives — circuit analysis and representation engineering — are the two main branches of mechanistic interpretability research today.
          </p>
        </div>

        <div>
          <p style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: "0 0 8px" }}>
            Further reading
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {READING_LIST.map(l => (
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

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <Link
            href="/projects"
            style={{
              padding: "10px 20px",
              background: "var(--color-accent)",
              color: "var(--color-accent-fg)",
              border: "none",
              borderRadius: 6,
              fontFamily: "var(--font-ibm-plex-sans), sans-serif",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Try it on your own model →
          </Link>
          <button
            onClick={onDismiss}
            style={{
              padding: "10px 20px",
              background: "none",
              color: "var(--color-text-muted)",
              border: "1px solid var(--color-surface-border)",
              borderRadius: 6,
              fontFamily: "var(--font-ibm-plex-sans), sans-serif",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Back to canvas
          </button>
        </div>
      </div>
    </div>
  );
}
