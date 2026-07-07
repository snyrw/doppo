"use client";

import { Fragment, useState, type CSSProperties } from "react";
import { cn } from "../../lib/cn";
import EyebrowNav from "../EyebrowNav";
import { useSectionEntrance } from "../deck/DeckContext";
import {
  FIELD_LEFT_CSS, FRAME_W_U, HF_UNIT,
  TECH_HAIRLINE_LEFT_U, TECH_STACK_LEFT_U, TECH_STACK_W_U, u,
} from "../figure-geometry";
import TechniqueStack from "./TechniqueStack";
import TechniqueCardModal from "./TechniqueCardModal";
import { TECHNIQUES } from "./techniqueBars";

// "Techniques" deck section (Figma node 15:483). Left column mirrors the sibling
// "What Doppo is" section — eyebrow nav, registration corner + heading, subtitle,
// hairline — so the deck reads consistently. Right column is the TechniqueStack
// (tilted blank cards under five tactile technique bars). A single diagonal
// hairline runs down the gutter between the two, as in the mock. Entrance reuses
// the hero word/row timings, gated by useSectionEntrance() so it replays on
// activation.
const HEADING = "What Doppo does";
const WORD_STAGGER = 60; // matches Hero
const CONTROLS_DELAY = 380; // matches Hero (hr/subtitle settle)

export default function Techniques() {
  const entering = useSectionEntrance();
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <div className="relative h-full overflow-hidden">
      {/* ── Figure stage: gutter hairline + technique stack (desktop only) ──
          One full-frame stage in --hf-u units (see figure-geometry.ts):
          right-anchored on ultrawide, pinned left and clipped off the right
          below 16:9, never shrinking or shearing. The hairline's positive
          rotation about the top-left origin sends the bottom down-LEFT,
          matching the mock's lean; it fades in late, like Hero's caption rule.
          The stack bleeds across the centerline and just past the right edge
          exactly as in the mock; the wrapper's overflow-hidden clips the
          off-screen-right bleed. */}
      <div className="deck-only absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-y-0"
          style={{ "--hf-u": HF_UNIT, left: FIELD_LEFT_CSS, width: u(FRAME_W_U) } as CSSProperties}
        >
          <div
            aria-hidden
            className={cn("pointer-events-none absolute top-0 h-[150%] w-px bg-surface-border", entering && "animate-hero-row")}
            style={{ left: u(TECH_HAIRLINE_LEFT_U), transformOrigin: "top left", transform: "rotate(15deg)", animationDelay: "1080ms" }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2"
            style={{ left: u(TECH_STACK_LEFT_U), width: u(TECH_STACK_W_U) }}
          >
            <TechniqueStack onSelect={setSelected} />
          </div>
        </div>
      </div>

      {/* ── Left: copy ── */}
      <div className="deck-col-narrow deck-col-pad relative z-10 flex h-full flex-col justify-center">
        <div className={cn("deck-only mb-[clamp(30px,min(4.5vw,8svh),58px)]", entering && "animate-hero-row")}>
          <EyebrowNav />
        </div>

        <div className="relative">
          <span
            aria-hidden
            className={cn(
              "deck-only pointer-events-none absolute -left-[26px] -top-6 h-[clamp(56px,min(7vw,12.444svh),96px)] w-[clamp(56px,min(7vw,12.444svh),96px)] border-l border-t border-muted",
              entering && "animate-hero-row",
            )}
          />
          <h2 className="m-0 font-display text-[clamp(34px,min(5vw,8.889svh),58px)] font-normal leading-[1.08] tracking-[-0.01em] text-accent">
            {HEADING.split(" ").map((word, i) => (
              <Fragment key={i}>
                <span
                  className={cn("inline-block", entering && "animate-hero-word")}
                  style={{ animationDelay: `${i * WORD_STAGGER}ms` }}
                >
                  {word}
                </span>{" "}
              </Fragment>
            ))}
          </h2>
        </div>

        <p
          className={cn(
            "mt-[clamp(16px,min(2vw,3.556svh),28px)] max-w-[30ch] text-[clamp(15px,min(1.8vw,3.2svh),24px)] leading-[1.4] text-muted",
            entering && "animate-hero-row",
          )}
          style={{ animationDelay: `${CONTROLS_DELAY - 60}ms` }}
        >
          An overview of the techniques that are currently usable in the workbench
        </p>

        <hr
          className={cn(
            "deck-hr-inset mt-[clamp(24px,min(3vw,5.333svh),34px)] w-full border-0 border-t border-muted",
            entering && "animate-hero-row",
          )}
          style={{ animationDelay: `${CONTROLS_DELAY}ms` }}
        />

        {/* ── Flow-only: the technique bars as a plain, non-interactive list.
            The deck shows them in the tilted stack figure; flow just needs the
            content, so these reuse the tactile bar look via `tactile--static`
            (no cursor / hover-lift / press-sink) and don't open the modal. ── */}
        <ul className="flow-only mt-[clamp(28px,7vw,44px)] flex list-none flex-col gap-[10px] p-0">
          {TECHNIQUES.map((t) => (
            <li
              key={t.name}
              className="tactile tactile--static mb-0 flex w-full"
              style={{ "--tactile-side": t.shadow } as CSSProperties}
            >
              <span className="tactile__base rounded-[6px]" aria-hidden="true" />
              <span
                className="tactile__face h-11 w-full justify-start rounded-[6px] pl-4"
                style={{ background: t.face }}
              >
                <span className="font-sans text-[15px] font-normal leading-none text-white">
                  {t.name}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {selected !== null && (
        <TechniqueCardModal index={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
