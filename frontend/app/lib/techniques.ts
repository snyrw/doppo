// Canonical technique colors, used in two independent places:
//   face/shadow — the landing page's technique bars
//   band        — the accent chip on each workbench card
//
// face/shadow and band are chosen independently per technique — don't derive
// one from the other (only logit-lens happens to share a value between them).
//
// Hex literals, not theme tokens: these identify a technique, so they must
// stay the same color in both light and dark theme.

type TechniqueKey = "logit-lens" | "attention" | "dla" | "patching" | "steering";

export interface Technique {
  key: TechniqueKey;
  /** Display name, as shown on the landing technique bars. */
  name: string;
  /** Landing bar face. */
  face: string;
  /** Landing bar lip, drawn under the face. */
  shadow: string;
  /** Card chrome band chip — see BAND_NEUTRAL for the baseline counterpart. */
  band: string;
}

/** Order is load-bearing: TECHNIQUE_CARDS and TECHNIQUE_FIGURES index parallel to this. */
export const TECHNIQUES: readonly Technique[] = [
  { key: "logit-lens", name: "logit lens",               face: "#d88585", shadow: "#c16060", band: "#d88585" },
  { key: "attention",  name: "attention head analysis",  face: "#d8be85", shadow: "#ba9952", band: "#ccb789" },
  { key: "dla",        name: "direct logit attribution", face: "#a2ba8b", shadow: "#699440", band: "#6f8a60" },
  { key: "patching",   name: "patching",                 face: "#7399a6", shadow: "#4e8597", band: "#677d88" },
  { key: "steering",   name: "steering",                 face: "#7e5987", shadow: "#5e286b", band: "#bb8ba6" },
] as const;

/** Neutral swatch color for a card with no technique identity. Used as
 *  `CardHeader`'s `accent` on the landing page's `DoppoInfoCard` and
 *  `LearnMoreCard`. */
export const BAND_NEUTRAL = "#5a5a5a";

/** Ink for band labels; dark for contrast against the fills above. */
export const BAND_INK = "#1c1c1c";

/**
 * Activation patching's band accent — bluer and more saturated than
 * patching's own `#677d88` so the two patching-based cards stay visually
 * distinct.
 */
export const BAND_ACTIVATION = "#5170a8";

/**
 * Ratio used to darken a band fill into its shadow. The landing bars' hand-
 * picked face/shadow pairs don't share one consistent ratio, so this is an
 * approximation rather than a lookup table — close enough to read as "the
 * darker side of the same square" for any band color.
 */
const BAND_SHADOW_FACTOR = 0.7;

/** The darker side a band square's face sinks onto. Accepts `#rrggbb`. */
export function bandShadow(fill: string): string {
  const h = fill.replace("#", "");
  const scaled = [0, 2, 4].map(i =>
    Math.round(parseInt(h.slice(i, i + 2), 16) * BAND_SHADOW_FACTOR)
      .toString(16)
      .padStart(2, "0"),
  );
  return `#${scaled.join("")}`;
}

const BY_CARD_TYPE: Record<string, TechniqueKey> = {
  "logit-lens":        "logit-lens",
  "attention-pattern": "attention",
  "dla":               "dla",
  "attribution":       "patching",
  "activation":        "patching",
  "steering":          "steering",
};

const BY_KEY = new Map(TECHNIQUES.map(t => [t.key, t]));

/** Technique for a card's `cardType`; falls back to logit lens for unknown types. */
export function techniqueForCard(cardType: string): Technique {
  return BY_KEY.get(BY_CARD_TYPE[cardType] ?? "logit-lens")!;
}

/** A card type's own name, where it differs from the technique it shares. */
const LABEL_OVERRIDE: Partial<Record<string, string>> = {
  activation: "activation patching",
};

/** Display label for a card's technique. Both patching cards share the
 *  "patching" technique key; this is what tells them apart in the UI. */
export function labelForCard(cardType: string): string {
  return LABEL_OVERRIDE[cardType] ?? techniqueForCard(cardType).name;
}
