/* Placement math for the card info panel. */

/** Panel width, matching the steering card's detail panel for consistency. */
export const PANEL_W = 260;

/** Gap between the button's bottom edge and the panel. */
export const PANEL_GAP = 4;

/** Minimum clearance from any viewport edge. */
export const VIEWPORT_MARGIN = 8;

export type ButtonRect = { left: number; top: number; bottom: number };

export type Viewport = { width: number; height: number };

function clamp(v: number, lo: number, hi: number): number {
  // lo wins when the range is inverted, so a panel taller than the viewport
  // sits at the top margin instead of a negative bottom-clamped position.
  return Math.max(lo, Math.min(hi, v));
}

export function panelPosition(
  button: ButtonRect,
  viewport: Viewport,
  panelHeight: number,
): { left: number; top: number } {
  const left = clamp(
    button.left,
    VIEWPORT_MARGIN,
    viewport.width - PANEL_W - VIEWPORT_MARGIN,
  );

  const below = button.bottom + PANEL_GAP;
  const above = button.top - PANEL_GAP - panelHeight;
  const fitsBelow = below + panelHeight <= viewport.height - VIEWPORT_MARGIN;
  const top = clamp(
    fitsBelow ? below : above,
    VIEWPORT_MARGIN,
    Math.max(VIEWPORT_MARGIN, viewport.height - panelHeight - VIEWPORT_MARGIN),
  );

  return { left, top };
}
