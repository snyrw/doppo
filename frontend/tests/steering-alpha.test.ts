import { describe, it, expect } from "vitest";
import {
  ALPHA_MAX, ALPHA_MIN, ALPHA_STEP,
  canStep, displayPrompt, formatAlpha, stepAlpha,
} from "../app/components/steering-alpha";

/* The column-geometry suites that used to live here are gone with the functions
   they covered. The body's split is CSS's now — the columns take 1fr each of
   what the band's flex distribution leaves — so there is nothing left to assert
   in a node environment, and re-deriving the split here would rebuild in the
   test suite exactly the mirror that was deleted from the source.

   The columns are verified where they are actually computed: in a browser,
   measured through /tutorial. See .claude/rules/card-chrome.md. */

describe("stepAlpha", () => {
  it("moves one step in the given direction", () => {
    expect(stepAlpha(1, 1)).toBe(1.25);
    expect(stepAlpha(1, -1)).toBe(0.75);
  });

  it("clamps at both bounds", () => {
    expect(stepAlpha(ALPHA_MAX, 1)).toBe(ALPHA_MAX);
    expect(stepAlpha(ALPHA_MIN, -1)).toBe(ALPHA_MIN);
  });

  it("does not drift over a long walk — 0.25 is binary-exact", () => {
    let a = 0;
    for (let i = 0; i < 32; i++) a = stepAlpha(a, 1);
    expect(a).toBe(ALPHA_MAX);
  });

  it("keeps the full range the slider had reachable", () => {
    expect(ALPHA_MIN).toBe(-8);
    expect(ALPHA_MAX).toBe(8);
    expect(ALPHA_STEP).toBe(0.25);
  });
});

describe("canStep", () => {
  it("is false only at the bound it would cross", () => {
    expect(canStep(ALPHA_MAX, 1)).toBe(false);
    expect(canStep(ALPHA_MAX, -1)).toBe(true);
    expect(canStep(ALPHA_MIN, -1)).toBe(false);
    expect(canStep(ALPHA_MIN, 1)).toBe(true);
  });
});

describe("formatAlpha", () => {
  it("always shows a sign and two decimals", () => {
    expect(formatAlpha(1)).toBe("+1.00");
    expect(formatAlpha(-1)).toBe("-1.00");
    expect(formatAlpha(0)).toBe("+0.00");
    expect(formatAlpha(0.25)).toBe("+0.25");
  });

  it("never renders negative zero", () => {
    expect(formatAlpha(-0)).toBe("+0.00");
  });
});

describe("displayPrompt", () => {
  it("prefers the generation prompt — it produced both columns", () => {
    expect(displayPrompt("Le président", "clean")).toBe("Le président");
  });

  it("falls back to the DIM clean prompt when absent or blank", () => {
    expect(displayPrompt(undefined, "clean")).toBe("clean");
    expect(displayPrompt("", "clean")).toBe("clean");
    expect(displayPrompt("   ", "clean")).toBe("clean");
  });
});
