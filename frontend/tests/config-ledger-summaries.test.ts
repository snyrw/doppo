import { describe, it, expect } from "vitest";
import {
  ellipsize, promptSummary, positionSummary, targetTokenSummary,
  targetSummary, injectionSummary, generationSummary, decodingSummary, modelSummary,
} from "../app/components/configledger/summaries";

describe("ellipsize", () => {
  it("passes short text through", () => {
    expect(ellipsize("hello", 32)).toBe("hello");
  });
  it("truncates with an ellipsis at the cap", () => {
    expect(ellipsize("abcdefghij", 5)).toBe("abcd…");
  });
});

describe("promptSummary", () => {
  it("quotes and ellipsizes", () => {
    expect(promptSummary("The Eiffel Tower is", 10)).toBe('"The Eiff…"');
  });
  it("reports empty prompts", () => {
    expect(promptSummary("   ")).toBe("empty");
  });
});

describe("positionSummary", () => {
  it("last mode", () => expect(positionSummary("last", "")).toBe("last"));
  it("custom mode", () => expect(positionSummary("custom", "3")).toBe("pos 3"));
  it("custom without a value falls back to last", () => expect(positionSummary("custom", "")).toBe("last"));
});

describe("targetTokenSummary", () => {
  it("auto", () => expect(targetTokenSummary("auto", "")).toBe("auto"));
  it("custom", () => expect(targetTokenSummary("custom", " Paris")).toBe('" Paris"'));
});

describe("targetSummary", () => {
  it("joins position and token, appends contrastive", () => {
    expect(targetSummary({
      positionMode: "last", customPosition: "", tokenMode: "auto", customToken: "", contrastiveToken: " Berlin",
    })).toBe('last · auto · vs " Berlin"');
  });
  it("omits contrastive when blank", () => {
    expect(targetSummary({
      positionMode: "custom", customPosition: "5", tokenMode: "custom", customToken: " Paris", contrastiveToken: "",
    })).toBe('pos 5 · " Paris"');
  });
});

describe("injectionSummary", () => {
  it("formats a layer", () => expect(injectionSummary("12")).toBe("L12"));
  it("reports auto when blank", () => expect(injectionSummary("")).toBe("layer auto"));
});

describe("generationSummary", () => {
  it("formats temp and rep penalty", () => expect(generationSummary(1, 1.3)).toBe("T 1.0 · rep 1.3"));
});

describe("decodingSummary", () => {
  it("formats top-k", () => expect(decodingSummary(5)).toBe("top-5"));
});

describe("modelSummary", () => {
  it("passes a name through", () => expect(modelSummary("Gemma 2 (2B)")).toBe("Gemma 2 (2B)"));
  it("reports no model", () => expect(modelSummary(null)).toBe("no model"));
});
