import type { AnyCard } from "./types";
import type { LensCardData } from "../components/LensCard";
import type { DlaCardData } from "../components/DlaCard";
import type { AttentionCardData } from "../components/AttentionCard";

export const CARD_COL_WIDTH = 360;
export const CARD_ROW_HEIGHT = 320;
export const GRID_MARGIN = 40;

export function autoArrangePos(index: number): { x: number; y: number } {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return {
    x: GRID_MARGIN + col * (CARD_COL_WIDTH + GRID_MARGIN),
    y: GRID_MARGIN + row * (CARD_ROW_HEIGHT + GRID_MARGIN),
  };
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
    return { id: c.id, cardType: "steering" as const, modelName: c.modelName, prompt: c.cleanPrompt, corruptedPrompt: c.corruptedPrompt, generationPrompt: c.generationPrompt, data: c.data as Record<string, unknown>, position: c.position, gpuTier: c.gpuTier, targetPosition: c.targetPosition, targetToken: c.targetToken, components: c.components, alpha: c.alpha, nTokens: c.nTokens, nPairs: c.nPairs, extraPairs: c.extraPairs ?? [], parentCardId: c.parentCardId };
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
