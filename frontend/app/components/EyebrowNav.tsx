"use client";

import { Fragment, useState } from "react";
import { cn } from "../lib/cn";

// Dummy section nav for the landing deck. Clicking lights a section locally so the
// menu can be clicked through for layout testing — not yet wired to routes or page
// content. When the pages are real this lifts into the shared layout and the active
// index becomes route-derived.
const SECTIONS = ["intro", "what doppo is", "pricing", "self-hosting"] as const;

export default function EyebrowNav() {
  const [active, setActive] = useState(0);

  return (
    <nav
      aria-label="Sections"
      className="flex items-stretch font-mono font-light text-[clamp(8px,0.95vw,12px)] leading-none"
    >
      {SECTIONS.map((label, i) => (
        <Fragment key={label}>
          {/* thin vertical rule between items — one hairline weight (surface-border) */}
          {i > 0 && (
            <span aria-hidden className="mx-3 my-[2px] w-px self-stretch bg-surface-border" />
          )}
          <button
            type="button"
            aria-current={i === active ? "page" : undefined}
            onClick={() => setActive(i)}
            className={cn(
              "relative cursor-pointer bg-transparent pb-[5px] tracking-[0.01em] transition-colors",
              i === active ? "text-foreground" : "text-muted hover:text-foreground",
            )}
          >
            {label}
            {/* active state: a single ink underline, matching the line motif */}
            {i === active && (
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-foreground" />
            )}
          </button>
        </Fragment>
      ))}
    </nav>
  );
}
