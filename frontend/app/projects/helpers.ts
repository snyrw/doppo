import { CARD_MAX_H, CARD_MAX_W } from "../components/CardShell";
import type { AnyCard } from "./types";

export const CARD_COL_WIDTH = CARD_MAX_W;
export const CARD_ROW_HEIGHT = CARD_MAX_H;
export const GRID_MARGIN = 40;

export function autoArrangePos(index: number): { x: number; y: number } {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return {
    x: GRID_MARGIN + col * (CARD_COL_WIDTH + GRID_MARGIN),
    y: GRID_MARGIN + row * (CARD_ROW_HEIGHT + GRID_MARGIN),
  };
}

// Find the first grid position not visually occupied by any existing card.
// Checked against estimated bounding boxes so two rapid spawns never land
// on top of each other even if stateRef hasn't flushed yet.
export function findSpawnPos(cards: { position: { x: number; y: number } }[]): { x: number; y: number } {
  for (let i = 0; i < 200; i++) {
    const candidate = autoArrangePos(i);
    const clear = cards.every(
      c =>
        Math.abs(c.position.x - candidate.x) >= CARD_COL_WIDTH ||
        Math.abs(c.position.y - candidate.y) >= CARD_ROW_HEIGHT
    );
    if (clear) return candidate;
  }
  const maxY = cards.reduce((m, c) => Math.max(m, c.position.y), 0);
  return { x: GRID_MARGIN, y: maxY + CARD_ROW_HEIGHT + GRID_MARGIN };
}

export function serializeCard(c: AnyCard) {
  /* What every branch writes regardless of card type. */
  const common = {
    id: c.id,
    modelName: c.modelName,
    position: c.position,
    gpuTier: c.gpuTier,
    finishedAt: c.finishedAt,
    cached: c.cached,
  };

  if (c.cardType === "dla") {
    return { ...common, cardType: "dla" as const, prompt: c.prompt, data: c.data as Record<string, unknown>, targetPosition: c.targetPosition, targetToken: c.targetToken, contrastiveToken: c.contrastiveToken };
  }
  if (c.cardType === "attribution") {
    return { ...common, cardType: "attribution" as const, prompt: c.cleanPrompt, corruptedPrompt: c.corruptedPrompt, data: c.data as Record<string, unknown>, targetPosition: c.targetPosition, targetToken: c.targetToken, contrastiveToken: c.contrastiveToken };
  }
  if (c.cardType === "activation") {
    return { ...common, cardType: "activation" as const, prompt: c.cleanPrompt, data: c.data as Record<string, unknown>, parentAttributionId: c.parentAttributionId, k: c.k, targetToken: c.targetToken, contrastiveToken: c.contrastiveToken };
  }
  if (c.cardType === "steering") {
    return { ...common, cardType: "steering" as const, prompt: c.cleanPrompt, corruptedPrompt: c.corruptedPrompt, generationPrompt: c.generationPrompt, data: c.data as Record<string, unknown>, targetPosition: c.targetPosition, targetToken: c.targetToken, components: c.components, alpha: c.alpha, temperature: c.temperature, repetitionPenalty: c.repetitionPenalty, nTokens: c.nTokens, nPairs: c.nPairs, extraPairs: c.extraPairs ?? [] };
  }
  if (c.cardType === "attention-pattern") {
    // Pattern data is already cached separately (attnCache/R2) and is large
    // enough to blow project-save size limits on bigger models, so store the
    // reference and omit the blob when we have one. Falls back to the full
    // inline data if no cacheKey came back, so the card still saves either way.
    return c.cacheKey
      ? { ...common, cardType: "attention-pattern" as const, prompt: c.prompt, data: {} as Record<string, unknown>, cacheKey: c.cacheKey }
      : { ...common, cardType: "attention-pattern" as const, prompt: c.prompt, data: c.data as Record<string, unknown> };
  }
  return { ...common, cardType: "logit-lens" as const, prompt: c.prompt, data: c.data as Record<string, unknown>, topK: c.topK };
}

export function getCardPrompt(c: AnyCard): string {
  if (c.cardType === "attribution" || c.cardType === "activation" || c.cardType === "steering") return c.cleanPrompt;
  return c.prompt;
}
