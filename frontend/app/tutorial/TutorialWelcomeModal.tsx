"use client";

import { useState } from "react";
import { TactileButton } from "../components/ui/TactileButton";
import type { TutorialStep } from "./steps";

type Props = {
  step: TutorialStep;
  onStart: () => void;
};

/** Right-pointing chevron that rotates to point down when `open`. */
function DisclosureChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      className="shrink-0 text-muted transition-transform duration-150"
      style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
      aria-hidden="true"
    >
      <path d="M3.5 1.5L7 5L3.5 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function TutorialWelcomeModal({ step, onStart }: Props) {
  const [fadingOut, setFadingOut] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const handleStart = () => {
    setFadingOut(true);
    setTimeout(onStart, 180);
  };

  // Content below is keyed to welcome.md's specific paragraph order (intro,
  // chromatic-order walkthrough that leads into the paper link, writing-style
  // note that leads into supporting content, projects-page CTA that leads
  // into the buttons) rather than mapped generically — this component only
  // ever renders the welcome step.
  const [introParagraph, orderParagraph, sourcesLeadParagraph, ctaParagraph] = step.paragraphs;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-6"
      style={{ animation: fadingOut ? "fadeIn 180ms ease reverse forwards" : "fadeIn 180ms ease" }}
    >
      <div className="flex max-h-[calc(100vh-48px)] w-full max-w-[700px] animate-fade-up flex-col gap-3 overflow-y-auto rounded-2xl border border-card-border bg-card px-10 pb-10 pt-10">
        <div>
          <h1 className="m-0 text-[22px] font-medium leading-[1.4] tracking-[-0.01em] text-foreground">
            {step.heading}
          </h1>
        </div>

        <div className="flex flex-col gap-3">
          {[introParagraph, orderParagraph].map((p, i) => (
            <p key={i} className="m-0 text-[13px] leading-[1.6] text-muted">
              {typeof p === "string" ? p : p.alt}
            </p>
          ))}
        </div>

        {step.paper && (
          <a
            href={step.paper.url}
            target="_blank"
            rel="noopener noreferrer"
            title={step.paper.label}
            className="flex items-center gap-2 rounded-[var(--ctl-radius-xs)] border-[1.5px] border-card-border bg-card px-[9px] py-1.5 text-left no-underline transition-colors hover:border-accent"
          >
            <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">
              {step.paper.label}
            </span>
          </a>
        )}

        {sourcesLeadParagraph && (
          <p className="m-0 text-[13px] leading-[1.6] text-muted">
            {typeof sourcesLeadParagraph === "string" ? sourcesLeadParagraph : sourcesLeadParagraph.alt}
          </p>
        )}

        <div>
          <button
            type="button"
            onClick={() => setSourcesOpen(o => !o)}
            aria-expanded={sourcesOpen}
            className="flex w-full cursor-pointer items-center justify-between gap-2 border-none bg-transparent p-0 text-left"
          >
            <span className="text-[10px] font-semibold text-muted">
              Supporting content (in no particular order)
            </span>
            <DisclosureChevron open={sourcesOpen} />
          </button>
          {sourcesOpen && (
            <div className="mt-2 flex flex-col gap-[5px]">
              {step.links.map(l => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-b border-surface-border pb-[5px] text-xs text-foreground no-underline"
                >
                  {l.label}
                </a>
              ))}
            </div>
          )}
        </div>

        {ctaParagraph && (
          <p className="m-0 text-[13px] leading-[1.6] text-muted">
            {typeof ctaParagraph === "string" ? ctaParagraph : ctaParagraph.alt}
          </p>
        )}

        <div className="flex items-center gap-3">
          <TactileButton
            variant="primary"
            capsule
            onClick={handleStart}
            className="self-start"
            faceClassName="text-sm"
          >
            Start →
          </TactileButton>
          {step.cta && (
            <TactileButton
              variant="ghost"
              href={step.cta.url}
              className="self-start"
              faceClassName="text-sm"
            >
              {step.cta.label} →
            </TactileButton>
          )}
        </div>
      </div>
    </div>
  );
}
