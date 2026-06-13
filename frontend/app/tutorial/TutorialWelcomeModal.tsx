"use client";

import { useState } from "react";

type Props = {
  onStart: () => void;
};

const LINKS = [
  { label: "3Blue1Brown — Transformers, the tech behind LLMs", url: "https://www.youtube.com/watch?v=wjZofJX0v4M" },
  { label: "Andrej Karpathy — Let's reproduce GPT-2 (124M)", url: "https://www.youtube.com/watch?v=l8pRSuU81PU" },
  { label: "ARENA — Chapter 0 & 1", url: "https://learn.arena.education/" },
  { label: "Olah et al., 2020 — Zoom In: An Introduction to Circuits", url: "https://distill.pub/2020/circuits/zoom-in" },
  { label: "Elhage et al., 2021 — A Mathematical Framework for Transformer Circuits", url: "https://transformer-circuits.pub/2021/framework/index.html" },
];

export default function TutorialWelcomeModal({ onStart }: Props) {
  const [fadingOut, setFadingOut] = useState(false);

  const handleStart = () => {
    setFadingOut(true);
    setTimeout(onStart, 180);
  };

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
        animation: fadingOut
          ? "fadeIn 180ms ease reverse forwards"
          : "fadeIn 180ms ease",
      }}
    >
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--card-border)",
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
          <p style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", margin: "0 0 10px" }}>
            Tutorial
          </p>
          <h1 style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 22, fontWeight: 500, color: "var(--text)", margin: 0, lineHeight: 1.4, letterSpacing: "-0.01em" }}>
            Welcome to Doppo!
          </h1>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 13, lineHeight: 1.75, color: "var(--text-muted)", margin: 0 }}>
            As part of a goal to explain mechanistic interpretability concepts to as many people as possible, this site contains a tutorial section that allows you to verify results from foundational papers live in the sandbox. Completing this will hopefully allow one to understand basic interpretability techniques that can then be applied to any TransformerLens model available on the site.
          </p>
          <p style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 13, lineHeight: 1.75, color: "var(--text-muted)", margin: 0 }}>
            There are 2 parts with 7 total stages. 1–5 trace a circuit in GPT-2 Small using an Indirect Object Identification (IOI) task, which is a canonical benchmark from Wang et al. 2022 where the model must predict the indirect object of a sentence. 
          </p>
          <p style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 13, lineHeight: 1.75, color: "var(--text-muted)", margin: 0 }}>
            Part 2 pivots to a different question: instead of tracing how a behavior is implemented, can you directly control it? We do this by taking pairs of prompts that represent two things, and then subtracting mean activations of one from the other to receive a &ldquo;behavior&rdquo; (steering vector) we can either increase or decrease by changing activation magnitude.
          </p>
          <p style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 13, lineHeight: 1.75, color: "var(--text-muted)", margin: 0 }}>
            This tutorial assumes some level of familiarity with neural network and transformer concepts, which introductions to have been provided below.
          </p>
        </div>

        <div>
          <p style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", margin: "0 0 8px" }}>
            Supporting Content (In no particular order)
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {LINKS.map(l => (
              <a
                key={l.url}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 12, color: "var(--text)", textDecoration: "none", borderBottom: "1px solid var(--surface-border)", paddingBottom: 5 }}
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
            background: "var(--accent)",
            color: "var(--accent-fg)",
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
