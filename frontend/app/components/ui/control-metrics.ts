import type { CSSProperties } from "react";

/**
 * One height for every control in the top bar, so each lands on the same
 * step of the radius scale, which keys off an element's shortest side and
 * would otherwise give a shorter button a smaller radius.
 *
 * Shared by projects/page.tsx, tutorial/TutorialClient.tsx and AuthModal.tsx.
 * Keep both `+ Add` buttons in step or the tutorial's bar drifts from the app's.
 */
export const TOP_BAR_PAD = { "--pad-x": "14px", "--pad-y": "7.5px" } as CSSProperties;

/**
 * Typography for the same set. Padding lives in TOP_BAR_PAD, not here.
 * `leading-4` is load-bearing: an arbitrary font size with no explicit line
 * height inherits a taller default and breaks the shared control height.
 */
export const TOP_BAR_FACE_CLS = "text-[13px] leading-4 font-semibold tracking-[0.01em]";

/**
 * Close glyph size. The hit area (CLOSE_HIT) does not shrink with it, since
 * 20px is the practical floor for a pointer target.
 */
export const CLOSE_GLYPH = 10;

/** Hit area, both axes. Tailwind `size-5`. */
export const CLOSE_HIT = 20;

/**
 * Right gutter a header's text column must reserve so its lines truncate
 * before the close button instead of running under it.
 *
 * Equals CLOSE_HIT plus ledger-geometry's TIGHT_GAP, restated as a literal
 * here rather than imported, since this file is shared by cards and the panel
 * and importing a panel constant would point the dependency the wrong way.
 */
export const CLOSE_GUTTER = 28;
