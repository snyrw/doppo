"use client";

import { useState } from "react";
import { TactileButton } from "../components/ui/TactileButton";

type Props = {
  onStart: () => void;
};

const LINKS = [
  { label: "Neel Nanda: Mech Interp Glossary (old, but demo content is mostly from this era)", url: "https://dynalist.io/d/n2ZWtnoYHrU1s4vnFSAQ519J" },
  { label: "ARENA: Chapter 0 & 1 (enough to quickstart, full thing is great)", url: "https://learn.arena.education/" },
  { label: "Elhage et al., 2021: A Mathematical Framework for Transformer Circuits (jargon-dense, established transformer interpretability vocab)", url: "https://transformer-circuits.pub/2021/framework/index.html" },
  { label: "Neel Nanda: Mathematical Framework Walkthrough (core author explains the paper step-by-step)", url:"https://www.youtube.com/watch?v=KV5gbOmHbjU"}
];

export default function TutorialWelcomeModal({ onStart }: Props) {
  const [fadingOut, setFadingOut] = useState(false);

  const handleStart = () => {
    setFadingOut(true);
    setTimeout(onStart, 180);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-6"
      style={{ animation: fadingOut ? "fadeIn 180ms ease reverse forwards" : "fadeIn 180ms ease" }}
    >
      <div className="flex max-h-[calc(100vh-48px)] w-full max-w-[560px] animate-fade-up flex-col gap-5 overflow-y-auto rounded-xl border border-card-border bg-card px-10 pb-8 pt-9">
        <div>
          <h1 className="m-0 text-[22px] font-medium leading-[1.4] tracking-[-0.01em] text-foreground">
            Welcome to Doppo!
          </h1>
        </div>

        <div className="flex flex-col gap-3">
          <p className="m-0 text-[13px] leading-[1.75] text-muted">
            This part of the site contains our demo. The demo itself has all of our current techniques along with a brief on what they show through canonical examples like the IOI circuit. Breakdowns can be seen if you press "?".
          </p>
          <p className="m-0 text-[13px] leading-[1.75] text-muted">
            The writing will try (and hopefully succeed) to explain these concepts well enough without a strong interpretability background, but if you've found yourself not understanding things fully here, it is recommended that you skim through or take notes on the following sources below. Some of these have conceptually driven interpretability for many years now and are where much of the jargon comes from.
          </p>
        </div>

        <div>
          <p className="m-0 mb-2 text-[10px] font-semibold text-muted">
            Supporting content (in no particular order)
          </p>
          <div className="flex flex-col gap-[5px]">
            {LINKS.map(l => (
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
        </div>

        <TactileButton
          variant="primary"
          capsule
          onClick={handleStart}
          className="mt-1 self-start"
          faceClassName="text-sm"
        >
          Start →
        </TactileButton>
      </div>
    </div>
  );
}
