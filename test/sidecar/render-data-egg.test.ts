import { describe, it, expect } from "vitest";
import { buildRenderData } from "../../src/sidecar/render-data.js";
import type { AppState } from "../../src/store/types.js";

function makeState(consumedTokens: number, requiredTokens: number): AppState {
  return {
    version: 2,
    calibration: { monthlyEstimate: 100000, t0: 50000, calibratedAt: "2026-02-01T00:00:00Z" },
    spawnIndexCurrentMonth: 0,
    currentMonth: "2026-02",
    currentPet: {
      petId: "test-pet-id",
      spawnedAt: "2026-02-01T00:00:00Z",
      requiredTokens,
      consumedTokens,
      spawnIndex: 0,
      personalitySnapshot: null,
      generatedDesigns: null,
    },
    ingestionState: { files: {} },
    globalStats: { totalTokensAllTime: 100000, totalSessionsIngested: 0, earliestTimestamp: "2026-01-01", latestTimestamp: "2026-02-01" },
    lastEncouragementShownAt: null,
  };
}

describe("buildRenderData egg stages", () => {
  it("returns stage 0 at 10% progress", () => {
    const data = buildRenderData(makeState(10000, 100000), "test-seed");
    expect(data.stage).toBe(0);
  });

  it("returns stage 1 at 30% progress", () => {
    const data = buildRenderData(makeState(30000, 100000), "test-seed");
    expect(data.stage).toBe(1);
  });

  it("returns stage 2 at 55% progress", () => {
    const data = buildRenderData(makeState(55000, 100000), "test-seed");
    expect(data.stage).toBe(2);
  });

  it("returns stage 3 at 80% progress", () => {
    const data = buildRenderData(makeState(80000, 100000), "test-seed");
    expect(data.stage).toBe(3);
  });

  it("returns stage 4 at 100% progress", () => {
    const data = buildRenderData(makeState(100000, 100000), "test-seed");
    expect(data.stage).toBe(4);
  });
});
