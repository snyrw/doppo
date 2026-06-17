"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TactileButton } from "../components/ui/TactileButton";

type Props = {
  onDismiss: () => void;
};

const READING_LIST = [
  { label: "Nanda — How To Become A Mechanistic Interpretability Researcher", url: "https://www.alignmentforum.org/posts/jP9KDyMkchuv6tHwm/how-to-become-a-mechanistic-interpretability-researcher" },
  { label: "Nanda — Concrete Steps to Get Started in Transformer Mechanistic Interpretability", url: "https://www.lesswrong.com/posts/9ezkEb9oGvEi6WoB3/concrete-steps-to-get-started-in-transformer-mechanistic" },
  { label: "ARENA — Chapter 1: full mech-interp curriculum", url: "https://learn.arena.education/chapter1_transformer_interp/21_ioi/" },
  { label: "Nanda — Attribution Patching at Industrial Scale", url: "https://www.neelnanda.io/mechanistic-interpretability/attribution-patching" },
  { label: "Conmy et al. 2023 — Towards Automated Circuit Discovery (ACDC)", url: "https://arxiv.org/abs/2304.14997" },
  { label: "Chan et al. 2022 — Causal Scrubbing", url: "https://www.alignmentforum.org/posts/JvZhhzycHu2Yd57RN/causal-scrubbing-a-method-for-rigorously-testing" },
  { label: "Panickssery et al. 2023 — Contrastive Activation Addition", url: "https://arxiv.org/abs/2312.06681" },
  { label: "Zou et al. 2023 — Representation Engineering", url: "https://arxiv.org/abs/2310.01405" },
  { label: "Arditi et al. 2024 — Refusal in Language Models Is Mediated by a Single Direction", url: "https://arxiv.org/abs/2406.11717" },
  { label: "Patterns and Mechanisms of CAA (2025)", url: "https://arxiv.org/abs/2505.03189" },
  { label: "Tigges et al. 2024 — IOI circuit consistent across training and scale", url: "https://arxiv.org/abs/2407.10827" },
  { label: "Elhage et al. 2022 — Toy Models of Superposition", url: "https://arxiv.org/abs/2209.10652" },
  { label: "Sharkey et al. 2025 — Open Problems in Mechanistic Interpretability", url: "https://arxiv.org/abs/2501.16496" },
  { label: "Bereska & Gavves 2024 — Mechanistic Interpretability for AI Safety: A Review", url: "https://arxiv.org/abs/2404.14082" },
];

export default function TutorialCompleteModal({ onDismiss }: Props) {
  const router = useRouter();
  const [fadingOut, setFadingOut] = useState(false);

  const handleGoToProjects = () => {
    setFadingOut(true);
    setTimeout(() => router.push("/projects"), 180);
  };

  const handleDismiss = () => {
    setFadingOut(true);
    setTimeout(onDismiss, 180);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-6"
      style={{ animation: fadingOut ? "fadeIn 180ms ease reverse forwards" : "fadeIn 180ms ease" }}
    >
      <div className="flex max-h-[calc(100vh-48px)] w-full max-w-[560px] animate-fade-up flex-col gap-5 overflow-y-auto rounded-xl border border-card-border bg-card px-10 pb-8 pt-9 shadow-[0_16px_64px_rgba(0,0,0,0.24)]">
        <div>
          <p className="m-0 mb-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
            Tutorial Finished
          </p>
          <h1 className="m-0 text-[22px] font-medium leading-[1.4] tracking-[-0.01em] text-foreground">
            Complete!
          </h1>
        </div>

        <div className="flex flex-col gap-3">
          <p className="m-0 text-sm leading-[1.75] text-muted">
            {`Part 1 allowed you to trace the IOI circuit end-to-end: from the logit lens showing when " Mary" first appears, through the attention heads that spot the duplicate and suppress it, to the Name Movers that copy the answer, and verified the whole thing causally with activation patching.`}
          </p>
          <p className="m-0 text-sm leading-[1.75] text-muted">
            Part 2 showed a separate approach: instead of asking how a behavior is implemented, you directly controlled it by injecting a learned direction in activation space. The focus of those doing interpretability has expanded greatly in scope from these tasks, both perspectives (circuit analysis and representation engineering) are important branches of mechanistic interpretability research today.
          </p>
        </div>

        <div>
          <p className="m-0 mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            Further reading
          </p>
          <div className="flex flex-col gap-[5px]">
            {READING_LIST.map(l => (
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

        <div className="mt-1 flex gap-2.5">
          <TactileButton
            variant="primary"
            onClick={handleGoToProjects}
            faceClassName="text-sm"
          >
            Try it on your own model →
          </TactileButton>
          <TactileButton
            variant="ghost"
            onClick={handleDismiss}
            faceClassName="text-sm"
          >
            Back to canvas
          </TactileButton>
        </div>
      </div>
    </div>
  );
}
