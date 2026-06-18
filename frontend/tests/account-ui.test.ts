import { describe, it, expect } from "vitest";
import { shouldShowPasswordChange } from "../app/lib/account-ui";

describe("shouldShowPasswordChange", () => {
  it("shows for credential accounts", () => {
    expect(shouldShowPasswordChange([{ providerId: "credential" }])).toBe(true);
  });
  it("hides for github-only accounts", () => {
    expect(shouldShowPasswordChange([{ providerId: "github" }])).toBe(false);
  });
  it("shows when both linked", () => {
    expect(shouldShowPasswordChange([{ providerId: "github" }, { providerId: "credential" }])).toBe(true);
  });
  it("hides for empty", () => {
    expect(shouldShowPasswordChange([])).toBe(false);
  });
});
