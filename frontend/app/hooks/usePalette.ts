"use client";

import { useState, useEffect } from "react";
import type { PaletteName } from "../lib/palette";

export function usePalette(): PaletteName {
  const [palette, setPalette] = useState<PaletteName>("warm-mono");

  useEffect(() => {
    const stored = localStorage.getItem("heatmap-palette") as PaletteName | null;
    if (stored) setPalette(stored);

    function onPaletteChange(e: Event) {
      setPalette((e as CustomEvent<PaletteName>).detail);
    }
    window.addEventListener("palettechange", onPaletteChange);
    return () => window.removeEventListener("palettechange", onPaletteChange);
  }, []);

  return palette;
}
