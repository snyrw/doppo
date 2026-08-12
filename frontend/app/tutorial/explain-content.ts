import type { TutorialStep } from "./steps";
import type { InfoSection } from "../components/card-info-content";
import type { AnyCard } from "../components/SandboxCanvas";

/** Turns one technique's tutorial copy into CardExplain's section list. */
export function explainSectionsFor(step: TutorialStep): InfoSection[] {
  const sections: InfoSection[] = [];

  for (const p of step.paragraphs) {
    if (typeof p === "string") sections.push({ kind: "prose", text: p });
    // The panel has no image rendering, so an image paragraph degrades to
    // its alt text rather than silently vanishing along with whatever the
    // next paragraph says about it.
    else sections.push({ kind: "prose", text: p.alt });
  }

  if (step.whatToNotice) sections.push({ kind: "text", label: "What to notice", value: step.whatToNotice });
  if (step.caveat) sections.push({ kind: "text", label: "Caveat", value: step.caveat });
  if (step.links.length > 0) sections.push({ kind: "links", links: step.links });

  return sections;
}

/** Explanation sections for every technique, keyed by card type. */
export function explainSectionsByCardType(
  steps: TutorialStep[],
): Partial<Record<AnyCard["cardType"], InfoSection[]>> {
  const map: Partial<Record<AnyCard["cardType"], InfoSection[]>> = {};
  for (const step of steps) {
    if (step.cardType) map[step.cardType] = explainSectionsFor(step);
  }
  return map;
}
