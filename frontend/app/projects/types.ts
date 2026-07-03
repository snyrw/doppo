import type { HeatmapData } from "../components/LensCard";
import type { DlaData } from "../components/DlaCard";
import type { AttributionData } from "../components/AttributionCard";
import type { ActivationPatchResult } from "../components/ActivationCard";
import type { SteeringResult } from "../components/SteeringCard";
import type { AttentionData } from "../components/AttentionCard";
import type { AnyCard, CanvasState } from "../components/SandboxCanvas";
import type { LoadingStage } from "../lib/loading-stage";

export type { AnyCard, CanvasState, HeatmapData };

export type AppState = {
  lensCards: AnyCard[];
  canvas: CanvasState;
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
  | { type: "ATTRIBUTION_VERIFY_STARTED"; id: string }
  | { type: "ATTRIBUTION_VERIFY_DONE"; id: string }
  | { type: "CARD_ERRORED"; id: string; error: string; showBuyCredits?: boolean; showVerifyCard?: boolean }
  | { type: "CARD_STAGE"; id: string; stage: LoadingStage }
  | { type: "MOVE_CARD"; id: string; position: { x: number; y: number } }
  | { type: "REMOVE_CARD"; id: string }
  | { type: "SET_CANVAS"; canvas: CanvasState }
  | { type: "LOAD_PROJECT"; cards: AnyCard[]; canvas: CanvasState }
  | { type: "RESET_CANVAS" }
  | { type: "STEERING_CARD_RERUN"; id: string; alpha: number };
