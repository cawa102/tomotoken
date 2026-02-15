import { describe, it, expect } from "vitest";
import { getTopTrait, computeCollectionStats } from "../../../src/ui/utils/collectionStats.js";
import type { Collection, CompletedPet } from "../../../src/store/types.js";

describe("getTopTrait", () => {
  it("returns the trait with the highest score", () => {
    const traits = {
      builder: 10, fixer: 50, refiner: 5, scholar: 20,
      scribe: 0, architect: 15, operator: 30, guardian: 3,
    };
    expect(getTopTrait(traits)).toBe("fixer");
  });

  it("returns first in TRAIT_IDS order on tie", () => {
    const traits = {
      builder: 50, fixer: 50, refiner: 0, scholar: 0,
      scribe: 0, architect: 0, operator: 0, guardian: 0,
    };
    // builder comes before fixer in TRAIT_IDS
    expect(getTopTrait(traits)).toBe("builder");
  });

  it("handles all-zero traits", () => {
    const traits = {
      builder: 0, fixer: 0, refiner: 0, scholar: 0,
      scribe: 0, architect: 0, operator: 0, guardian: 0,
    };
    expect(getTopTrait(traits)).toBe("builder"); // first in TRAIT_IDS
  });
});

function makePet(overrides: Partial<CompletedPet> = {}): CompletedPet {
  return {
    petId: "pet-" + Math.random().toString(36).slice(2, 10),
    spawnedAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-10T00:00:00.000Z",
    requiredTokens: 10_000,
    consumedTokens: 10_000,
    spawnIndex: 0,
    personality: {
      usageMix: {},
      depthMetrics: { editTestLoopCount: 0, repeatEditSameFileCount: 0, phaseSwitchCount: 0, totalSessions: 1 },
      styleMetrics: { bulletRatio: 0, questionRatio: 0, codeblockRatio: 0, avgMessageLen: 0, messageLenStd: 0, headingRatio: 0 },
      traits: { builder: 50, fixer: 30, refiner: 5, scholar: 5, scribe: 3, architect: 3, operator: 2, guardian: 2 },
    },
    frames: [["line1"]],
    colorFrames: [["line1"]],
    seed: "abc123",
    ...overrides,
  };
}

describe("computeCollectionStats", () => {
  it("returns zero stats for empty collection", () => {
    const collection: Collection = { version: 2, pets: [] };
    const stats = computeCollectionStats(collection);
    expect(stats.totalPets).toBe(0);
    expect(stats.totalTokens).toBe(0);
    expect(stats.avgTokensPerPet).toBe(0);
    expect(stats.firstCompletedAt).toBeNull();
    expect(stats.latestCompletedAt).toBeNull();
    expect(stats.archetypeDistribution).toEqual([]);
    expect(stats.rarestArchetype).toBeNull();
    expect(stats.mostCommonArchetype).toBeNull();
  });

  it("computes stats for multiple pets", () => {
    const collection: Collection = {
      version: 2,
      pets: [
        makePet({ consumedTokens: 10_000, completedAt: "2026-01-10T00:00:00.000Z" }),
        makePet({ consumedTokens: 20_000, completedAt: "2026-02-05T00:00:00.000Z",
          personality: {
            usageMix: {}, depthMetrics: { editTestLoopCount: 0, repeatEditSameFileCount: 0, phaseSwitchCount: 0, totalSessions: 1 },
            styleMetrics: { bulletRatio: 0, questionRatio: 0, codeblockRatio: 0, avgMessageLen: 0, messageLenStd: 0, headingRatio: 0 },
            traits: { builder: 10, fixer: 60, refiner: 5, scholar: 5, scribe: 3, architect: 3, operator: 2, guardian: 2 },
          },
        }),
      ],
    };
    const stats = computeCollectionStats(collection);
    expect(stats.totalPets).toBe(2);
    expect(stats.totalTokens).toBe(30_000);
    expect(stats.avgTokensPerPet).toBe(15_000);
    expect(stats.firstCompletedAt).toBe("2026-01-10T00:00:00.000Z");
    expect(stats.latestCompletedAt).toBe("2026-02-05T00:00:00.000Z");
    expect(stats.archetypeDistribution[0]).toEqual({ archetype: "builder", count: 1 });
    expect(stats.mostCommonArchetype).toBeTruthy();
    expect(stats.rarestArchetype).toBeTruthy();
  });

  it("does not mutate input collection", () => {
    const pets = [makePet()];
    const collection: Collection = { version: 2, pets };
    const petsBefore = JSON.stringify(collection);
    computeCollectionStats(collection);
    expect(JSON.stringify(collection)).toBe(petsBefore);
  });
});
