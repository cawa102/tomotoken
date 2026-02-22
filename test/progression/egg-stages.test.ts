import { describe, it, expect } from "vitest";
import { computeEggStage } from "../../src/progression/stages.js";

describe("computeEggStage", () => {
  it("returns 0 for 0% progress (pristine egg)", () => {
    expect(computeEggStage(0)).toBe(0);
  });

  it("returns 0 for 24% progress", () => {
    expect(computeEggStage(0.24)).toBe(0);
  });

  it("returns 1 for 25% progress (small cracks)", () => {
    expect(computeEggStage(0.25)).toBe(1);
  });

  it("returns 1 for 49% progress", () => {
    expect(computeEggStage(0.49)).toBe(1);
  });

  it("returns 2 for 50% progress (many cracks)", () => {
    expect(computeEggStage(0.50)).toBe(2);
  });

  it("returns 2 for 74% progress", () => {
    expect(computeEggStage(0.74)).toBe(2);
  });

  it("returns 3 for 75% progress (large fractures)", () => {
    expect(computeEggStage(0.75)).toBe(3);
  });

  it("returns 3 for 99% progress", () => {
    expect(computeEggStage(0.99)).toBe(3);
  });

  it("returns 4 for 100% progress (hatched)", () => {
    expect(computeEggStage(1.0)).toBe(4);
  });

  it("clamps negative progress to stage 0", () => {
    expect(computeEggStage(-0.1)).toBe(0);
  });

  it("returns 4 for progress > 1.0", () => {
    expect(computeEggStage(1.5)).toBe(4);
  });
});
