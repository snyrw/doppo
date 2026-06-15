"use client";

import { useState, useEffect } from "react";
import { cn } from "../lib/cn";
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
        className={cn(
          "fixed top-1/2 z-[60] flex -translate-y-1/2 cursor-pointer flex-col items-center gap-1 rounded-l-md border border-card-border bg-card px-1.5 py-2.5 transition-[right] duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
          isOpen ? "right-[360px]" : "right-0 border-r-0 shadow-[-2px_0_8px_rgba(0,0,0,0.08)]",
        )}
        aria-label={isOpen ? "Close guide" : "Open guide"}
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted [writing-mode:vertical-rl]">
          Guide
        </span>
        <span className={cn("text-xs text-muted transition-transform duration-[250ms]", isOpen ? "rotate-0" : "rotate-180")}>
          ›
        </span>
      </button>

      <div
        className={cn(
          "fixed bottom-0 right-0 top-[50px] z-50 flex w-[360px] flex-col overflow-hidden border-l border-surface-border bg-panel transition-transform duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="max-h-[22%] shrink-0 overflow-y-auto border-b border-surface-border px-4 pb-1.5 pt-2">
          <p className="m-0 mb-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
            Steps
          </p>
          <div className="flex flex-col">
            {stepListItems.map(({ step: s, index: i, showPartHeader }) => {
              const isDone = completedSteps.has(i);
              const isCurrent = i === currentStep;
              const isViewing = i === viewStep;
              const canNavigate = isDone || isCurrent;

              return (
                <div key={i}>
                  {showPartHeader && (
                    <p className="mx-1.5 mb-0.5 mt-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted">
                      {s.part}
                    </p>
                  )}
                  <button
                    onPointerDown={e => e.stopPropagation()}
                    onClick={() => { if (canNavigate) { setViewStep(i); onStepSelect(i); } }}
                    disabled={!canNavigate}
                    className={cn(
                      "flex w-full items-center gap-[7px] rounded border-none px-1.5 py-0.5 text-left transition-colors",
                      isViewing ? "bg-surface-border" : "bg-transparent",
                      canNavigate ? "cursor-pointer" : "cursor-default",
                    )}
                  >
                    <span className={cn(
                      "flex h-[11px] w-[11px] shrink-0 items-center justify-center rounded-full text-[7px] font-bold",
                      isDone ? "bg-accent text-accent-fg" : cn("border border-surface-border text-muted", isCurrent ? "bg-surface-border" : "bg-transparent"),
                    )}>
                      {isDone ? "✓" : (s.badge ?? (i === 0 ? "·" : i))}
                    </span>
                    <span className={cn(
                      "text-[11px]",
                      isCurrent ? "font-semibold" : "font-normal",
                      (isCurrent || isViewing || isDone) ? "text-foreground" : "text-muted",
                    )}>
                      {s.label}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-8 pt-5">
          <p className="m-0 mb-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
            {stepLabel}
          </p>
          <h2 className="m-0 mb-4 text-base font-semibold tracking-[-0.01em] text-foreground">
            {step.heading}
          </h2>

          <div className="mb-5 flex flex-col gap-3">
            {step.paragraphs.map((p, i) =>
              typeof p === "string" ? (
                <p key={i} className="m-0 text-[13px] leading-[1.75] text-muted">
                  {p}
                </p>
              ) : (
                // Static tutorial illustrations of varying intrinsic size; plain <img> is intentional.
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={p.src} alt={p.alt} className="block w-full rounded-md" />
              )
            )}
          </div>

          {step.whatToNotice && (
            <div className={cn("rounded-md bg-surface-border px-3.5 py-3", step.caveat ? "mb-4" : "mb-5")}>
              <p className="m-0 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                What to notice
              </p>
              <p className="m-0 text-xs leading-[1.7] text-foreground">
                {step.whatToNotice}
              </p>
            </div>
          )}

          {step.caveat && (
            <div className="mb-5 rounded-md border border-surface-border px-3.5 py-3">
              <p className="m-0 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                Caveat
              </p>
              <p className="m-0 text-xs leading-[1.7] text-muted">
                {step.caveat}
              </p>
            </div>
          )}

          {step.links.length > 0 && (
            <div className={isIntroStep && viewStep === currentStep ? "mb-5" : "mb-0"}>
              <p className="m-0 mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                References
              </p>
              <div className="flex flex-col gap-[5px]">
                {step.links.map(l => (
                  <a
                    key={l.url}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onPointerDown={e => e.stopPropagation()}
                    className="border-b border-surface-border pb-1 text-[11px] text-foreground no-underline"
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
              className="mt-1 cursor-pointer rounded-md border-none bg-accent px-[18px] py-[9px] text-[13px] font-semibold text-accent-fg"
            >
              Start Part 1 →
            </button>
          )}
        </div>
      </div>
    </>
  );
}
