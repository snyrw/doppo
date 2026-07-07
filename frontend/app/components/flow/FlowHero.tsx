"use client";

import type { CSSProperties } from "react";
import { HERO_HEADLINE, HeroCtas } from "../hero/hero-shared";

// Flow-mode hero: the deck hero's copy and CTAs in a plain scrolling column —
// no figure, eyebrow nav, registration corner, or entrance animation. Fills
// the first viewport (minus the 50px navbar) so the landing still opens on a
// composed screen before the user scrolls.
const FLOW_BTN_PAD = {
  "--pad-x": "clamp(14px,1.2vw,24px)",
  "--pad-y": "11px",
} as CSSProperties;

const FLOW_BTN_FACE =
  "font-sans font-normal text-[15px] tracking-[0.01em] justify-start text-muted";

export default function FlowHero() {
  return (
    <div className="flex min-h-[calc(100svh-50px)] flex-col justify-center py-12">
      <h1 className="m-0 font-display text-[clamp(30px,9vw,44px)] font-normal leading-[1.08] tracking-[-0.01em] text-accent">
        {HERO_HEADLINE}
      </h1>
      <hr className="my-7 w-full border-0 border-t border-muted" />
      <div className="flex w-full max-w-[420px] flex-col gap-3">
        <HeroCtas style={FLOW_BTN_PAD} faceClassName={FLOW_BTN_FACE} />
      </div>
    </div>
  );
}
