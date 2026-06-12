import type { DlaData } from "../components/DlaCard";
import type { AttributionData } from "../components/AttributionCard";
import type { ActivationPatchResult } from "../components/ActivationCard";
import type { SteeringResult } from "../components/SteeringCard";
import type { EntropyCardData } from "../components/EntropyCard";
import type { AttentionData } from "../components/AttentionCard";
import type { AnyCard } from "../components/SandboxCanvas";

export type { AnyCard };

export type CanvasState = {
  panOffset: { x: number; y: number };
  zoom: number;
};

export type AppState = {
  lensCards: AnyCard[];
  canvas: CanvasState;
};

export type HeatmapData = {
  x_labels: string[];
  y_labels: string[];
  heatmap_data: number[][];
  topk_tokens?: string[][][];
  topk_probs?: number[][][];
  kl_data?: number[][];
  rank_data?: number[][];
  entropy_data?: number[][];
};

// One resolved action for every job-backed card type, discriminated on cardType.
export type CardResolvedAction =
  | { type: "CARD_RESOLVED"; id: string; cardType: "logit-lens"; data: HeatmapData }
  | { type: "CARD_RESOLVED"; id: string; cardType: "dla"; data: DlaData }
  | { type: "CARD_RESOLVED"; id: string; cardType: "attribution"; data: AttributionData }
  | { type: "CARD_RESOLVED"; id: string; cardType: "activation"; data: ActivationPatchResult; parentAttributionId: string }
  | { type: "CARD_RESOLVED"; id: string; cardType: "attention-pattern"; data: AttentionData }
  | { type: "CARD_RESOLVED"; id: string; cardType: "steering"; data: SteeringResult };

export type AppAction =
  | { type: "ADD_CARD"; card: AnyCard }
  | CardResolvedAction
  | { type: "ATTRIBUTION_VERIFY_STARTED"; id: string; k: number; verifyCardId: string }
  | { type: "ATTRIBUTION_VERIFY_DONE"; id: string }
  | { type: "CARD_ERRORED"; id: string; error: string; showBuyCredits?: boolean }
  | { type: "CARD_STAGE"; id: string; stage: string }
  | { type: "MOVE_CARD"; id: string; position: { x: number; y: number } }
  | { type: "REMOVE_CARD"; id: string }
  | { type: "SET_CANVAS"; canvas: CanvasState }
  | { type: "LOAD_PROJECT"; cards: AnyCard[]; canvas: CanvasState }
  | { type: "RESET_CANVAS" }
  | { type: "STEERING_CARD_TOKEN"; id: string; token: string }
  | { type: "STEERING_CARD_RERUN"; id: string; alpha: number }
  | { type: "SPAWN_ENTROPY_CARD"; card: EntropyCardData };
