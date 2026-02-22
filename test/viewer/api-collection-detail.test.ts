import { describe, it, expect } from "vitest";
import type { Collection, CompletedPet, PersonalitySnapshot } from "../../src/store/types.js";
import { findPetById } from "../../src/viewer/api-collection.js";

const mockPersonality: PersonalitySnapshot = {
  usageMix: { builder: 5, fixer: 3 },
  depthMetrics: { editTestLoopCount: 2, repeatEditSameFileCount: 1, phaseSwitchCount: 1, totalSessions: 5 },
  styleMetrics: { bulletRatio: 0.2, questionRatio: 0.1, codeblockRatio: 0.3, avgMessageLen: 100, messageLenStd: 30, headingRatio: 0.1 },
  traits: { builder: 80, fixer: 60, scholar: 40 },
};

const mockPet: CompletedPet = {
  petId: "abc12345",
  spawnedAt: "2026-01-01T00:00:00Z",
  completedAt: "2026-02-01T00:00:00Z",
  requiredTokens: 1_000_000_000,
  consumedTokens: 1_000_000_000,
  spawnIndex: 0,
  personality: mockPersonality,
  seed: "seed123",
};

describe("findPetById", () => {
  const collection: Collection = { version: 2, pets: [mockPet] };

  it("returns pet with full personality when found", () => {
    const result = findPetById(collection, "abc12345");
    expect(result).not.toBeNull();
    expect(result!.petId).toBe("abc12345");
    expect(result!.personality).toEqual(mockPersonality);
  });

  it("returns null for unknown petId", () => {
    expect(findPetById(collection, "unknown")).toBeNull();
  });

  it("returns correct pet from multi-pet collection", () => {
    const secondPet: CompletedPet = { ...mockPet, petId: "def67890" };
    const multiCollection: Collection = { version: 2, pets: [mockPet, secondPet] };
    const result = findPetById(multiCollection, "def67890");
    expect(result).not.toBeNull();
    expect(result!.petId).toBe("def67890");
  });
});
