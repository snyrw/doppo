/* Card frame numbers. */

/**
 * Frame corner radius.
 */
export const CARD_RADIUS = 12;

/**
 * Card border, both sides summed.
 *
 */
export const BORDER_W = 2;

/**
 * Radius for a scroll container clipped inside the frame. A scroll container
 * clips square; we'd just have stuff going through that unless intentionally
 * rounded.
 */
export const CARD_INNER_RADIUS = CARD_RADIUS - BORDER_W / 2;

/**
 * Card content inset that header, band and rule all align to.
 */
export const CARD_INSET = 20;

/**
 * Padding around a card body.
 */
export const CARD_BODY_PAD = 20;

/**
 * Narrowest a card may render; cards that size to their data grow past it.
 */
export const CARD_MIN_W = 362;

/**
 * Hard bounds on a rendered card. Past these the card's own body scrolls
 * instead of the card growing.
 */
export const CARD_MAX_W = 640;
export const CARD_MAX_H = 800;

/** CardBand's leading accent square — the slot CardInfo's button fills. */
export const BAND_ACCENT_W = 18;

/** CardBand's gap between children. */
export const BAND_GAP = 6;

/**
 * Active-segment radius, shared by ViewStrip (cards) and SectionStrip (config
 * ledger).
 */
export const STRIP_SEGMENT_RADIUS = 0;
