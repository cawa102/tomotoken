import { describe, it, expect } from "vitest";
import { buildRenderData } from "../../src/sidecar/render-data.js";
import type { AppState } from "../../src/store/types.js";

function createTestState(overrides: Partial<AppState["currentPet"]> = {}): AppState {
  return {
    version: 2,
    calibration: { t0: 10000, monthlyEstimate: 50000, calibratedAt: "2026-01-01T00:00:00Z" },
    spawnIndexCurrentMonth: 0,
    currentMonth: "2026-01",
    currentPet: {
      petId: "test-pet-001",
      spawnedAt: "2026-01-15T00:00:00Z",
      requiredTokens: 10000,
      consumedTokens: 5000,
      spawnIndex: 0,
      personalitySnapshot: {
        usageMix: { coding: 40, debugging: 20, writing: 15, testing: 10, ops: 5, learning: 5, design: 3, security: 2 },
        depthMetrics: { editTestLoopCount: 5, repeatEditSameFileCount: 2, phaseSwitchCount: 3, totalSessions: 10 },
        styleMetrics: { bulletRatio: 0.3, questionRatio: 0.1, codeblockRatio: 0.4, avgMessageLen: 120, messageLenStd: 40, headingRatio: 0.2 },
        traits: { builder: 50, fixer: 30, refiner: 20, scholar: 40, scribe: 10, architect: 60, operator: 25, guardian: 35 },
      },
      generatedDesigns: null,
      ...overrides,
    },
    ingestionState: { files: {} },
    globalStats: { totalTokensAllTime: 50000, totalSessionsIngested: 10, earliestTimestamp: "2026-01-01", latestTimestamp: "2026-01-20" },
    lastEncouragementShownAt: null,
  };
}

describe("buildRenderData", () => {
  const seed = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

  it("returns correct progress based on consumed/required tokens", () => {
    const state = createTestState({ consumedTokens: 5000, requiredTokens: 10000 });
    const data = buildRenderData(state, seed);
    expect(data.progress).toBeCloseTo(0.5);
  });

  it("clamps progress to 1.0 when tokens exceed required", () => {
    const state = createTestState({ consumedTokens: 15000, requiredTokens: 10000 });
    const data = buildRenderData(state, seed);
    expect(data.progress).toBe(1.0);
  });

  it("returns progress 0 when requiredTokens is 0", () => {
    const state = createTestState({ requiredTokens: 0 });
    const data = buildRenderData(state, seed);
    expect(data.progress).toBe(0);
  });

  it("derives archetype as highest trait", () => {
    const state = createTestState();
    const data = buildRenderData(state, seed);
    // architect=60 is the highest
    expect(data.archetype).toBe("architect");
  });

  it("derives subtype as second highest trait", () => {
    const state = createTestState();
    const data = buildRenderData(state, seed);
    // builder=50 is the second highest
    expect(data.subtype).toBe("builder");
  });

  it("includes creature params with expected fields", () => {
    const state = createTestState();
    const data = buildRenderData(state, seed);
    expect(data.creatureParams).toBeDefined();
    expect(typeof data.creatureParams.headRatio).toBe("number");
    expect(typeof data.creatureParams.bodyWidthRatio).toBe("number");
    expect(typeof data.creatureParams.roundness).toBe("number");
    expect(typeof data.creatureParams.hasEars).toBe("boolean");
    expect(typeof data.creatureParams.limbStage).toBe("number");
  });

  it("includes hex palette with 10 colors", () => {
    const state = createTestState();
    const data = buildRenderData(state, seed);
    expect(data.palette).toHaveLength(10);
    for (const color of data.palette) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("includes correct stage based on progress", () => {
    const state50 = createTestState({ consumedTokens: 5000, requiredTokens: 10000 });
    const data50 = buildRenderData(state50, seed);
    expect(data50.stage).toBe(3); // progress=0.5 → stage 3 (>=0.5, <0.7)

    const state10 = createTestState({ consumedTokens: 1000, requiredTokens: 10000 });
    const data10 = buildRenderData(state10, seed);
    expect(data10.stage).toBe(1); // progress=0.1 → stage 1 (>=0.1, <0.3)

    const state100 = createTestState({ consumedTokens: 10000, requiredTokens: 10000 });
    const data100 = buildRenderData(state100, seed);
    expect(data100.stage).toBe(5); // progress=1.0 → stage 5
  });

  it("is deterministic: same state+seed produces identical output", () => {
    const state = createTestState();
    const data1 = buildRenderData(state, seed);
    const data2 = buildRenderData(state, seed);
    expect(data1).toEqual(data2);
  });

  it("produces different output for different seeds", () => {
    const state = createTestState();
    const seed2 = "1111111111111111111111111111111111111111111111111111111111111111";
    const data1 = buildRenderData(state, seed);
    const data2 = buildRenderData(state, seed2);
    // Params should differ because PRNG is seeded differently
    expect(data1.creatureParams.headRatio).not.toBe(data2.creatureParams.headRatio);
  });

  it("handles missing personality snapshot gracefully", () => {
    const state = createTestState({ personalitySnapshot: null });
    const data = buildRenderData(state, seed);
    expect(data.archetype).toBeDefined();
    expect(data.creatureParams).toBeDefined();
    expect(data.palette).toHaveLength(10);
  });
});
