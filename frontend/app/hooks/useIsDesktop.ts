"use client";

import { useEffect, useState } from "react";

export const DESKTOP_QUERY = "(min-width: 768px)";

/**
 * True when the viewport is at/above the `md` breakpoint. SSR and the first
 * client paint return `true` (desktop) to match today's server-rendered deck;
 * the real value is read on mount, so mobile sees one brief paint flip.
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const update = () => setIsDesktop(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return isDesktop;
}
