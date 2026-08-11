// Shared between AttributionCard (the topN control's ceiling) and
// spawn-attribution/route.ts (the value actually requested from the backend).

/**
 * How many ranked components the frontend asks for, and the ceiling on how many
 * a user can verify.
 *
 * The backend's own default is 30 (`SpawnAttributionRequest.top_n`, `ge=1 le=200`),
 * so raising this is a frontend-only change. Verifying is one forward pass per
 * component, which is what bounds it.
 */
export const ATTRIBUTION_TOP_N = 20;

/** Row counts offered in the card's `···` popover. Ends at the ceiling. */
export const TOP_N_OPTIONS = [5, 10, 20] as const;

export type TopN = (typeof TOP_N_OPTIONS)[number];
