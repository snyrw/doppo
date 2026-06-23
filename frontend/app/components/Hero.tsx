"use client";

import { Fragment, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "../lib/auth-client";
import { TactileButton } from "./ui/TactileButton";
import HeroFigure from "./HeroFigure";
import EyebrowNav from "./EyebrowNav";

// Keep the two CTAs dimensionally identical (shared face padding via the tactile vars).
const HERO_BTN_PAD = {
  "--pad-x": "clamp(14px,1.2vw,24px)",
  "--pad-y": "clamp(9px,0.7vw,13px)",
} as CSSProperties;

const HERO_BTN_FACE = "font-mono font-light text-[clamp(13px,1vw,18px)] tracking-[0.01em] justify-start text-muted";

// Entrance choreography (ms). Headline words rise+fade in quick succession, then
// the left-column controls settle, then HeroFigure paints row-by-row (timed in
// HeroFigure itself), and finally the figure's annotations fade up underneath it.
const HEADLINE = "Doppo, a mechanistic interpretability workbench.";
const WORD_STAGGER = 60;
const CONTROLS_DELAY = 380;
const CAPTION_DELAY = 1080;

export default function Hero() {
  const router = useRouter();
  const { data: session } = useSession();

  return (
    <main className="relative grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-[1fr_1.6fr]">
      {/* ── Left: copy + CTAs ── */}
      <div className="flex flex-col justify-center px-[clamp(28px,6vw,96px)]">
        {/* Eyebrow section nav (dummy — clicking lights a section locally; not yet
            wired to routes). Fades in with the headline; reduced-motion shows it
            at full opacity via the .animate-hero-row media query. */}
        <div className="mb-[clamp(30px,4.5vw,58px)] animate-hero-row">
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
            className="pointer-events-none absolute -left-[26px] -top-6 h-[clamp(56px,7vw,96px)] w-[clamp(56px,7vw,96px)] animate-hero-row border-l border-t border-muted"
          />
          <h1 className="m-0 font-display text-[clamp(34px,5vw,58px)] font-normal leading-[1.08] tracking-[-0.01em] text-accent">
            {HEADLINE.split(" ").map((word, i) => (
              <Fragment key={i}>
                <span
                  className="inline-block animate-hero-word"
                  style={{ animationDelay: `${i * WORD_STAGGER}ms` }}
                >
                  {word}
                </span>{" "}
              </Fragment>
            ))}
          </h1>
        </div>

        <hr
          className="my-[clamp(24px,3vw,44px)] w-full border-0 border-t border-muted animate-hero-row"
          style={{ animationDelay: `${CONTROLS_DELAY}ms` }}
        />

        <div
          className="flex w-[clamp(170px,15vw,240px)] flex-col gap-[clamp(12px,1vw,18px)] animate-hero-row"
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

      {/* ── Right: hero figure (desktop only) ──
          Absolutely positioned against <main> with a single left-% knob, rather than
          living in the 1.6fr grid column. The column's overflow:hidden pinned the
          lattice's left edge at the column boundary; positioning it here lets the
          whole grid slide left past that line, clipped only by the viewport. Tweak
          left-[33%] to slide the lattice horizontally. */}
      <div className="absolute inset-y-0 left-[35%] right-0 hidden overflow-hidden md:block">
        <HeroFigure />
      </div>

      {/* Hairline divider + caption in the cream gutter just left of the lattice,
          positioned against <main> in viewport-% and kept ~the same distance left of
          left-[33%] above. Both run parallel to the lattice columns. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[33%] top-0 hidden h-[140%] w-px bg-surface-border md:block animate-hero-row"
        style={{ transformOrigin: "top left", transform: "rotate(-18deg)", animationDelay: `${CAPTION_DELAY}ms` }}
      />
      {/* 73° ≈ 90 − 18°: runs parallel to the figure's lattice axis (HeroFigure is rotated −18°). */}
      <span
        className="pointer-events-none absolute left-[39%] top-[51%] hidden origin-left font-mono text-[clamp(11px,1.1vw,15px)] text-muted md:block animate-hero-row"
        style={{ transform: "rotate(72deg)", animationDelay: `${CAPTION_DELAY}ms` }}
      >
        hero fig., abstract viridis logit lens
      </span>
    </main>
  );
}
