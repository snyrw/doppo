import { describe, it, expect } from "vitest";
import { explainSectionsFor, explainSectionsByCardType } from "../app/tutorial/explain-content";
import type { TutorialStep } from "../app/tutorial/steps";

const step: TutorialStep = {
  index: 1,
  label: "Logit Lens",
  cardType: "logit-lens",
  heading: "Logit Lens",
  paragraphs: ["First paragraph.", "Second paragraph."],
  whatToNotice: "Watch the rightmost column.",
  caveat: "GPT-2 Small only.",
  links: [{ label: "nostalgebraist 2020", url: "https://example.com/a" }],
};

describe("explainSectionsFor", () => {
  it("turns each string paragraph into its own prose section, in order", () => {
    const sections = explainSectionsFor(step);
    expect(sections.filter(s => s.kind === "prose")).toEqual([
      { kind: "prose", text: "First paragraph." },
      { kind: "prose", text: "Second paragraph." },
    ]);
  });

  it("carries what-to-notice and caveat as labeled text sections", () => {
    const sections = explainSectionsFor(step);
    expect(sections).toContainEqual({ kind: "text", label: "What to notice", value: "Watch the rightmost column." });
    expect(sections).toContainEqual({ kind: "text", label: "Caveat", value: "GPT-2 Small only." });
  });

  it("carries links as a single links section", () => {
    const sections = explainSectionsFor(step);
    expect(sections).toContainEqual({
      kind: "links",
      links: [{ label: "nostalgebraist 2020", url: "https://example.com/a" }],
    });
  });

  it("omits what-to-notice, caveat, and links when absent", () => {
    const bare: TutorialStep = { ...step, whatToNotice: undefined, caveat: undefined, links: [] };
    const kinds = explainSectionsFor(bare).map(s => s.kind);
    expect(kinds).not.toContain("text");
    expect(kinds).not.toContain("links");
  });

  it("skips image paragraphs, the popup is text-only", () => {
    const withImage: TutorialStep = {
      ...step,
      paragraphs: ["Text.", { type: "image", src: "/a.png", alt: "diagram" }],
    };
    expect(explainSectionsFor(withImage).filter(s => s.kind === "prose")).toEqual([
      { kind: "prose", text: "Text." },
    ]);
  });
});

describe("explainSectionsByCardType", () => {
  it("keys the map by each step's cardType", () => {
    const attention: TutorialStep = { ...step, cardType: "attention-pattern", paragraphs: ["Attn."] };
    const map = explainSectionsByCardType([step, attention]);
    expect(map["logit-lens"]).toEqual(explainSectionsFor(step));
    expect(map["attention-pattern"]).toEqual(explainSectionsFor(attention));
  });

  it("skips steps without a cardType", () => {
    const noCardType: TutorialStep = { ...step, cardType: undefined };
    const withCardType: TutorialStep = { ...step, cardType: "logit-lens" };
    const map = explainSectionsByCardType([noCardType, withCardType]);
    expect(Object.keys(map)).toEqual(["logit-lens"]);
  });
});
