import { describe, it, expect } from "vitest";
import {
  clampIndex, nextIndex, intentToIndex, indexToId, idToIndex,
  keyToIntent, isTypingTarget,
} from "../app/components/deck/deck-logic";

const S = [{ id: "intro" }, { id: "what-doppo-is" }, { id: "pricing" }, { id: "self-hosting" }];

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
