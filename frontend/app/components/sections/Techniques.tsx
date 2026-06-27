"use client";

import { Fragment, useState } from "react";
import { cn } from "../../lib/cn";
import EyebrowNav from "../EyebrowNav";
import { useSectionEntrance } from "../deck/DeckContext";
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
      {/* Diagonal gutter hairline — self-clipping so it never adds scroll.
          Positive rotation about the top-left origin sends the bottom down-LEFT,
          matching the mock's lean. Fades in late, like Hero's caption rule. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden overflow-hidden md:block">
        <div
          className={cn("absolute left-[calc(41%+100px)] top-0 h-[150%] w-px bg-surface-border", entering && "animate-hero-row")}
          style={{ transformOrigin: "top left", transform: "rotate(15deg)", animationDelay: "1080ms" }}
        />
      </div>

      {/* Edge-anchored row: copy capped + pinned left, technique stage capped +
          pinned right; the center gap grows on ultrawide. Below md the stack drops
          under the copy and the section flows (continuous scroll). */}
      <div className="relative flex h-full flex-col justify-center gap-[clamp(24px,4vw,48px)] px-[clamp(28px,6vw,96px)] py-[clamp(48px,8vw,0px)] md:flex-row md:items-center md:justify-between md:gap-[clamp(32px,6vw,160px)] md:py-0">
      {/* ── Left: copy ── */}
      <div className="relative z-10 flex max-w-[600px] flex-col md:flex-1">
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

        {/* ── Right: technique stage (all breakpoints) ──
            .figure-stage gives the stack a container-query context so its cqi font
            cap scales to this column; w-full fills the capped column. Stack drops
            under the copy on mobile and its tap-to-open modal still works. */}
        <div className="figure-stage relative z-10 flex w-full max-w-[760px] items-center justify-center md:flex-1">
          <TechniqueStack className="w-full" onSelect={setSelected} />
        </div>
      </div>

      {selected !== null && (
        <TechniqueCardModal index={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
