"use client";

import { cn } from "../../lib/cn";
import EyebrowNav from "../EyebrowNav";
import { useSectionEntrance } from "../deck/DeckContext";

// Blank "what doppo is" section — minimal entrance (heading + hairline) so the
// fade-out → entrance-replay mechanism is visibly working. Real copy lands later.
export default function WhatDoppoIs() {
  const entering = useSectionEntrance();
  return (
    <div className="flex h-full flex-col justify-center px-[clamp(28px,6vw,96px)]">
      <div className={cn("mb-[clamp(30px,4.5vw,58px)]", entering && "animate-hero-row")}>
        <EyebrowNav />
      </div>
      <h2
        className={cn(
          "m-0 font-display text-[clamp(34px,5vw,58px)] font-normal text-accent",
          entering && "animate-hero-word",
        )}
      >
        what doppo is
      </h2>
      <hr
        className={cn(
          "mt-[clamp(24px,3vw,44px)] w-full border-0 border-t border-muted",
          entering && "animate-hero-row",
        )}
      />
    </div>
  );
}
