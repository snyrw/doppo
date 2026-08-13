/* Every number the config panel's shell is built from. */

import { STRIP_SEGMENT_RADIUS } from "../card-geometry";

/** Panel width. */
export const LEDGER_W = 460;

/**
 * Surface radius. 12 is what the card frame and Modal already hold, and those
 * are the two largest surfaces this panel sits beside.
 *
 * The mock draws 31 (~15 at its ~2.1x scale), which would be a fifth unrelated
 * surface radius sitting above the card — on a drawing whose own insets vary by
 * roughly ±10 mock-px, so 15 is false precision.
 */
export const LEDGER_RADIUS = 12;

/* --- Spacing scale: four steps on the 4px grid --- */

/** Panel edge to all content. Header, strip, rule, body and footer share it. */
export const INSET = 18;
/** Between stacked blocks inside a section body. */
export const BLOCK_GAP = 8;
/** A label to its field. */
export const TIGHT_GAP = 8;
/** Inside a control. */
export const MICRO_GAP = 4;

/**
 * Cap on the model list's own scroll area.
 *
 * One value, where ModelPicker defaulted to 260 and attribution and steering
 * passed 200 without either file saying why. At the one-column row height (~28)
 * this shows about 6 models before scrolling.
 */
export const GRID_MAX_H = 200;

/**
 * Footer's vertical padding — the one place the panel steps off INSET.
 *
 * Horizontal padding stays at INSET: header, strip, rule, body and footer must
 * share one content column, which is this shell's defining invariant. Only the
 * block axis drops, and only to the next step on the same scale.
 */
export const FOOTER_PAD_Y = BLOCK_GAP;

/* --- Section strip --- */

export const STRIP_H = 20;

/** Track and active-segment radius. Flat/blocky — shared with cards' ViewStrip. */
export const STRIP_RADIUS = STRIP_SEGMENT_RADIUS;

/** Horizontal padding inside one segment. */
export const SEGMENT_PAD_X = 16;

/* --- Technique accent --- */

/** Matches CardInfo's band marker, so the same square reads the same size. */
export const ACCENT_SIZE = 18;

/**
 * Zero, matching CardInfo's band marker: both read as the plain square.
 */
export const ACCENT_RADIUS = 0;
