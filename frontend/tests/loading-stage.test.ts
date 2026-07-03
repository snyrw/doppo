import { describe, expect, it } from "vitest";
import { phaseOf, stageText, formatGb, type LoadingStage } from "../app/lib/loading-stage";

const ls = (stage: string | null, stageAgeS: number | null = null): LoadingStage =>
  ({ stage, stageAgeS, progress: null });

describe("phaseOf", () => {
  it("maps queue states to phase 1", () => {
    expect(phaseOf(null)).toBe(1);
    expect(phaseOf(undefined)).toBe(1);
    expect(phaseOf("queued")).toBe(1);
  });
  it("maps boot stages to phase 2", () => {
    expect(phaseOf("starting_runtime")).toBe(2);
    expect(phaseOf("downloading_weights")).toBe(2);
    expect(phaseOf("loading_model")).toBe(2);
    expect(phaseOf("loading_model_cached")).toBe(2);
  });
  it("maps worker stages to phase 3", () => {
    expect(phaseOf("tokenizing")).toBe(3);
    expect(phaseOf("patching_2_of_5")).toBe(3);
  });
  it("maps the synthetic done sweep stage to phase 4", () => {
    expect(phaseOf("done")).toBe(4);
  });
});

describe("stageText", () => {
  it("uses shared labels", () => {
    expect(stageText(ls("forward_pass"))).toBe("Running forward pass…");
    expect(stageText(ls(null))).toBe("Waiting for a GPU…");
  });
  it("labels the container beacon and cached-load stages", () => {
    expect(stageText(ls("starting_runtime"))).toBe("GPU attached, starting runtime…");
    expect(stageText(ls("loading_model_cached")))
      .toBe("Weights cached, loading into GPU memory…");
  });
  it("card overrides win over shared labels", () => {
    expect(stageText(ls("computing"), { computing: "Computing logit lens…" }))
      .toBe("Computing logit lens…");
  });
  it("formats patching progress, with template override", () => {
    expect(stageText(ls("patching_2_of_5"))).toBe("Patching component 2 of 5…");
    expect(stageText(ls("patching_2_of_5"), { patching: "Verifying component {i} of {n}…" }))
      .toBe("Verifying component 2 of 5…");
  });
  it("humanizes unknown stages", () => {
    expect(stageText(ls("doing_new_thing"))).toBe("doing new thing…");
  });
  it("appends stale suffix past 45s", () => {
    expect(stageText(ls("computing", 60))).toBe("Computing… (no progress for 60s)");
    expect(stageText(ls("computing", 30))).toBe("Computing…");
  });
});

describe("formatGb", () => {
  it("renders one decimal", () => {
    expect(formatGb(8.42 * 1024 ** 3)).toBe("8.4");
    expect(formatGb(0)).toBe("0.0");
  });
});
