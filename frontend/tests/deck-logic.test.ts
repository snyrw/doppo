import { describe, it, expect } from "vitest";
import {
  DECK_MIN_HEIGHT, DECK_MIN_WIDTH, DECK_QUERY, clampIndex, deckModeActive,
  idToIndex, indexToId, intentToIndex, isTypingTarget, keyToIntent, nextIndex,
} from "../app/components/deck/deck-logic";

const S = [{ id: "intro" }, { id: "what-doppo-is" }, { id: "pricing" }, { id: "self-hosting" }];

describe("DECK_QUERY / deckModeActive", () => {
  it("requires width, height, and landscape orientation", () => {
    expect(DECK_QUERY).toContain(`(min-width: ${DECK_MIN_WIDTH}px)`);
    expect(DECK_QUERY).toContain(`(min-height: ${DECK_MIN_HEIGHT}px)`);
    expect(DECK_QUERY).toContain("(orientation: landscape)");
  });

  it("is deck mode only for a matching media query list", () => {
    expect(deckModeActive({ matches: true })).toBe(true);
    expect(deckModeActive({ matches: false })).toBe(false);
    expect(deckModeActive(null)).toBe(false);      // no matchMedia (old browser)
    expect(deckModeActive(undefined)).toBe(false); // window.matchMedia missing
  });
});

describe("clampIndex", () => {
  it("clamps below 0 and above count-1", () => {
    expect(clampIndex(-2, 4)).toBe(0);
    expect(clampIndex(9, 4)).toBe(3);
    expect(clampIndex(2, 4)).toBe(2);
  });
});

describe("nextIndex", () => {
  it("steps and clamps without wrapping", () => {
    expect(nextIndex(1, 1, 4)).toBe(2);
    expect(nextIndex(1, -1, 4)).toBe(0);
    expect(nextIndex(0, -1, 4)).toBe(0); // no wrap at start
    expect(nextIndex(3, 1, 4)).toBe(3);  // no wrap at end
  });
});

describe("intentToIndex", () => {
  it("maps intents to clamped indices", () => {
    expect(intentToIndex("next", 1, 4)).toBe(2);
    expect(intentToIndex("prev", 1, 4)).toBe(0);
    expect(intentToIndex("first", 2, 4)).toBe(0);
    expect(intentToIndex("last", 1, 4)).toBe(3);
    expect(intentToIndex("prev", 0, 4)).toBe(0);
  });
});

describe("indexToId / idToIndex", () => {
  it("round-trips ids", () => {
    expect(indexToId(2, S)).toBe("pricing");
    expect(idToIndex("pricing", S)).toBe(2);
    expect(idToIndex("#self-hosting", S)).toBe(3); // strips leading '#'
    expect(idToIndex("nope", S)).toBe(-1);
    expect(idToIndex("", S)).toBe(-1);
  });
  it("guards out-of-range index", () => {
    expect(indexToId(99, S)).toBe("intro");
  });
});

describe("keyToIntent", () => {
  it("maps nav keys, ignores others", () => {
    expect(keyToIntent("ArrowDown")).toBe("next");
    expect(keyToIntent("PageDown")).toBe("next");
    expect(keyToIntent("ArrowUp")).toBe("prev");
    expect(keyToIntent("PageUp")).toBe("prev");
    expect(keyToIntent("Home")).toBe("first");
    expect(keyToIntent("End")).toBe("last");
    expect(keyToIntent(" ")).toBeNull();   // never hijack Space
    expect(keyToIntent("Tab")).toBeNull(); // never hijack Tab
    expect(keyToIntent("a")).toBeNull();
  });
});

describe("isTypingTarget", () => {
  it("is true for text-entry targets only", () => {
    expect(isTypingTarget({ tagName: "INPUT" })).toBe(true);
    expect(isTypingTarget({ tagName: "TEXTAREA" })).toBe(true);
    expect(isTypingTarget({ tagName: "SELECT" })).toBe(true);
    expect(isTypingTarget({ isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: "BUTTON" })).toBe(false); // arrows should still navigate
    expect(isTypingTarget({ tagName: "DIV" })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

import { wheelDecision, shouldStepFromScroll, type WheelState } from "../app/components/deck/deck-logic";

describe("wheelDecision", () => {
  const fresh = (): WheelState => ({ lastNonQuietAt: Number.NEGATIVE_INFINITY });

  it("steps once on a strong deliberate scroll", () => {
    const r = wheelDecision(fresh(), 120, 1000);
    expect(r.step).toBe(1);
    expect(r.state.lastNonQuietAt).toBe(1000);
  });

  it("steps backward on negative delta", () => {
    expect(wheelDecision(fresh(), -90, 1000).step).toBe(-1);
  });

  it("swallows the inertial momentum tail right after a step", () => {
    const a = wheelDecision(fresh(), 120, 1000);        // step
    const b = wheelDecision(a.state, 80, 1016);          // inertia, 16ms later
    expect(b.step).toBe(0);
    const c = wheelDecision(b.state, 40, 1040);          // still inertia
    expect(c.step).toBe(0);
  });

  it("allows a new step after a quiet gap", () => {
    const a = wheelDecision(fresh(), 120, 1000);         // step @1000
    const b = wheelDecision(a.state, 4, 1300);           // quiet (<=8) → no step, lastNonQuietAt unchanged
    expect(b.step).toBe(0);
    expect(b.state.lastNonQuietAt).toBe(1000);
    const d = wheelDecision(b.state, 90, 1600);          // 600ms since last non-quiet → step
    expect(d.step).toBe(1);
  });

  it("ignores deltas below the threshold", () => {
    const r = wheelDecision(fresh(), 12, 1000); // > quietDelta(8) but < threshold(20)
    expect(r.step).toBe(0);
    expect(r.state.lastNonQuietAt).toBe(1000);  // counts as non-quiet
  });
});

describe("shouldStepFromScroll", () => {
  it("always steps when the section does not overflow", () => {
    expect(shouldStepFromScroll({ scrollTop: 0, scrollHeight: 800, clientHeight: 800 }, 1)).toBe(true);
    expect(shouldStepFromScroll({ scrollTop: 0, scrollHeight: 800, clientHeight: 800 }, -1)).toBe(true);
  });
  it("lets inner content scroll until it hits the edge", () => {
    const m = { scrollTop: 100, scrollHeight: 1600, clientHeight: 800 }; // mid-scroll, overflow
    expect(shouldStepFromScroll(m, 1)).toBe(false);  // not at bottom → inner scroll
    expect(shouldStepFromScroll(m, -1)).toBe(false); // not at top → inner scroll
  });
  it("steps at the bottom edge scrolling down", () => {
    expect(shouldStepFromScroll({ scrollTop: 800, scrollHeight: 1600, clientHeight: 800 }, 1)).toBe(true);
  });
  it("steps at the top edge scrolling up", () => {
    expect(shouldStepFromScroll({ scrollTop: 0, scrollHeight: 1600, clientHeight: 800 }, -1)).toBe(true);
  });
});
