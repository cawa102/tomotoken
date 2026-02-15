import { describe, it, expect } from "vitest";
import { computeTraits } from "../../src/personality/traits.js";
import type { UsageMix } from "../../src/personality/types.js";
import type { DepthMetrics, StyleMetrics } from "../../src/store/types.js";

const MIX: UsageMix = {
  impl: 0.4, debug: 0.2, refactor: 0.1, research: 0.1,
  docs: 0.05, planning: 0.05, ops: 0.05, security: 0.05,
};

const DEPTH: DepthMetrics = {
  editTestLoopCount: 5, repeatEditSameFileCount: 3,
  phaseSwitchCount: 10, totalSessions: 5,
};

const STYLE: StyleMetrics = {
  bulletRatio: 0.3, questionRatio: 0.02, codeblockRatio: 0.1,
  avgMessageLen: 200, messageLenStd: 50, headingRatio: 0.05,
};

describe("computeTraits", () => {
  it("maps usage_mix to base trait scores", () => {
    const result = computeTraits(MIX, DEPTH, STYLE);
    expect(result.builder).toBeGreaterThanOrEqual(30);
    expect(result.builder).toBeLessThanOrEqual(50);
  });

  it("returns highest trait as builder for impl-heavy mix", () => {
    const result = computeTraits(MIX, DEPTH, STYLE);
    // Builder should be highest since impl=0.4 is dominant
    const sorted = Object.entries(result).sort(([, a], [, b]) => b - a);
    expect(sorted[0][0]).toBe("builder");
  });

  it("clamps all traits to [0, 100]", () => {
    const result = computeTraits(MIX, DEPTH, STYLE);
    for (const val of Object.values(result)) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(100);
    }
  });

  it("is deterministic", () => {
    const r1 = computeTraits(MIX, DEPTH, STYLE);
    const r2 = computeTraits(MIX, DEPTH, STYLE);
    expect(r1).toEqual(r2);
  });

  it("returns a TraitVector with all 8 trait IDs", () => {
    const result = computeTraits(MIX, DEPTH, STYLE);
    const expected = ["builder", "fixer", "refiner", "scholar", "scribe", "architect", "operator", "guardian"];
    for (const id of expected) {
      expect(result[id]).toBeDefined();
      expect(typeof result[id]).toBe("number");
    }
  });

  it("applies depth/style adjustments", () => {
    const noDepth: DepthMetrics = { editTestLoopCount: 0, repeatEditSameFileCount: 0, phaseSwitchCount: 0, totalSessions: 0 };
    const noStyle: StyleMetrics = { bulletRatio: 0, questionRatio: 0, codeblockRatio: 0, avgMessageLen: 0, messageLenStd: 0, headingRatio: 0 };
    const base = computeTraits(MIX, noDepth, noStyle);
    const adjusted = computeTraits(MIX, DEPTH, STYLE);
    // With depth/style, some traits should be boosted
    expect(adjusted.fixer).toBeGreaterThanOrEqual(base.fixer);
  });
});
