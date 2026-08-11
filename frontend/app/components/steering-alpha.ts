/* Alpha stepping and text formatting for the steering card, split out of the
   component so tests/steering-alpha.test.ts can load it */

/**
 * Alpha bounds and granularity. Stepping 0.25 at a time should cover most
 * bounds for an app of this scope (though perhaps some sort of text input would
 * be better in the future).
 */
export const ALPHA_MIN = -8;
export const ALPHA_MAX = 8;
export const ALPHA_STEP = 0.25;

export function stepAlpha(alpha: number, dir: 1 | -1): number {
  return Math.min(ALPHA_MAX, Math.max(ALPHA_MIN, alpha + dir * ALPHA_STEP));
}

/** Whether the arrow in `dir` has anywhere to go. */
export function canStep(alpha: number, dir: 1 | -1): boolean {
  return stepAlpha(alpha, dir) !== alpha;
}

/** Band readout: sign always, two decimals, never `-0.00`. */
export function formatAlpha(alpha: number): string {
  const rounded = Number(alpha.toFixed(2));
  return (rounded < 0 ? "" : "+") + rounded.toFixed(2);
}

/** Headline prompt: what actually produced both columns. Falls back to the
    clean prompt, which is what the backend generates from when none is given. */
export function displayPrompt(generationPrompt: string | undefined, cleanPrompt: string): string {
  const g = generationPrompt?.trim();
  return g ? g : cleanPrompt;
}
