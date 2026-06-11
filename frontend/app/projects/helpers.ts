import type { AnyCard } from "./types";
import type { LensCardData } from "../components/LensCard";
import type { DlaCardData } from "../components/DlaCard";
import type { AttentionCardData } from "../components/AttentionCard";

const CARD_COL_WIDTH = 380;
const CARD_ROW_HEIGHT = 480;
const GRID_MARGIN = 40;

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
  if (c.cardType === "dla") {
    return { id: c.id, cardType: "dla" as const, modelName: c.modelName, prompt: c.prompt, data: c.data as Record<string, unknown>, position: c.position, gpuTier: c.gpuTier, targetPosition: c.targetPosition, targetToken: c.targetToken, contrastiveToken: c.contrastiveToken };
  }
  if (c.cardType === "attribution") {
    return { id: c.id, cardType: "attribution" as const, modelName: c.modelName, prompt: c.cleanPrompt, corruptedPrompt: c.corruptedPrompt, data: c.data as Record<string, unknown>, position: c.position, gpuTier: c.gpuTier, targetPosition: c.targetPosition, targetToken: c.targetToken, contrastiveToken: c.contrastiveToken };
  }
  if (c.cardType === "activation") {
    return { id: c.id, cardType: "activation" as const, modelName: c.modelName, prompt: c.cleanPrompt, data: c.data as Record<string, unknown>, position: c.position, gpuTier: c.gpuTier, parentAttributionId: c.parentAttributionId };
  }
  if (c.cardType === "steering") {
    return { id: c.id, cardType: "steering" as const, modelName: c.modelName, prompt: c.cleanPrompt, corruptedPrompt: c.corruptedPrompt, generationPrompt: c.generationPrompt, data: c.data as Record<string, unknown>, position: c.position, gpuTier: c.gpuTier, targetPosition: c.targetPosition, targetToken: c.targetToken, components: c.components, alpha: c.alpha, temperature: c.temperature, repetitionPenalty: c.repetitionPenalty, nTokens: c.nTokens, nPairs: c.nPairs, extraPairs: c.extraPairs ?? [], parentCardId: c.parentCardId };
  }
  if (c.cardType === "entropy") {
    return { id: c.id, cardType: "entropy" as const, modelName: c.modelName, prompt: c.prompt, data: {} as Record<string, unknown>, position: c.position, parentLensId: c.parentLensId, entropyData: c.entropyData, xLabels: c.xLabels, yLabels: c.yLabels };
  }
  if (c.cardType === "attention-pattern") {
    const ac = c as AttentionCardData;
    return { id: ac.id, cardType: "attention-pattern" as const, modelName: ac.modelName, prompt: ac.prompt, data: ac.data as Record<string, unknown>, position: ac.position, gpuTier: ac.gpuTier };
  }
  const lc = c as LensCardData;
  return { id: lc.id, cardType: "logit-lens" as const, modelName: lc.modelName, prompt: lc.prompt, data: lc.data as Record<string, unknown>, position: lc.position, gpuTier: lc.gpuTier, topK: lc.topK };
}

export function getCardPrompt(c: AnyCard): string {
  if (c.cardType === "attribution" || c.cardType === "activation" || c.cardType === "steering") return c.cleanPrompt;
  return (c as LensCardData | DlaCardData | AttentionCardData).prompt;
}
