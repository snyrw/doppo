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
      <div className="absolute inset-0 hidden overflow-hidden md:block">
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
      <div className="relative z-10 flex h-full max-w-[46vw] flex-col justify-center px-[clamp(28px,6vw,96px)]">
        <div className={cn("mb-[clamp(30px,4.5vw,58px)]", entering && "animate-hero-row")}>
          <EyebrowNav />
        </div>

        <div className="relative">
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute -left-[26px] -top-6 h-[clamp(56px,7vw,96px)] w-[clamp(56px,7vw,96px)] border-l border-t border-muted",
              entering && "animate-hero-row",
            )}
          />
          <h2 className="m-0 font-display text-[clamp(34px,5vw,58px)] font-normal leading-[1.08] tracking-[-0.01em] text-accent">
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
            "mt-[clamp(16px,2vw,28px)] max-w-[30ch] text-[clamp(15px,1.8vw,24px)] leading-[1.4] text-muted",
            entering && "animate-hero-row",
          )}
          style={{ animationDelay: `${CONTROLS_DELAY - 60}ms` }}
        >
          An overview of the techniques that are currently usable in the workbench
        </p>

        <hr
          className={cn(
            "mt-[clamp(24px,3vw,34px)] w-[calc(100%-160px)] border-0 border-t border-muted",
            entering && "animate-hero-row",
          )}
          style={{ animationDelay: `${CONTROLS_DELAY}ms` }}
        />
      </div>

      {selected !== null && (
        <TechniqueCardModal index={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
