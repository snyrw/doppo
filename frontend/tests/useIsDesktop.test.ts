import { describe, it, expect } from "vitest";
import { DESKTOP_QUERY } from "../app/hooks/useIsDesktop";

describe("DESKTOP_QUERY", () => {
  it("matches the md breakpoint (768px)", () => {
    expect(DESKTOP_QUERY).toBe("(min-width: 768px)");
  });
});
