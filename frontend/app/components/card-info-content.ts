/* Panel content for the card info system, as data rather than JSX, so
   tests/card-info-content.test.ts can load it*/

import type { AnyCard } from "./SandboxCanvas";
import { labelForCard } from "../lib/techniques";

export type InfoRow = { label: string; value: string };

export type InfoSection =
  /** `tier` is the raw GPU tier key; CardInfo renders it through TierBadge,
      which owns the TIER_LABELS lookup. */
  | { kind: "identity"; technique: string; tier: string | null }
  | { kind: "text"; label: string; value: string }
  | { kind: "params"; rows: InfoRow[] }
  | { kind: "warning"; text: string }
  /** An unlabeled explanation paragraph, CardExplain's main copy. */
  | { kind: "prose"; text: string }
  /** Reference links, e.g. CardExplain's "read more" list. */
  | { kind: "links"; links: { label: string; url: string }[] };

function timingRows(card: AnyCard): InfoRow[] {
  // `cached` and `finishedAt` are absent on rows saved before they existed, so
  // the row is omitted rather than shown blank.
  if (card.cached) return [{ label: "Duration", value: "cached" }];
  if (card.startedAt == null || card.finishedAt == null) return [];
  return [{ label: "Duration", value: `${((card.finishedAt - card.startedAt) / 1000).toFixed(1)}s` }];
}

function targetPositionRow(pos: number | "last" | undefined): InfoRow[] {
  if (pos === undefined) return [];
  return [{ label: "Target position", value: pos === "last" ? "last" : String(pos) }];
}

/** A token row, quoted the way the bands and tooltips quote tokens. */
function tokenRow(label: string, token: string | null): InfoRow[] {
  return token ? [{ label, value: JSON.stringify(token) }] : [];
}

/** Sections for one card, top to bottom, with empty ones already dropped. */
export function infoSectionsFor(card: AnyCard): InfoSection[] {
  const sections: InfoSection[] = [
    {
      kind: "identity",
      technique: labelForCard(card.cardType),
      tier: card.gpuTier ?? null,
    },
    { kind: "text", label: "Model", value: card.modelName },
  ];

  const rows: InfoRow[] = [];

  switch (card.cardType) {
    case "logit-lens": {
      sections.push({ kind: "text", label: "Prompt", value: card.prompt });
      if (card.topK !== undefined) rows.push({ label: "Top-k", value: String(card.topK) });
      if (card.data) {
        rows.push({ label: "Layers", value: String(card.data.y_labels.length) });
        rows.push({ label: "Tokens", value: String(card.data.x_labels.length) });
      }
      break;
    }
    case "attention-pattern": {
      sections.push({ kind: "text", label: "Prompt", value: card.prompt });
      if (card.data) {
        rows.push({ label: "Layers", value: String(card.data.n_layers) });
        rows.push({ label: "Heads", value: String(card.data.n_heads) });
      }
      break;
    }
    case "dla": {
      sections.push({ kind: "text", label: "Prompt", value: card.prompt });
      rows.push(...targetPositionRow(card.targetPosition));
      rows.push(...tokenRow("Target token", card.targetToken));
      rows.push(...tokenRow("Contrastive token", card.contrastiveToken));
      break;
    }
    case "attribution": {
      sections.push({ kind: "text", label: "Clean prompt", value: card.cleanPrompt });
      if (card.corruptedPrompt) {
        sections.push({ kind: "text", label: "Corrupted prompt", value: card.corruptedPrompt });
      }
      rows.push(...targetPositionRow(card.targetPosition));
      rows.push(...tokenRow("Target token", card.targetToken));
      rows.push(...tokenRow("Contrastive token", card.contrastiveToken));
      break;
    }
    case "activation": {
      sections.push({ kind: "text", label: "Clean prompt", value: card.cleanPrompt });
      rows.push({ label: "Components patched", value: String(card.k) });
      rows.push(...tokenRow("Target token", card.targetToken));
      rows.push(...tokenRow("Contrastive token", card.contrastiveToken));
      if (card.data) rows.push({ label: "Total diff", value: card.data.total_diff.toFixed(3) });
      break;
    }
    case "steering": {
      const generation = card.generationPrompt?.trim();
      if (generation) sections.push({ kind: "text", label: "Generation prompt", value: generation });
      sections.push({ kind: "text", label: "DIM clean", value: card.cleanPrompt });
      sections.push({ kind: "text", label: "DIM corrupted", value: card.corruptedPrompt });
      if (card.components.length > 0) {
        rows.push({ label: "Layers", value: card.components.map(c => `L${c.layer}`).join(" + ") });
      }
      rows.push({ label: "Pairs", value: String(card.nPairs) });
      rows.push({ label: "Max tokens", value: String(card.nTokens) });
      rows.push({ label: "Temperature", value: String(card.temperature) });
      rows.push({ label: "Repetition penalty", value: card.repetitionPenalty.toFixed(2) });
      if (card.data) rows.push({ label: "Logit diff", value: card.data.logit_diff.toFixed(3) });
      break;
    }
  }

  rows.push(...timingRows(card));
  if (rows.length > 0) sections.push({ kind: "params", rows });

  if (card.cardType === "attention-pattern" && card.data?.truncated) {
    // The payload carries `truncated` as a bare boolean and not the original
    // token count.
    sections.push({ kind: "warning", text: "Truncated to the first 30 tokens of the prompt." });
  }

  return sections;
}
