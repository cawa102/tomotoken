import { describe, it, expect } from "vitest";
import { isFirstRun } from "../../src/first-run/detect.js";
import type { AppState, Collection } from "../../src/store/types.js";

const emptyCollection: Collection = { version: 2, pets: [] };

describe("isFirstRun", () => {
  it("returns true when state is null", () => {
    expect(isFirstRun(null, emptyCollection)).toBe(true);
  });

  it("returns true when collection is empty and pet has no consumed tokens", () => {
    const state: AppState = {
      version: 2,
      currentMonth: "2026-02",
      currentPet: {
        petId: "p1",
        spawnedAt: "2026-01-01T00:00:00Z",
        requiredTokens: 1_000_000_000,
        consumedTokens: 0,
        spawnIndex: 0,
        personalitySnapshot: null,
        generatedDesigns: null,
      },
      ingestionState: { files: {} },
      globalStats: {
        totalTokensAllTime: 0,
        totalSessionsIngested: 0,
        earliestTimestamp: null,
        latestTimestamp: null,
      },
      lastEncouragementShownAt: null,
    };
    expect(isFirstRun(state, emptyCollection)).toBe(true);
  });

  it("returns false when collection has pets", () => {
    const state: AppState = {
      version: 2,
      currentMonth: "2026-02",
      currentPet: {
        petId: "p2",
        spawnedAt: "2026-02-01T00:00:00Z",
        requiredTokens: 1_000_000_000,
        consumedTokens: 0,
        spawnIndex: 1,
        personalitySnapshot: null,
        generatedDesigns: null,
      },
      ingestionState: { files: {} },
      globalStats: {
        totalTokensAllTime: 1_000_000_000,
        totalSessionsIngested: 50,
        earliestTimestamp: "2026-01-01T00:00:00Z",
        latestTimestamp: "2026-02-01T00:00:00Z",
      },
      lastEncouragementShownAt: null,
    };
    const collection: Collection = {
      version: 2,
      pets: [
        {
          petId: "p1",
          spawnedAt: "2026-01-01T00:00:00Z",
          completedAt: "2026-02-01T00:00:00Z",
          requiredTokens: 1_000_000_000,
          consumedTokens: 1_000_000_000,
          spawnIndex: 0,
          personality: {
            usageMix: {},
            depthMetrics: {
              editTestLoopCount: 0,
              repeatEditSameFileCount: 0,
              phaseSwitchCount: 0,
              totalSessions: 0,
            },
            styleMetrics: {
              bulletRatio: 0,
              questionRatio: 0,
              codeblockRatio: 0,
              avgMessageLen: 0,
              messageLenStd: 0,
              headingRatio: 0,
            },
            traits: {},
          },
          seed: "abc",
        },
      ],
    };
    expect(isFirstRun(state, collection)).toBe(false);
  });

  it("returns false when pet has consumed tokens", () => {
    const state: AppState = {
      version: 2,
      currentMonth: "2026-02",
      currentPet: {
        petId: "p1",
        spawnedAt: "2026-01-01T00:00:00Z",
        requiredTokens: 1_000_000_000,
        consumedTokens: 500_000_000,
        spawnIndex: 0,
        personalitySnapshot: null,
        generatedDesigns: null,
      },
      ingestionState: { files: {} },
      globalStats: {
        totalTokensAllTime: 500_000_000,
        totalSessionsIngested: 20,
        earliestTimestamp: "2026-01-01T00:00:00Z",
        latestTimestamp: "2026-02-01T00:00:00Z",
      },
      lastEncouragementShownAt: null,
    };
    expect(isFirstRun(state, emptyCollection)).toBe(false);
  });
});
