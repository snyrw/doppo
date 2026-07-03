"use client";

import { useSyncExternalStore } from "react";
import {
  SEQUENTIAL_PALETTE_ORDER,
  DIVERGING_PALETTE_ORDER,
  type SequentialPaletteName,
  type DivergingPaletteName,
} from "../lib/palette";

const SEQUENTIAL_KEY = "heatmap-palette";
const DIVERGING_KEY = "diverging-palette";
const DEFAULT_SEQUENTIAL: SequentialPaletteName = "mono";
const DEFAULT_DIVERGING: DivergingPaletteName = "rdbu";

// AppearanceSection writes localStorage *before* dispatching "palettechange", so the
// snapshot read below always observes the new value when the event fires. Both
// sequential and diverging hooks subscribe to the same event name; each only acts on
// its own localStorage key, so one dispatch correctly refreshes both independently.
function subscribe(onStoreChange: () => void) {
  window.addEventListener("palettechange", onStoreChange);
  return () => window.removeEventListener("palettechange", onStoreChange);
}

function makePaletteHook<T extends string>(key: string, fallback: T, valid: readonly T[]) {
  function getSnapshot(): T {
    try {
      const stored = localStorage.getItem(key);
      return stored && (valid as readonly string[]).includes(stored) ? (stored as T) : fallback;
    } catch {
      return fallback;
    }
  }
  return function usePaletteValue(): T {
    return useSyncExternalStore(subscribe, getSnapshot, () => fallback);
  };
}

// Membership-checked against valid values so a stale localStorage entry (e.g. the
// removed "warm-mono" key) falls back cleanly instead of producing an undefined
// PALETTE_META lookup.
export const useSequentialPalette = makePaletteHook<SequentialPaletteName>(SEQUENTIAL_KEY, DEFAULT_SEQUENTIAL, SEQUENTIAL_PALETTE_ORDER);
export const useDivergingPalette = makePaletteHook<DivergingPaletteName>(DIVERGING_KEY, DEFAULT_DIVERGING, DIVERGING_PALETTE_ORDER);
