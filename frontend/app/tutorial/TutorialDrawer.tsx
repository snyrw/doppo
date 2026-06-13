"use client";

import { useState, useEffect } from "react";
import type { TutorialStep } from "./steps";

type Props = {
  steps: TutorialStep[];
  isOpen: boolean;
  onToggle: () => void;
  currentStep: number;
  completedSteps: Set<number>;
  onStepSelect: (index: number) => void;
  onContinueIntro: () => void;
};

export default function TutorialDrawer({
  steps,
  isOpen,
  onToggle,
  currentStep,
  completedSteps,
  onStepSelect,
  onContinueIntro,
}: Props) {
  const [viewStep, setViewStep] = useState(currentStep);

  useEffect(() => {
    setViewStep(currentStep);
  }, [currentStep]);

  const step = steps[viewStep];

  const stepListItems = steps.map((s, i) => {
    const prevPart = i > 0 ? steps[i - 1].part : undefined;
    const showPartHeader = s.part && s.part !== prevPart;
    return { step: s, index: i, showPartHeader };
  });

  const isIntroStep = !step.cardType;
  const stepLabel = isIntroStep
    ? "Introduction"
    : `Step ${viewStep} of ${steps.length - 1}`;

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
          background: "var(--card)",
          border: "1px solid var(--card-border)",
          borderRight: isOpen ? "1px solid var(--card-border)" : "none",
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
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: "var(--text-muted)", writingMode: "vertical-rl", textTransform: "uppercase", fontFamily: "var(--font-ibm-plex-sans), sans-serif" }}>
          Guide
        </span>
        <span style={{ fontSize: 12, color: "var(--text-muted)", transform: isOpen ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 250ms" }}>
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
          background: "var(--panel)",
          borderLeft: "1px solid var(--surface-border)",
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
            borderBottom: "1px solid var(--surface-border)",
            padding: "8px 16px 6px",
            maxHeight: "22%",
            overflowY: "auto",
          }}
        >
          <p style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", margin: "0 0 4px" }}>
            Steps
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {stepListItems.map(({ step: s, index: i, showPartHeader }) => {
              const isDone = completedSteps.has(i);
              const isCurrent = i === currentStep;
              const isViewing = i === viewStep;
              const canNavigate = isDone || isCurrent;

              return (
                <div key={i}>
                  {showPartHeader && (
                    <p style={{
                      fontFamily: "var(--font-ibm-plex-sans), sans-serif",
                      fontSize: 9,
                      fontWeight: 600,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--text-muted)",
                      margin: "4px 6px 2px",
                    }}>
                      {s.part}
                    </p>
                  )}
                  <button
                    onPointerDown={e => e.stopPropagation()}
                    onClick={() => { if (canNavigate) { setViewStep(i); onStepSelect(i); } }}
                    disabled={!canNavigate}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "2px 6px",
                      width: "100%",
                      background: isViewing ? "var(--surface-border)" : "none",
                      border: "none",
                      borderRadius: 4,
                      cursor: canNavigate ? "pointer" : "default",
                      textAlign: "left",
                      transition: "background 100ms",
                    }}
                  >
                    <span style={{ width: 11, height: 11, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 700, fontFamily: "var(--font-ibm-plex-sans), sans-serif", background: isDone ? "var(--accent)" : isCurrent ? "var(--surface-border)" : "transparent", border: isDone ? "none" : "1px solid var(--surface-border)", color: isDone ? "var(--accent-fg)" : "var(--text-muted)" }}>
                      {isDone ? "✓" : (s.badge ?? (i === 0 ? "·" : i))}
                    </span>
                    <span style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 11, color: isCurrent || isViewing ? "var(--text)" : isDone ? "var(--text)" : "var(--text-muted)", fontWeight: isCurrent ? 600 : 400 }}>
                      {s.label}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 32px" }}>
          <p style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", margin: "0 0 8px" }}>
            {stepLabel}
          </p>
          <h2 style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 16, fontWeight: 600, color: "var(--text)", margin: "0 0 16px", letterSpacing: "-0.01em" }}>
            {step.heading}
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
            {step.paragraphs.map((p, i) =>
              typeof p === "string" ? (
                <p key={i} style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 13, lineHeight: 1.75, color: "var(--text-muted)", margin: 0 }}>
                  {p}
                </p>
              ) : (
                // Static tutorial illustrations of varying intrinsic size; plain <img> is intentional.
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={p.src} alt={p.alt} style={{ width: "100%", borderRadius: 6, display: "block" }} />
              )
            )}
          </div>

          {step.whatToNotice && (
            <div style={{ background: "var(--surface-border)", borderRadius: 6, padding: "12px 14px", marginBottom: step.caveat ? 16 : 20 }}>
              <p style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", margin: "0 0 6px" }}>
                What to notice
              </p>
              <p style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 12, lineHeight: 1.7, color: "var(--text)", margin: 0 }}>
                {step.whatToNotice}
              </p>
            </div>
          )}

          {step.caveat && (
            <div style={{ border: "1px solid var(--surface-border)", borderRadius: 6, padding: "12px 14px", marginBottom: 20 }}>
              <p style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", margin: "0 0 6px" }}>
                Caveat
              </p>
              <p style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 12, lineHeight: 1.7, color: "var(--text-muted)", margin: 0 }}>
                {step.caveat}
              </p>
            </div>
          )}

          {step.links.length > 0 && (
            <div style={{ marginBottom: isIntroStep && viewStep === currentStep ? 20 : 0 }}>
              <p style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", margin: "0 0 8px" }}>
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
                    style={{ fontFamily: "var(--font-ibm-plex-sans), sans-serif", fontSize: 11, color: "var(--text)", textDecoration: "none", borderBottom: "1px solid var(--surface-border)", paddingBottom: 4 }}
                  >
                    {l.label} ↗
                  </a>
                ))}
              </div>
            </div>
          )}

          {isIntroStep && viewStep === currentStep && (
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={onContinueIntro}
              style={{
                marginTop: 4,
                padding: "9px 18px",
                background: "var(--accent)",
                color: "var(--accent-fg)",
                border: "none",
                borderRadius: 6,
                fontFamily: "var(--font-ibm-plex-sans), sans-serif",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Start Part 1 →
            </button>
          )}
        </div>
      </div>
    </>
  );
}
