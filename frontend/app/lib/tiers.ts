export const TIER_LABELS: Record<string, string> = {
  tl_small:   "L4",
  tl_medium:  "L40S",
  tl_large:   "A100-80GB",
  tl_xlarge:  "H200",
  tl_xxlarge: "B200",
};

// Max steering pairs (seed + generated), same on every tier. ~100 pairs is
// where DIM vectors stabilize across resamples; below ~30 they are noticeably
// noisy. Extraction is two short forward passes per pair — cheap next to the
// per-token generation loop — so the cap is not tiered by GPU cost.
export const TIER_PAIR_CAPS: Record<string, number> = {
  tl_small:   100,
  tl_medium:  100,
  tl_large:   100,
  tl_xlarge:  100,
  tl_xxlarge: 100,
};
export const DEFAULT_PAIR_CAP = 100;

// GPU tiers requiring a verified payment method before a run (anti-abuse on
// expensive GPUs). "Large and above": A100-80GB / H200 / B200.
export const GATED_TIERS: ReadonlySet<string> = new Set([
  "tl_large",
  "tl_xlarge",
  "tl_xxlarge",
]);

export function isGatedTier(tier: string): boolean {
  return GATED_TIERS.has(tier);
}
