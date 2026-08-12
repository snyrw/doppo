"use client";

import { useState } from "react";
import { TactileButton } from "../components/ui/TactileButton";

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
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-6"
      style={{ animation: fadingOut ? "fadeIn 180ms ease reverse forwards" : "fadeIn 180ms ease" }}
    >
      <div className="flex max-h-[calc(100vh-48px)] w-full max-w-[560px] animate-fade-up flex-col gap-5 overflow-y-auto rounded-xl border border-card-border bg-card px-10 pb-8 pt-9">
        <div>
          <p className="m-0 mb-2.5 text-[10px] font-semibold text-muted">
            Tutorial
          </p>
          <h1 className="m-0 text-[22px] font-medium leading-[1.4] tracking-[-0.01em] text-foreground">
            Welcome to Doppo!
          </h1>
        </div>

        <div className="flex flex-col gap-3">
          <p className="m-0 text-[13px] leading-[1.75] text-muted">
            As part of a goal to explain mechanistic interpretability concepts to as many people as possible, this site contains a demo section with six real analysis cards, pre-loaded on the canonical IOI circuit and a steering example, that you can click through to see what the sandbox produces.
          </p>
          <p className="m-0 text-[13px] leading-[1.75] text-muted">
            This assumes some level of familiarity with neural network and transformer concepts, which introductions to have been provided below.
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
                {l.label} ↗
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
