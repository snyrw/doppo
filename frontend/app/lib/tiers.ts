export const TIER_LABELS: Record<string, string> = {
  tl_small:   "L4",
  tl_medium:  "L40S",
  tl_large:   "A100-80GB",
  tl_xlarge:  "H200",
  tl_xxlarge: "B200",
};

// Max steering pairs (seed + generated) per GPU tier — bigger models cost more
// per DIM-extraction forward pass, so the cap shrinks as the tier grows.
export const TIER_PAIR_CAPS: Record<string, number> = {
  tl_small:   40,
  tl_medium:  25,
  tl_large:   15,
  tl_xlarge:  10,
  tl_xxlarge: 10,
};
export const DEFAULT_PAIR_CAP = 20;
