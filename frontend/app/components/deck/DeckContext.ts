"use client";

import { createContext, useContext } from "react";
import type { SectionDef } from "./sections";

export type Phase = "idle" | "exiting" | "entering";

export interface DeckContextValue {
  active: number;
  phase: Phase;
  sections: readonly SectionDef[];
  go: (target: number) => void;
}

export const DeckContext = createContext<DeckContextValue | null>(null);

export function useDeck(): DeckContextValue {
  const v = useContext(DeckContext);
  if (!v) throw new Error("useDeck must be used within <Deck>");
  return v;
}

// True only for the currently-active section; gates its entrance animations.
export const SectionEntranceContext = createContext<boolean>(false);

export function useSectionEntrance(): boolean {
  return useContext(SectionEntranceContext);
}
