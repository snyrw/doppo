import { describe, it, expect } from "vitest";
import { resolve } from "path";
import { slugify, extractHeadings, loadDocSections } from "../app/lib/docs";

const FIXTURES = resolve(__dirname, "fixtures/docs");

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Credits and Pricing")).toBe("credits-and-pricing");
  });
  it("strips punctuation and trims hyphens", () => {
    expect(slugify("Models & GPU tiers")).toBe("models-gpu-tiers");
  });
});

describe("extractHeadings", () => {
  it("finds h2 headings with slug ids", () => {
    const body = "intro\n\n## First Topic\n\ntext\n\n## Second Topic\n";
    expect(extractHeadings(body)).toEqual([
      { text: "First Topic", id: "first-topic" },
      { text: "Second Topic", id: "second-topic" },
    ]);
  });
  it("ignores h3 and deeper", () => {
    expect(extractHeadings("### Deep\n\ntext")).toEqual([]);
  });
});

describe("loadDocSections", () => {
  it("loads sections in filename order with titles, slugs, and headings", () => {
    const sections = loadDocSections(FIXTURES);
    expect(sections.map(s => s.title)).toEqual(["Alpha Section", "Beta Section"]);
    expect(sections[0].slug).toBe("alpha-section");
    expect(sections[0].headings.map(h => h.id)).toEqual(["first-topic", "second-topic"]);
    expect(sections[1].headings).toEqual([]);
    expect(sections[0].body).toContain("Intro paragraph.");
    expect(sections[0].body).not.toContain("title:");
  });
});

describe("real docs content", () => {
  it("loads with unique anchors and expected sections", () => {
    const sections = loadDocSections(resolve(__dirname, "../app/docs/content"));
    expect(sections.map(s => s.slug)).toEqual([
      "overview",
      "techniques",
      "models-and-gpu-tiers",
      "credits-and-pricing",
      "caching-and-sharing",
      "limits",
      "contact",
    ]);
  });
});
