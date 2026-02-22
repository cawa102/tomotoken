import { describe, it, expect } from "vitest";
import type { CompletedPet, PersonalitySnapshot } from "../../src/store/types.js";
import { buildCompletedPetRenderData } from "../../src/viewer/api-collection.js";

const mockPersonality: PersonalitySnapshot = {
  usageMix: { builder: 5, fixer: 3 },
  depthMetrics: { editTestLoopCount: 2, repeatEditSameFileCount: 1, phaseSwitchCount: 1, totalSessions: 5 },
  styleMetrics: { bulletRatio: 0.2, questionRatio: 0.1, codeblockRatio: 0.3, avgMessageLen: 100, messageLenStd: 30, headingRatio: 0.1 },
  traits: { builder: 80, fixer: 60, scholar: 40, refiner: 30, scribe: 20, architect: 10, operator: 15, guardian: 25 },
};

const mockPet: CompletedPet = {
  petId: "abc12345",
  spawnedAt: "2026-01-01T00:00:00Z",
  completedAt: "2026-02-01T00:00:00Z",
  requiredTokens: 1_000_000_000,
  consumedTokens: 1_000_000_000,
  spawnIndex: 0,
  personality: mockPersonality,
  seed: "seed123abc",
};

describe("buildCompletedPetRenderData", () => {
  it("returns PetRenderData with progress=1.0 for completed pet", () => {
    const result = buildCompletedPetRenderData(mockPet);
    expect(result.progress).toBe(1.0);
    expect(result.petId).toBe("abc12345");
    expect(result.seed).toBe("seed123abc");
    expect(result.archetype).toBe("builder");
    expect(result.subtype).toBe("fixer");
    expect(result.stage).toBe(4); // fully hatched
  });

  it("returns hex palette array", () => {
    const result = buildCompletedPetRenderData(mockPet);
    expect(result.palette).toBeInstanceOf(Array);
    expect(result.palette.length).toBeGreaterThan(0);
    expect(result.palette[0]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("returns creatureParams with valid shape", () => {
    const result = buildCompletedPetRenderData(mockPet);
    expect(result.creatureParams).toHaveProperty("headRatio");
    expect(result.creatureParams).toHaveProperty("bodyWidthRatio");
    expect(result.creatureParams).toHaveProperty("limbStage");
  });

  it("is deterministic for the same pet", () => {
    const result1 = buildCompletedPetRenderData(mockPet);
    const result2 = buildCompletedPetRenderData(mockPet);
    expect(result1).toEqual(result2);
  });
});
