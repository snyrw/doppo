export type StepDir = -1 | 1;

// ── deck vs flow mode ──
// Deck mode = desktop-landscape viewports that can hold the full-frame slide
// compositions. Everything else (phones, landscape phones under 600px tall,
// portrait tablets, high zoom) gets the scrolling flow layout. The CSS twin of
// this query lives in globals.css (`.deck-only` / `.flow-only` / `.landing-root`)
// — keep the two in sync.
export const DECK_MIN_WIDTH = 768;
export const DECK_MIN_HEIGHT = 600;
export const DECK_QUERY =
  `(min-width: ${DECK_MIN_WIDTH}px) and (min-height: ${DECK_MIN_HEIGHT}px) and (orientation: landscape)`;

export function deckModeActive(mql: { matches: boolean } | null | undefined): boolean {
  return mql?.matches === true;
}
export type NavIntent = "next" | "prev" | "first" | "last";

export function clampIndex(i: number, count: number): number {
  if (i < 0) return 0;
  if (i > count - 1) return count - 1;
  return i;
}

export function nextIndex(active: number, dir: StepDir, count: number): number {
  return clampIndex(active + dir, count);
}

export function intentToIndex(intent: NavIntent, active: number, count: number): number {
  switch (intent) {
    case "next": return clampIndex(active + 1, count);
    case "prev": return clampIndex(active - 1, count);
    case "first": return 0;
    case "last": return count - 1;
  }
}

export function indexToId(i: number, sections: readonly { id: string }[]): string {
  return sections[i]?.id ?? sections[0].id;
}

export function idToIndex(hashOrId: string, sections: readonly { id: string }[]): number {
  const id = hashOrId.startsWith("#") ? hashOrId.slice(1) : hashOrId;
  if (!id) return -1;
  return sections.findIndex((s) => s.id === id);
}

export function keyToIntent(key: string): NavIntent | null {
  switch (key) {
    case "ArrowDown":
    case "PageDown": return "next";
    case "ArrowUp":
    case "PageUp": return "prev";
    case "Home": return "first";
    case "End": return "last";
    default: return null;
  }
}

export function isTypingTarget(
  el: { tagName?: string; isContentEditable?: boolean } | null,
): boolean {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

// ── timing + gesture constants (CSS deckFadeOut must match EXIT_MS) ──
export const EXIT_MS = 250;
export const ENTER_LOCK_MS = 350;
export const WHEEL_THRESHOLD = 20;
export const WHEEL_QUIET_DELTA = 8;
export const WHEEL_QUIET_MS = 220;
export const SCROLL_EDGE_EPSILON = 2;
export const TOUCH_MIN_DELTA = 40;

export type WheelState = { lastNonQuietAt: number };

// Trailing-edge debounce: a step fires only on a strong delta that follows a
// quiet gap. The inertial momentum tail keeps deltas non-quiet, so it never
// triggers a second step until the user's scrolling actually stops and restarts.
export function wheelDecision(
  state: WheelState,
  deltaY: number,
  now: number,
  opts: { threshold?: number; quietMs?: number; quietDelta?: number } = {},
): { step: 0 | StepDir; state: WheelState } {
  const threshold = opts.threshold ?? WHEEL_THRESHOLD;
  const quietMs = opts.quietMs ?? WHEEL_QUIET_MS;
  const quietDelta = opts.quietDelta ?? WHEEL_QUIET_DELTA;

  const wasQuietFor = now - state.lastNonQuietAt;
  const isQuiet = Math.abs(deltaY) <= quietDelta;
  const nextState: WheelState = { lastNonQuietAt: isQuiet ? state.lastNonQuietAt : now };

  let step: 0 | StepDir = 0;
  if (Math.abs(deltaY) >= threshold && wasQuietFor >= quietMs) {
    step = deltaY > 0 ? 1 : -1;
  }
  return { step, state: nextState };
}

// Edge detection: should this scroll step sections, or scroll within the section?
export function shouldStepFromScroll(
  m: { scrollTop: number; scrollHeight: number; clientHeight: number },
  dir: StepDir,
  epsilon: number = SCROLL_EDGE_EPSILON,
): boolean {
  const maxScroll = m.scrollHeight - m.clientHeight;
  if (maxScroll <= epsilon) return true; // no real overflow → always step
  if (dir === 1) return m.scrollTop >= maxScroll - epsilon; // at bottom
  return m.scrollTop <= epsilon; // dir === -1, at top
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}
