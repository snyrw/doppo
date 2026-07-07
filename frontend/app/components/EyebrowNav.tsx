"use client";

import { Fragment } from "react";
import { cn } from "../lib/cn";
import { useDeck } from "./deck/DeckContext";

// Section nav, controlled by the Deck. Reads the active index + go() from
// DeckContext and is rendered inside each section, so it re-enters with the page.
export default function EyebrowNav() {
  const { active, go, sections } = useDeck();

  return (
    <nav
      aria-label="Sections"
      className="flex items-stretch font-mono font-light text-[clamp(8px,min(0.95vw,1.689svh),12px)] leading-none"
    >
      {sections.map((section, i) => (
        <Fragment key={section.id}>
          {i > 0 && (
            <span aria-hidden className="mx-3 my-[2px] w-px self-stretch bg-surface-border" />
          )}
          <button
            type="button"
            aria-current={i === active ? "page" : undefined}
            onClick={() => go(i)}
            className={cn(
              "relative cursor-pointer bg-transparent pb-[5px] tracking-[0.01em] transition-colors",
              i === active ? "text-foreground" : "text-muted hover:text-foreground",
            )}
          >
            {section.label}
            {i === active && (
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-foreground" />
            )}
          </button>
        </Fragment>
      ))}
    </nav>
  );
}
