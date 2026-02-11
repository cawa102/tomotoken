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
    expect(result.traits.builder).toBeGreaterThanOrEqual(30);
    expect(result.traits.builder).toBeLessThanOrEqual(50);
  });

  it("selects archetype as highest trait", () => {
    const result = computeTraits(MIX, DEPTH, STYLE);
    expect(result.archetype).toBe("builder");
  });

  it("selects subtype as second highest", () => {
    const result = computeTraits(MIX, DEPTH, STYLE);
    expect(result.subtype).toBe("fixer");
  });

  it("clamps all traits to [0, 100]", () => {
    const result = computeTraits(MIX, DEPTH, STYLE);
    for (const val of Object.values(result.traits)) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(100);
    }
  });

  it("trait scores sum is deterministic", () => {
    const r1 = computeTraits(MIX, DEPTH, STYLE);
    const r2 = computeTraits(MIX, DEPTH, STYLE);
    expect(r1).toEqual(r2);
  });
});
