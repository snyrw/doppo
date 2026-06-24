// frontend/tests/spheres.test.ts
import { describe, it, expect } from "vitest";
import {
  pxToVw,
  SPHERES,
  SPHERE_BASE_DELAY_MS,
  SPHERE_GROUP_STAGGER_MS,
} from "../app/components/sections/spheres";

describe("pxToVw", () => {
  it("converts design px to vw against the 1920px frame", () => {
    expect(pxToVw(1920)).toBe(100);
    expect(pxToVw(960)).toBe(50);
    expect(pxToVw(800)).toBe(41.667); // rounded to 3 decimals
  });
});

describe("SPHERES", () => {
  it("has exactly 9 spheres", () => {
    expect(SPHERES).toHaveLength(9);
  });

  it("has 5 faces and 4 twins", () => {
    expect(SPHERES.filter((s) => s.fill === "face")).toHaveLength(5);
    expect(SPHERES.filter((s) => s.fill === "twin")).toHaveLength(4);
  });

  it("places the large solo sphere (80:4) at the exact Figma-derived vw", () => {
    const solo = SPHERES.find((s) => s.node === "80:4")!;
    expect(solo.rightVw).toBe(12.552);
    expect(solo.topVw).toBe(39.583);
    expect(solo.sizeVw).toBe(41.667);
    expect(solo.delayMs).toBe(SPHERE_BASE_DELAY_MS); // largest fades first
  });

  it("offsets each twin down-right of its face, same diameter", () => {
    const face = SPHERES.find((s) => s.node === "80:5")!;  // 394 face
    const twin = SPHERES.find((s) => s.node === "80:24")!; // 394 twin
    expect(twin.rightVw).toBeLessThan(face.rightVw); // further toward/past right edge
    expect(twin.topVw).toBeGreaterThan(face.topVw);  // lower
    expect(twin.sizeVw).toBe(face.sizeVw);
  });

  it("lists the twin before its face so the twin paints behind", () => {
    const twinIdx = SPHERES.findIndex((s) => s.node === "80:24");
    const faceIdx = SPHERES.findIndex((s) => s.node === "80:5");
    expect(twinIdx).toBeLessThan(faceIdx);
  });

  it("fades largest → smallest", () => {
    const solo = SPHERES.find((s) => s.node === "80:4")!;      // group 1
    const smallest = SPHERES.find((s) => s.node === "80:11")!; // group 5
    expect(solo.delayMs).toBeLessThan(smallest.delayMs);
    expect(smallest.delayMs).toBe(SPHERE_BASE_DELAY_MS + 4 * SPHERE_GROUP_STAGGER_MS);
  });
});
