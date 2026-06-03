// frontend/tests/helpers.test.ts
import { describe, it, expect } from "vitest";
import { autoArrangePos, findSpawnPos, getCardPrompt, serializeCard } from "../app/projects/helpers";

// Constants from helpers.ts (not exported — kept in sync manually)
const CARD_COL_WIDTH = 380;
const CARD_ROW_HEIGHT = 480;
const GRID_MARGIN = 40;

describe("autoArrangePos", () => {
  it("index 0 → top-left cell", () => {
    expect(autoArrangePos(0)).toEqual({ x: 40, y: 40 });
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
    expect(getCardPrompt({ cardType: "logit-lens", prompt: "hello" } as any)).toBe("hello");
  });

  it("dla → prompt", () => {
    expect(getCardPrompt({ cardType: "dla", prompt: "dla prompt" } as any)).toBe("dla prompt");
  });

  it("attention-pattern → prompt", () => {
    expect(getCardPrompt({ cardType: "attention-pattern", prompt: "attn" } as any)).toBe("attn");
  });

  it("attribution → cleanPrompt", () => {
    expect(
      getCardPrompt({ cardType: "attribution", cleanPrompt: "clean", corruptedPrompt: "corrupt" } as any)
    ).toBe("clean");
  });

  it("activation → cleanPrompt", () => {
    expect(getCardPrompt({ cardType: "activation", cleanPrompt: "activate" } as any)).toBe("activate");
  });

  it("steering → cleanPrompt", () => {
    expect(getCardPrompt({ cardType: "steering", cleanPrompt: "steer" } as any)).toBe("steer");
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
    const result = serializeCard(card as any);
    expect(result.id).toBe("c1");
    expect(result.cardType).toBe("logit-lens");
    expect(result.prompt).toBe("hello world");
    expect((result as any).topK).toBe(5);
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
    const result = serializeCard(card as any);
    expect(result.cardType).toBe("attribution");
    expect(result.prompt).toBe("The cat");
    expect((result as any).corruptedPrompt).toBe("The dog");
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
    const result = serializeCard(card as any);
    expect(result.cardType).toBe("steering");
    expect((result as any).nPairs).toBe(3);
    expect((result as any).extraPairs).toHaveLength(1);
  });

  it("entropy card preserves entropyData and parentLensId", () => {
    const card = {
      id: "c4",
      cardType: "entropy" as const,
      modelName: "gpt2-small",
      prompt: "entropy prompt",
      position: { x: 40, y: 40 },
      parentLensId: "parent-1",
      entropyData: [0.1, 0.2],
      xLabels: ["t1", "t2"],
      yLabels: ["L0", "L1"],
      status: "result" as const,
    };
    const result = serializeCard(card as any);
    expect(result.cardType).toBe("entropy");
    expect((result as any).parentLensId).toBe("parent-1");
    expect((result as any).entropyData).toEqual([0.1, 0.2]);
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
    const result = serializeCard(card as any);
    expect(result.cardType).toBe("attention-pattern");
    expect(result.prompt).toBe("attn prompt");
  });
});
