"use client";

import EyebrowNav from "../EyebrowNav";
import type { SectionProps } from "../deck/sections";

// Shared stub for not-yet-built sections (pricing, self-hosting). Fills the
// viewport so navigation is testable end-to-end; real content lands later.
export default function PlaceholderSection({ label }: SectionProps) {
  return (
    <div className="flex h-full flex-col justify-center px-[clamp(28px,6vw,96px)]">
      <div className="mb-[clamp(30px,4.5vw,58px)]">
        <EyebrowNav />
      </div>
      <h2 className="m-0 font-display text-[clamp(28px,4vw,48px)] font-normal text-accent">
        {label}
      </h2>
      <p className="mt-4 font-mono text-[clamp(11px,1.1vw,15px)] text-muted">coming soon</p>
    </div>
  );
}
