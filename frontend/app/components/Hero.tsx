"use client";

import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "../lib/auth-client";
import { TactileButton } from "./ui/TactileButton";
import HeroFigure from "./HeroFigure";

// Keep the two CTAs dimensionally identical (shared face padding via the tactile vars).
const HERO_BTN_PAD = {
  "--pad-x": "clamp(14px,1.2vw,24px)",
  "--pad-y": "clamp(9px,0.7vw,13px)",
} as CSSProperties;

const HERO_BTN_FACE = "font-mono text-[clamp(13px,1vw,18px)] tracking-[0.01em]";

export default function Hero() {
  const router = useRouter();
  const { data: session } = useSession();

  return (
    <main className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-[1fr_1.6fr]">
      {/* ── Left: copy + CTAs ── */}
      <div className="flex flex-col justify-center px-[clamp(28px,6vw,96px)]">
        <h1 className="m-0 font-display text-[clamp(34px,5vw,64px)] font-normal leading-[1.08] tracking-[-0.01em] text-foreground">
          Doppo, a mechanistic interpretability workbench.
        </h1>

        <hr className="my-[clamp(24px,3vw,44px)] w-full border-0 border-t border-surface-border" />

        <div className="flex w-[clamp(170px,15vw,240px)] flex-col gap-[clamp(12px,1vw,18px)]">
          <TactileButton
            variant="ghost"
            block
            style={HERO_BTN_PAD}
            faceClassName={HERO_BTN_FACE}
            onClick={() => {
              if (session?.user) {
                router.push("/projects");
              } else {
                window.dispatchEvent(
                  new CustomEvent("doppo:open-auth", { detail: { mode: "signup" } }),
                );
              }
            }}
          >
            Projects
          </TactileButton>
          <TactileButton
            variant="ghost"
            href="/tutorial"
            block
            style={HERO_BTN_PAD}
            faceClassName={HERO_BTN_FACE}
          >
            Tutorial
          </TactileButton>
        </div>
      </div>

      {/* ── Right: hero figure (desktop only) ── */}
      <div className="relative hidden overflow-hidden border-l border-surface-border md:block">
        <HeroFigure />
        {/* 73° ≈ 90 − 18°: runs parallel to the figure's lattice axis (HeroFigure is rotated −18°). */}
        <span
          className="pointer-events-none absolute left-[6%] top-1/2 origin-left font-mono text-[clamp(13px,1.1vw,22px)] text-muted"
          style={{ transform: "translateY(-50%) rotate(73deg)" }}
        >
          hero fig., logit lens
        </span>
      </div>
    </main>
  );
}
