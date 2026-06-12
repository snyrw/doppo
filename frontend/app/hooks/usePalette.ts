"use client";

import { useSyncExternalStore } from "react";
import type { PaletteName } from "../lib/palette";

const DEFAULT_PALETTE: PaletteName = "warm-mono";

// Navbar writes localStorage *before* dispatching "palettechange", so the
// snapshot read below always observes the new value when the event fires.
function subscribe(onStoreChange: () => void) {
  window.addEventListener("palettechange", onStoreChange);
  return () => window.removeEventListener("palettechange", onStoreChange);
}

function getSnapshot(): PaletteName {
  try {
    return (localStorage.getItem("heatmap-palette") as PaletteName | null) ?? DEFAULT_PALETTE;
  } catch {
    return DEFAULT_PALETTE;
  }
}

export function usePalette(): PaletteName {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_PALETTE);
}
