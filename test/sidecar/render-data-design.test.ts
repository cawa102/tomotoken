import { describe, it, expect } from "vitest";
import { buildRenderData } from "../../src/sidecar/render-data.js";
import type { AppState } from "../../src/store/types.js";

describe("buildRenderData with generatedDesigns", () => {
  const mockDesign = {
    parts: [{
      name: "body",
      primitive: "sphere" as const,
      position: [0, 0.5, 0] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      scale: [0.5, 0.6, 0.4] as [number, number, number],
      color: "#ff8844",
      material: { roughness: 0.7, metalness: 0.05, flatShading: true },
    }],
    expressions: { default: {} },
    personality: { name: "Patches", quirk: "curious" },
  };

  it("includes creatureDesign in render data when available", () => {
    const state: AppState = {
      version: 2,
      calibration: { t0: 10000, monthlyEstimate: 50000, calibratedAt: "2026-01-01T00:00:00Z" },
      spawnIndexCurrentMonth: 0,
      currentMonth: "2026-01",
      currentPet: {
        petId: "test-design",
        spawnedAt: "2026-01-15T00:00:00Z",
        requiredTokens: 10000,
        consumedTokens: 5000,
        spawnIndex: 0,
        personalitySnapshot: {
          usageMix: {},
          depthMetrics: { editTestLoopCount: 5, repeatEditSameFileCount: 2, phaseSwitchCount: 3, totalSessions: 10 },
          styleMetrics: { bulletRatio: 0.3, questionRatio: 0.1, codeblockRatio: 0.4, avgMessageLen: 120, messageLenStd: 40, headingRatio: 0.2 },
          traits: { builder: 50, fixer: 30, refiner: 20, scholar: 40, scribe: 10, architect: 60, operator: 25, guardian: 35 },
        },
        generatedDesigns: { 3: mockDesign },
      },
      ingestionState: { files: {} },
      globalStats: { totalTokensAllTime: 50000, totalSessionsIngested: 10, earliestTimestamp: "2026-01-01", latestTimestamp: "2026-01-20" },
      lastEncouragementShownAt: null,
    };

    const seed = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
    const renderData = buildRenderData(state, seed);
    expect(renderData.creatureDesign).toEqual(mockDesign);
  });

  it("returns null creatureDesign when no design for current stage", () => {
    const state: AppState = {
      version: 2,
      calibration: { t0: 10000, monthlyEstimate: 50000, calibratedAt: "2026-01-01T00:00:00Z" },
      spawnIndexCurrentMonth: 0,
      currentMonth: "2026-01",
      currentPet: {
        petId: "test-no-design",
        spawnedAt: "2026-01-15T00:00:00Z",
        requiredTokens: 10000,
        consumedTokens: 5000,
        spawnIndex: 0,
        personalitySnapshot: null,
        generatedDesigns: null,
      },
      ingestionState: { files: {} },
      globalStats: { totalTokensAllTime: 50000, totalSessionsIngested: 10, earliestTimestamp: "2026-01-01", latestTimestamp: "2026-01-20" },
      lastEncouragementShownAt: null,
    };

    const seed = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
    const renderData = buildRenderData(state, seed);
    expect(renderData.creatureDesign).toBeNull();
  });
});
