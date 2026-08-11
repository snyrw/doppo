import { describe, it, expect } from "vitest";
import { infoSectionsFor, type InfoRow, type InfoSection } from "../app/components/card-info-content";
import type { AnyCard } from "../app/components/SandboxCanvas";

const base = {
  id: "c1",
  status: "result" as const,
  position: { x: 0, y: 0 },
  error: null,
  gpuTier: "tl_small",
};

/** Flattens every params section into a { label: value } map. */
const params = (s: InfoSection[]): Record<string, string> =>
  Object.fromEntries(
    s.flatMap(x => (x.kind === "params" ? x.rows : ([] as InfoRow[])))
      .map(r => [r.label, r.value]),
  );

const kinds = (s: InfoSection[]) => s.map(x => x.kind);

describe("infoSectionsFor — universal sections", () => {
  it("leads with identity carrying the technique name and tier label", () => {
    const card = { ...base, cardType: "logit-lens", modelName: "gpt2", prompt: "hi", data: null, topK: 5 } as unknown as AnyCard;
    const [first] = infoSectionsFor(card);
    expect(first).toEqual({ kind: "identity", technique: "logit lens", tier: "tl_small" });
  });

  it("reports a null tier rather than omitting identity when the tier is unknown", () => {
    const card = { ...base, gpuTier: undefined, cardType: "logit-lens", modelName: "gpt2", prompt: "hi", data: null } as unknown as AnyCard;
    const [first] = infoSectionsFor(card);
    expect(first).toEqual({ kind: "identity", technique: "logit lens", tier: null });
  });

  it("carries the model and the full untruncated prompt", () => {
    const long = "x".repeat(400);
    const card = { ...base, cardType: "logit-lens", modelName: "openai-community/gpt2", prompt: long, data: null } as unknown as AnyCard;
    const sections = infoSectionsFor(card);
    expect(sections).toContainEqual({ kind: "text", label: "Model", value: "openai-community/gpt2" });
    expect(sections).toContainEqual({ kind: "text", label: "Prompt", value: long });
  });

  it("renders during loading, when the card has no data at all", () => {
    const card = { ...base, status: "loading", cardType: "attention-pattern", modelName: "gpt2", prompt: "hi", data: null } as unknown as AnyCard;
    const sections = infoSectionsFor(card);
    expect(kinds(sections)).toContain("identity");
    expect(sections).toContainEqual({ kind: "text", label: "Model", value: "gpt2" });
  });
});

describe("infoSectionsFor — activation identity", () => {
  it("names activation patching, not the shared patching technique", () => {
    const card = {
      ...base, cardType: "activation", modelName: "gpt2", cleanPrompt: "hi",
      k: 10, parentAttributionId: "a1", targetToken: " Paris", contrastiveToken: " London",
      data: { total_diff: 1.5, components: [] },
    } as unknown as AnyCard;
    const [first] = infoSectionsFor(card);
    expect(first).toMatchObject({ kind: "identity", technique: "activation patching" });
  });

  it("carries k and the parent attribution id", () => {
    const card = {
      ...base, cardType: "activation", modelName: "gpt2", cleanPrompt: "hi",
      k: 5, parentAttributionId: "a1", targetToken: null, contrastiveToken: null,
      data: { total_diff: 1.5, components: [] },
    } as unknown as AnyCard;
    expect(params(infoSectionsFor(card))).toMatchObject({ "Components patched": "5" });
  });
});

describe("infoSectionsFor — attention", () => {
  const attnData = { tokens: [], patterns: [], n_layers: 12, n_heads: 12 };

  it("warns about truncation when the payload says so", () => {
    const card = {
      ...base, cardType: "attention-pattern", modelName: "gpt2", prompt: "hi",
      data: { ...attnData, truncated: true },
    } as unknown as AnyCard;
    expect(infoSectionsFor(card)).toContainEqual({
      kind: "warning", text: "Truncated to the first 30 tokens of the prompt.",
    });
  });

  it("omits the warning when nothing was truncated", () => {
    const card = {
      ...base, cardType: "attention-pattern", modelName: "gpt2", prompt: "hi",
      data: { ...attnData, truncated: false },
    } as unknown as AnyCard;
    expect(kinds(infoSectionsFor(card))).not.toContain("warning");
  });

  it("reports the model shape", () => {
    const card = {
      ...base, cardType: "attention-pattern", modelName: "gpt2", prompt: "hi",
      data: { ...attnData, truncated: false },
    } as unknown as AnyCard;
    expect(params(infoSectionsFor(card))).toMatchObject({ Layers: "12", Heads: "12" });
  });
});

describe("infoSectionsFor — attribution", () => {
  it("labels both prompts distinctly", () => {
    const card = {
      ...base, cardType: "attribution", modelName: "gpt2",
      cleanPrompt: "John gave", corruptedPrompt: "Mary gave",
      targetPosition: "last", targetToken: " Mary", contrastiveToken: " John", data: null,
    } as unknown as AnyCard;
    const sections = infoSectionsFor(card);
    expect(sections).toContainEqual({ kind: "text", label: "Clean prompt", value: "John gave" });
    expect(sections).toContainEqual({ kind: "text", label: "Corrupted prompt", value: "Mary gave" });
  });
});

describe("infoSectionsFor — steering", () => {
  const steering = {
    ...base, cardType: "steering", modelName: "llama",
    cleanPrompt: "en", corruptedPrompt: "fr", generationPrompt: "Once",
    targetPosition: "last", targetToken: null,
    components: [{ layer: 16 }], alpha: 1, temperature: 0.7,
    repetitionPenalty: 1.3, nTokens: 50, nPairs: 3,
    data: { steered_text: "", baseline_text: "", top_k_steered: [], top_k_baseline: [], logit_diff: 2.5 },
  } as unknown as AnyCard;

  it("carries the generation parameters", () => {
    expect(params(infoSectionsFor(steering))).toMatchObject({
      Layers: "L16", Pairs: "3", "Max tokens": "50",
      Temperature: "0.7", "Repetition penalty": "1.30",
    });
  });

  it("labels the DIM pair separately from the generation prompt", () => {
    const sections = infoSectionsFor(steering);
    expect(sections).toContainEqual({ kind: "text", label: "Generation prompt", value: "Once" });
    expect(sections).toContainEqual({ kind: "text", label: "DIM clean", value: "en" });
    expect(sections).toContainEqual({ kind: "text", label: "DIM corrupted", value: "fr" });
  });

  it("is the richest card and attention the thinnest", () => {
    const attention = {
      ...base, cardType: "attention-pattern", modelName: "gpt2", prompt: "hi",
      data: { tokens: [], patterns: [], n_layers: 12, n_heads: 12, truncated: false },
    } as unknown as AnyCard;
    expect(infoSectionsFor(steering).length).toBeGreaterThan(infoSectionsFor(attention).length);
  });
});

describe("infoSectionsFor — timing", () => {
  it("reports duration when both timestamps are present", () => {
    const card = {
      ...base, cardType: "logit-lens", modelName: "gpt2", prompt: "hi", data: null,
      startedAt: 1000, finishedAt: 3400, cached: false,
    } as unknown as AnyCard;
    expect(params(infoSectionsFor(card))).toMatchObject({ Duration: "2.4s" });
  });

  it("says cached instead of a duration when the result came from cache", () => {
    const card = {
      ...base, cardType: "logit-lens", modelName: "gpt2", prompt: "hi", data: null,
      startedAt: 1000, finishedAt: 1050, cached: true,
    } as unknown as AnyCard;
    expect(params(infoSectionsFor(card))).toMatchObject({ Duration: "cached" });
  });

  it("omits duration entirely on rows saved before the fields existed", () => {
    const card = {
      ...base, cardType: "logit-lens", modelName: "gpt2", prompt: "hi", data: null,
    } as unknown as AnyCard;
    expect(params(infoSectionsFor(card))).not.toHaveProperty("Duration");
  });
});
