import { describe, it, expect } from "vitest";
import { parseModelMeta, nameCarriesParams, formatModelMeta } from "../app/components/configledger/model-row";

describe("parseModelMeta", () => {
  it("reads company, params and layers from the params-shaped description", () => {
    // Only the 4 GPT-2 entries end in params.
    expect(parseModelMeta("OpenAI · 12 layers · 117M params")).toEqual({
      company: "OpenAI",
      params: "117M",
      layers: "12",
    });
  });

  it("reads company and layers from the ctx-shaped description", () => {
    // The other 16 end in context length, so params is absent here and comes
    // from display_name instead.
    expect(parseModelMeta("Meta · 32 layers · 8K ctx")).toEqual({
      company: "Meta",
      params: null,
      layers: "32",
    });
  });

  it("does not mistake a context length for a param count", () => {
    // "128K ctx" and "117M params" are both <number><unit><word>. Without the
    // trailing `params` anchor, ctx would be read as the model's size.
    expect(parseModelMeta("Alibaba · 28 layers · 128K ctx").params).toBeNull();
  });

  it("handles a decimal param count and a three-digit layer count", () => {
    expect(parseModelMeta("OpenAI · 48 layers · 1.5B params").params).toBe("1.5B");
    expect(parseModelMeta("Meta · 80 layers · 128K ctx").layers).toBe("80");
  });

  it("requires the layer segment to be exactly '<n> layers'", () => {
    // Guards the regex's anchors: an unanchored version would match these.
    expect(parseModelMeta("Meta · about 32 layers deep · 8K ctx").layers).toBeNull();
    expect(parseModelMeta("Meta · 32 layerspeak · 8K ctx").layers).toBeNull();
  });

  it("degrades rather than throwing on an unexpected shape", () => {
    // description is editorial copy in backend/config.py, not a validated
    // contract — a future entry can be written any way at all.
    expect(parseModelMeta("")).toEqual({ company: "", params: null, layers: null });
    expect(parseModelMeta("Anthropic")).toEqual({ company: "Anthropic", params: null, layers: null });
    expect(() => parseModelMeta("a-b-c, no separator at all")).not.toThrow();
    expect(() => parseModelMeta(" · ")).not.toThrow();
  });
});

describe("nameCarriesParams", () => {
  it("is true for the 16 entries written with a size parenthetical", () => {
    expect(nameCarriesParams("Llama 3 (8B)")).toBe(true);
    expect(nameCarriesParams("Qwen3 (0.6B)")).toBe(true);
    expect(nameCarriesParams("Llama 3.3 Instruct (70B)")).toBe(true);
  });

  it("is false for the four GPT-2 entries", () => {
    expect(nameCarriesParams("GPT-2 Small")).toBe(false);
    expect(nameCarriesParams("GPT-2 XL")).toBe(false);
  });

  it("does not mistake a non-size parenthetical for a size", () => {
    // Without the [MB] digit guard, "(Instruct)" would read as a param count
    // and the row would silently lose its size.
    expect(nameCarriesParams("Some Model (Instruct)")).toBe(false);
    expect(nameCarriesParams("Some Model (v2)")).toBe(false);
  });
});

describe("formatModelMeta", () => {
  it("adds params when the name does not carry it", () => {
    expect(formatModelMeta("OpenAI · 12 layers · 117M params", "GPT-2 Small", "tl_small"))
      .toBe("OpenAI · 117M · 12L · L4");
  });

  it("omits params when the name already carries it", () => {
    // Params appears exactly once per row. Always rendering it here would
    // duplicate it on 16 of the 20 featured models.
    expect(formatModelMeta("Meta · 32 layers · 8K ctx", "Llama 3 (8B)", "tl_medium"))
      .toBe("Meta · 32L · L40S");
  });

  it("resolves the GPU tier through TIER_LABELS, not a local table", () => {
    expect(formatModelMeta("Meta · 80 layers · 128K ctx", "Llama 3.3 Instruct (70B)", "tl_xxlarge"))
      .toBe("Meta · 80L · B200");
    expect(formatModelMeta("Alibaba · 40 layers · 128K ctx", "Qwen3 (14B)", "tl_large"))
      .toBe("Alibaba · 40L · A100-80GB");
  });

  it("omits the GPU field entirely for an unknown or missing tier", () => {
    expect(formatModelMeta("Meta · 32 layers · 8K ctx", "Llama 3 (8B)")).toBe("Meta · 32L");
    expect(formatModelMeta("Meta · 32 layers · 8K ctx", "Llama 3 (8B)", "tl_bogus"))
      .toBe("Meta · 32L");
  });

  it("degrades to whatever it has", () => {
    expect(formatModelMeta("Anthropic", "Some Model")).toBe("Anthropic");
    expect(formatModelMeta("", "Some Model")).toBe("");
  });

  it("stays inside the one-line budget for the widest featured entry", () => {
    // Widest meta in the real set. Longest name is 24 chars; 24 + this is
    // ~238px at 11px/10px type, inside a 389px single column. It does NOT fit
    // the old 180px 2-up cell — that is why the grid went one column.
    const widest = formatModelMeta("OpenAI · 12 layers · 117M params", "GPT-2 Small", "tl_small");
    expect(widest.length).toBeLessThanOrEqual(25);
  });
});
