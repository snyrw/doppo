// frontend/tests/helpers.test.ts
import { describe, it, expect } from "vitest";
import {
  autoArrangePos, findSpawnPos, getCardPrompt, serializeCard,
  CARD_COL_WIDTH, CARD_ROW_HEIGHT, GRID_MARGIN,
} from "../app/projects/helpers";
import type { AnyCard } from "../app/components/SandboxCanvas";

// Previously re-declared here and "kept in sync manually", which silently rotted
// when the lattice moved to the card size bounds. Imported now.

describe("autoArrangePos", () => {
  it("index 0 → top-left cell", () => {
    expect(autoArrangePos(0)).toEqual({ x: GRID_MARGIN, y: GRID_MARGIN });
  });

  it("index 1 → second column, same row", () => {
    expect(autoArrangePos(1)).toEqual({ x: GRID_MARGIN + CARD_COL_WIDTH + GRID_MARGIN, y: GRID_MARGIN });
  });

  it("index 2 → third column", () => {
    expect(autoArrangePos(2)).toEqual({ x: GRID_MARGIN + 2 * (CARD_COL_WIDTH + GRID_MARGIN), y: GRID_MARGIN });
  });

  it("index 3 → wraps to second row, first column", () => {
    expect(autoArrangePos(3)).toEqual({ x: GRID_MARGIN, y: GRID_MARGIN + CARD_ROW_HEIGHT + GRID_MARGIN });
  });

  it("index 6 → third row, first column", () => {
    expect(autoArrangePos(6)).toEqual({ x: GRID_MARGIN, y: GRID_MARGIN + 2 * (CARD_ROW_HEIGHT + GRID_MARGIN) });
  });
});

describe("findSpawnPos", () => {
  it("empty canvas → position 0", () => {
    expect(findSpawnPos([])).toEqual({ x: GRID_MARGIN, y: GRID_MARGIN });
  });

  it("position 0 occupied → returns position 1", () => {
    const existing = [{ position: autoArrangePos(0) }];
    expect(findSpawnPos(existing)).toEqual(autoArrangePos(1));
  });

  it("positions 0 and 1 occupied → returns position 2", () => {
    const existing = [{ position: autoArrangePos(0) }, { position: autoArrangePos(1) }];
    expect(findSpawnPos(existing)).toEqual(autoArrangePos(2));
  });

  it("overflow fallback when all 200 grid slots are occupied", () => {
    const cards = Array.from({ length: 200 }, (_, i) => ({ position: autoArrangePos(i) }));
    const result = findSpawnPos(cards);
    const maxY = Math.max(...cards.map((c) => c.position.y));
    expect(result.x).toBe(GRID_MARGIN);
    expect(result.y).toBe(maxY + CARD_ROW_HEIGHT + GRID_MARGIN);
  });
});

describe("getCardPrompt", () => {
  it("logit-lens → prompt", () => {
    expect(getCardPrompt({ cardType: "logit-lens", prompt: "hello" } as unknown as AnyCard)).toBe("hello");
  });

  it("dla → prompt", () => {
    expect(getCardPrompt({ cardType: "dla", prompt: "dla prompt" } as unknown as AnyCard)).toBe("dla prompt");
  });

  it("attention-pattern → prompt", () => {
    expect(getCardPrompt({ cardType: "attention-pattern", prompt: "attn" } as unknown as AnyCard)).toBe("attn");
  });

  it("attribution → cleanPrompt", () => {
    expect(
      getCardPrompt({ cardType: "attribution", cleanPrompt: "clean", corruptedPrompt: "corrupt" } as unknown as AnyCard)
    ).toBe("clean");
  });

  it("activation → cleanPrompt", () => {
    expect(getCardPrompt({ cardType: "activation", cleanPrompt: "activate" } as unknown as AnyCard)).toBe("activate");
  });

  it("steering → cleanPrompt", () => {
    expect(getCardPrompt({ cardType: "steering", cleanPrompt: "steer" } as unknown as AnyCard)).toBe("steer");
  });
});

describe("serializeCard", () => {
  it("logit-lens card serializes correctly", () => {
    const card = {
      id: "c1",
      cardType: "logit-lens" as const,
      modelName: "gpt2-small",
      prompt: "hello world",
      data: null,
      position: { x: 40, y: 40 },
      gpuTier: "tl_small",
      topK: 5,
      status: "result" as const,
    };
    const result = serializeCard(card as unknown as AnyCard);
    expect(result.id).toBe("c1");
    expect(result.cardType).toBe("logit-lens");
    expect(result.prompt).toBe("hello world");
    expect((result as Record<string, unknown>).topK).toBe(5);
  });

  it("attribution card maps cleanPrompt → prompt and preserves corruptedPrompt", () => {
    const card = {
      id: "c2",
      cardType: "attribution" as const,
      modelName: "gpt2-small",
      cleanPrompt: "The cat",
      corruptedPrompt: "The dog",
      data: null,
      position: { x: 40, y: 40 },
      gpuTier: "tl_small",
      targetPosition: 2,
      targetToken: "cat",
      contrastiveToken: "dog",
      status: "result" as const,
    };
    const result = serializeCard(card as unknown as AnyCard);
    expect(result.cardType).toBe("attribution");
    expect(result.prompt).toBe("The cat");
    expect((result as Record<string, unknown>).corruptedPrompt).toBe("The dog");
  });

  it("activation card persists its token pair and k", () => {
    const card = {
      id: "a1",
      cardType: "activation" as const,
      modelName: "gpt2-small",
      cleanPrompt: "hello world",
      k: 20,
      parentAttributionId: "p1",
      targetToken: " Mary",
      contrastiveToken: " John",
      data: null,
      position: { x: 40, y: 40 },
      gpuTier: "tl_small",
      status: "result" as const,
    };
    const result = serializeCard(card as unknown as AnyCard) as Record<string, unknown>;
    expect(result.prompt).toBe("hello world");
    expect(result.parentAttributionId).toBe("p1");
    expect(result.targetToken).toBe(" Mary");
    expect(result.contrastiveToken).toBe(" John");
    // k was previously dropped, so a card verified at 20 came back claiming 10.
    expect(result.k).toBe(20);
  });

  it("activation card with no contrastive token serializes null, not undefined", () => {
    const card = {
      id: "a2",
      cardType: "activation" as const,
      modelName: "gpt2-small",
      cleanPrompt: "hello",
      k: 10,
      parentAttributionId: "p1",
      targetToken: " Mary",
      contrastiveToken: null,
      data: null,
      position: { x: 0, y: 0 },
      status: "result" as const,
    };
    const result = serializeCard(card as unknown as AnyCard) as Record<string, unknown>;
    expect(result.contrastiveToken).toBeNull();
  });

  it("steering card preserves nPairs and extraPairs", () => {
    const card = {
      id: "c3",
      cardType: "steering" as const,
      modelName: "gpt2-small",
      cleanPrompt: "steer",
      corruptedPrompt: "away",
      generationPrompt: "gen",
      data: null,
      position: { x: 40, y: 40 },
      gpuTier: "tl_small",
      targetPosition: "last",
      targetToken: "x",
      components: [],
      alpha: 1.0,
      nTokens: 50,
      nPairs: 3,
      extraPairs: [{ clean: "a", corrupted: "b" }],
      parentCardId: undefined,
      status: "result" as const,
    };
    const result = serializeCard(card as unknown as AnyCard);
    expect(result.cardType).toBe("steering");
    expect((result as Record<string, unknown>).nPairs).toBe(3);
    expect((result as Record<string, unknown>).extraPairs).toHaveLength(1);
  });

  it("attention-pattern card serializes correctly", () => {
    const card = {
      id: "c5",
      cardType: "attention-pattern" as const,
      modelName: "gpt2-small",
      prompt: "attn prompt",
      data: null,
      position: { x: 40, y: 40 },
      gpuTier: "tl_small",
      status: "result" as const,
    };
    const result = serializeCard(card as unknown as AnyCard);
    expect(result.cardType).toBe("attention-pattern");
    expect(result.prompt).toBe("attn prompt");
  });

  it("attention-pattern card with a cacheKey stores a reference, not the full data blob", () => {
    const card = {
      id: "c6",
      cardType: "attention-pattern" as const,
      modelName: "gpt2-small",
      prompt: "attn prompt",
      data: { tokens: ["a"], patterns: [[[[0.5]]]], n_layers: 1, n_heads: 1, truncated: false },
      position: { x: 40, y: 40 },
      gpuTier: "tl_small",
      status: "result" as const,
      cacheKey: "cache-abc",
    };
    const result = serializeCard(card as unknown as AnyCard);
    expect(result.cardType).toBe("attention-pattern");
    expect((result as { cacheKey?: string }).cacheKey).toBe("cache-abc");
    expect(result.data).toEqual({});
  });
});

describe("serializeCard timing", () => {
  const lens = {
    id: "c1", cardType: "logit-lens", status: "result", modelName: "gpt2",
    prompt: "hi", data: {}, error: null, position: { x: 0, y: 0 },
    gpuTier: "tl_small", topK: 5, startedAt: 1000, finishedAt: 3400, cached: false,
  } as unknown as AnyCard;

  it("round-trips finishedAt and cached", () => {
    expect(serializeCard(lens)).toMatchObject({ finishedAt: 3400, cached: false });
  });

  it("round-trips them on every card type", () => {
    // Regression guard: serializeCard has a branch per card type, and it is easy
    // to add a field to one and miss the other five. The attention branch forks
    // again on cacheKey, so both of its shapes are covered.
    const variants = [
      { cardType: "dla" },
      { cardType: "attribution" },
      { cardType: "activation" },
      { cardType: "steering" },
      { cardType: "attention-pattern" },
      { cardType: "attention-pattern", cacheKey: "abc" },
    ];
    for (const v of variants) {
      const card = {
        ...lens, ...v,
        cleanPrompt: "hi", corruptedPrompt: "there", k: 10, parentAttributionId: "a1",
        components: [{ layer: 16 }], alpha: 1, temperature: 1, repetitionPenalty: 1.3,
        nTokens: 50, nPairs: 1, targetPosition: "last", targetToken: null,
        contrastiveToken: null,
      } as unknown as AnyCard;
      expect(serializeCard(card)).toMatchObject({ finishedAt: 3400, cached: false });
    }
  });

  it("leaves them undefined when the card has never carried them", () => {
    const bare = { ...lens, finishedAt: undefined, cached: undefined } as unknown as AnyCard;
    const out = serializeCard(bare);
    expect(out.finishedAt).toBeUndefined();
    expect(out.cached).toBeUndefined();
  });
});
