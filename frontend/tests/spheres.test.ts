// frontend/tests/spheres.test.ts
import { describe, it, expect } from "vitest";
import {
  SPHERES,
  SPHERE_BASE_DELAY_MS,
  SPHERE_GROUP_STAGGER_MS,
} from "../app/components/sections/spheres";

describe("SPHERES", () => {
  it("has exactly 9 spheres", () => {
    expect(SPHERES).toHaveLength(9);
  });

  it("has 5 faces and 4 twins", () => {
    expect(SPHERES.filter((s) => s.fill === "face")).toHaveLength(5);
    expect(SPHERES.filter((s) => s.fill === "twin")).toHaveLength(4);
  });

  it("offsets every twin down-right of its face, same diameter", () => {
    const pairs: [string, string][] = [
      ["80:24", "80:5"],
      ["80:26", "80:7"],
      ["80:28", "80:9"],
      ["80:30", "80:11"],
    ];
    for (const [twinNode, faceNode] of pairs) {
      const twin = SPHERES.find((s) => s.node === twinNode)!;
      const face = SPHERES.find((s) => s.node === faceNode)!;
      expect(twin.topU).toBeGreaterThan(face.topU);
      expect(twin.rightU).toBeLessThan(face.rightU);
      expect(twin.sizeU).toBe(face.sizeU);
    }
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
