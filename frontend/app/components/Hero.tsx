"use client";

import { Fragment, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "../lib/auth-client";
import { cn } from "../lib/cn";
import { TactileButton } from "./ui/TactileButton";
import HeroFigure from "./HeroFigure";
import { HF_UNIT, STAGE_LEFT_CSS, STAGE_W_U, HAIRLINE_LEFT_U, CAPTION_LEFT_U, CAPTION_TOP_U, u } from "./figure-geometry";
import EyebrowNav from "./EyebrowNav";
import { useSectionEntrance } from "./deck/DeckContext";

// Keep the two CTAs dimensionally identical (shared face padding via the tactile vars).
const HERO_BTN_PAD = {
  "--pad-x": "clamp(14px,1.2vw,24px)",
  "--pad-y": "clamp(9px,min(0.7vw,1.244svh),13px)",
} as CSSProperties;

const HERO_BTN_FACE = "font-sans font-normal text-[clamp(13px,min(1vw,1.778svh),18px)] tracking-[0.01em] justify-start text-muted";

// Entrance choreography (ms). Headline words rise+fade in quick succession, then
// the left-column controls settle, then HeroFigure paints row-by-row (timed in
// HeroFigure itself), and finally the figure's annotations fade up underneath it.
const HEADLINE = "Doppo, a mechanistic interpretability workbench.";
const WORD_STAGGER = 60;
const CONTROLS_DELAY = 380;
const CAPTION_DELAY = 1080;

export default function Hero() {
  const entering = useSectionEntrance();
  const router = useRouter();
  const { data: session } = useSession();

  return (
    <div className="relative grid h-full grid-cols-1 overflow-hidden md:grid-cols-[1fr_1.6fr]">
      {/* ── Left: copy + CTAs ── */}
      <div className="flex flex-col justify-center px-[clamp(28px,6vw,96px)]">
        {/* Eyebrow section nav (dummy — clicking lights a section locally; not yet
            wired to routes). Fades in with the headline; reduced-motion shows it
            at full opacity via the .animate-hero-row media query. */}
        <div className={cn("mb-[clamp(30px,min(4.5vw,8svh),58px)]", entering && "animate-hero-row")}>
          <EyebrowNav />
        </div>

        {/* Title block. A registration corner (equal-length arms) frames the
            headline's top-left; the <hr> below closes the implied "box-but-not-a-box".
            pt/pl inset the headline so the corner sits just outside the text with a
            small margin, mirroring the Figma. Corner and rule share one muted tone and
            one 1px weight — neither is promoted to ink. */}
        <div className="relative">
          <span
            aria-hidden
            className={cn("pointer-events-none absolute -left-[26px] -top-6 h-[clamp(56px,min(7vw,12.444svh),96px)] w-[clamp(56px,min(7vw,12.444svh),96px)] border-l border-t border-muted", entering && "animate-hero-row")}
          />
          <h1 className="m-0 font-display text-[clamp(34px,min(5vw,8.889svh),58px)] font-normal leading-[1.08] tracking-[-0.01em] text-accent">
            {HEADLINE.split(" ").map((word, i) => (
              <Fragment key={i}>
                <span
                  className={cn("inline-block", entering && "animate-hero-word")}
                  style={{ animationDelay: `${i * WORD_STAGGER}ms` }}
                >
                  {word}
                </span>{" "}
              </Fragment>
            ))}
          </h1>
        </div>

        <hr
          className={cn("my-[clamp(24px,min(3vw,5.333svh),44px)] w-full border-0 border-t border-muted", entering && "animate-hero-row")}
          style={{ animationDelay: `${CONTROLS_DELAY}ms` }}
        />

        <div
          className={cn("flex w-[clamp(170px,15vw,240px)] flex-col gap-[clamp(12px,min(1vw,1.778svh),18px)]", entering && "animate-hero-row")}
          style={{ animationDelay: `${CONTROLS_DELAY}ms` }}
        >
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

      {/* ── Right: hero figure stage (desktop only) ──
          One fixed-geometry stage. Every length inside is in --hf-u = 1svh
          (see figure-geometry.ts), so the figure scales with viewport height and
          never shrinks with width; at 16:9 this equals the legacy vw sizing
          exactly. The left edge is right-anchored until that would cross the
          legacy 35% line, then pins there — on ultrawide the extra width
          becomes gutter, on narrow landscape the figure stays at the hairline
          and clips off the right edge. Lattice, hairline, and caption are all
          children in the same unit, so they can never shear apart. The stage
          stays overflow-visible (the hairline sits left of its edge); the
          section root's overflow-hidden does the clipping. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 hidden md:block"
        style={{ "--hf-u": HF_UNIT, left: STAGE_LEFT_CSS, width: u(STAGE_W_U) } as CSSProperties}
      >
        <HeroFigure />
        {/* Hairline in the cream gutter just left of the lattice, parallel to
            its columns (both rotated −18°). */}
        <div
          className={cn("absolute top-0 h-[140%] w-px bg-surface-border", entering && "animate-hero-row")}
          style={{ left: u(HAIRLINE_LEFT_U), transformOrigin: "top left", transform: "rotate(-18deg)", animationDelay: `${CAPTION_DELAY}ms` }}
        />
        {/* 72° ≈ 90 − 18°: runs parallel to the figure's lattice axis. */}
        <span
          className={cn("absolute origin-left font-mono text-[clamp(11px,min(1.1vw,1.956svh),15px)] text-muted", entering && "animate-hero-row")}
          style={{ left: u(CAPTION_LEFT_U), top: u(CAPTION_TOP_U), transform: "rotate(72deg)", animationDelay: `${CAPTION_DELAY}ms` }}
        >
          hero fig., abstract viridis logit lens
        </span>
      </div>
    </div>
  );
}
