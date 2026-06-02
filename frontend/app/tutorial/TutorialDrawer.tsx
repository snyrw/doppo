"use client";

import { useState, useEffect } from "react";
import { TUTORIAL_STEPS } from "./steps";

type Props = {
  isOpen: boolean;
  onToggle: () => void;
  currentStep: number;
  completedSteps: Set<number>;
  onStepSelect: (index: number) => void;
};

export default function TutorialDrawer({
  isOpen,
  onToggle,
  currentStep,
  completedSteps,
  onStepSelect,
}: Props) {
  const [viewStep, setViewStep] = useState(currentStep);

  useEffect(() => {
    setViewStep(currentStep);
  }, [currentStep]);

  const step = TUTORIAL_STEPS[viewStep];

  return (
    <>
      <button
        onClick={onToggle}
        onPointerDown={e => e.stopPropagation()}
        style={{
          position: "fixed",
          top: "50%",
          right: isOpen ? 360 : 0,
          transform: "translateY(-50%)",
          zIndex: 60,
          background: "var(--color-card)",
          border: "1px solid var(--color-card-border)",
          borderRight: isOpen ? "1px solid var(--color-card-border)" : "none",
          borderRadius: "6px 0 0 6px",
          padding: "10px 6px",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          transition: "right 250ms cubic-bezier(0.4,0,0.2,1)",
          boxShadow: isOpen ? "none" : "-2px 0 8px rgba(0,0,0,0.08)",
        }}
        aria-label={isOpen ? "Close guide" : "Open guide"}
      >
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: "var(--color-text-muted)", writingMode: "vertical-rl", textTransform: "uppercase", fontFamily: "var(--font-ibm-plex-sans), sans-serif" }}>
          Guide
        </span>
        <span style={{ fontSize: 12, color: "var(--color-text-muted)", transform: isOpen ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 250ms" }}>
          ›
        </span>
      </button>

      <div
        style={{
          position: "fixed",
          top: 50,
          right: 0,
          bottom: 0,
          width: 360,
          background: "var(--color-panel)",
          borderLeft: "1px solid var(--color-surface-border)",
          display: "flex",
          flexDirection: "column",
          zIndex: 50,
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 250ms cubic-bezier(0.4,0,0.2,1)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flexShrink: 0,
            borderBottom: "1px solid var(--color-surface-border)",
            padding: "12px 16px 10px",
          }}
        >
          <p style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: "0 0 8px" }}>
            Steps
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {TUTORIAL_STEPS.map((s, i) => {
              const isDone = completedSteps.has(i);
              const isCurrent = i === currentStep;
              const isViewing = i === viewStep;
              const canNavigate = isDone || isCurrent;

              return (
                <button
                  key={i}
                  onPointerDown={e => e.stopPropagation()}
                  onClick={() => { if (canNavigate) { setViewStep(i); onStepSelect(i); } }}
                  disabled={!canNavigate}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "4px 6px",
                    background: isViewing ? "var(--color-surface-border)" : "none",
                    border: "none",
                    borderRadius: 4,
                    cursor: canNavigate ? "pointer" : "default",
                    textAlign: "left",
                    transition: "background 100ms",
                  }}
                >
                  <span style={{ width: 14, height: 14, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, fontFamily: "var(--font-ibm-plex-sans), sans-serif", background: isDone ? "var(--color-accent)" : isCurrent ? "var(--color-surface-border)" : "transparent", border: isDone ? "none" : "1px solid var(--color-surface-border)", color: isDone ? "var(--color-accent-fg)" : "var(--color-text-muted)" }}>
                    {isDone ? "✓" : i + 1}
                  </span>
                  <span style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 11, color: isCurrent || isViewing ? "var(--color-text)" : isDone ? "var(--color-text)" : "var(--color-text-muted)", fontWeight: isCurrent ? 600 : 400 }}>
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 32px" }}>
          <p style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: "0 0 8px" }}>
            Step {viewStep + 1} of {TUTORIAL_STEPS.length}
          </p>
          <h2 style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 16, fontWeight: 600, color: "var(--color-text)", margin: "0 0 16px", letterSpacing: "-0.01em" }}>
            {step.heading}
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
            {step.paragraphs.map((p, i) => (
              <p key={i} style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 13, lineHeight: 1.75, color: "var(--color-text-muted)", margin: 0 }}>
                {p}
              </p>
            ))}
          </div>

          <div style={{ background: "var(--color-surface-border)", borderRadius: 6, padding: "12px 14px", marginBottom: step.caveat ? 16 : 20 }}>
            <p style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: "0 0 6px" }}>
              What to notice
            </p>
            <p style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 12, lineHeight: 1.7, color: "var(--color-text)", margin: 0 }}>
              {step.whatToNotice}
            </p>
          </div>

          {step.caveat && (
            <div style={{ border: "1px solid var(--color-surface-border)", borderRadius: 6, padding: "12px 14px", marginBottom: 20 }}>
              <p style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: "0 0 6px" }}>
                Caveat
              </p>
              <p style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 12, lineHeight: 1.7, color: "var(--color-text-muted)", margin: 0 }}>
                {step.caveat}
              </p>
            </div>
          )}

          {step.links.length > 0 && (
            <div>
              <p style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: "0 0 8px" }}>
                References
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {step.links.map(l => (
                  <a
                    key={l.url}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onPointerDown={e => e.stopPropagation()}
                    style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 11, color: "var(--color-text)", textDecoration: "none", borderBottom: "1px solid var(--color-surface-border)", paddingBottom: 4 }}
                  >
                    {l.label} ↗
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
