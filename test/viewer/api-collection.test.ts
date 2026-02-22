import { describe, it, expect } from "vitest";
import type { Collection, CompletedPet, PersonalitySnapshot } from "../../src/store/types.js";
import { buildCollectionResponse } from "../../src/viewer/api-collection.js";

const mockPersonality: PersonalitySnapshot = {
  usageMix: {},
  depthMetrics: { editTestLoopCount: 0, repeatEditSameFileCount: 0, phaseSwitchCount: 0, totalSessions: 0 },
  styleMetrics: { bulletRatio: 0, questionRatio: 0, codeblockRatio: 0, avgMessageLen: 0, messageLenStd: 0, headingRatio: 0 },
  traits: { builder: 80, fixer: 60 },
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

describe("buildCollectionResponse", () => {
  it("maps CompletedPet to collection response with hasSnapshot", () => {
    const collection: Collection = { version: 2, pets: [mockPet] };
    const result = buildCollectionResponse(collection, new Set(["abc12345"]));

    expect(result.pets).toHaveLength(1);
    expect(result.pets[0].petId).toBe("abc12345");
    expect(result.pets[0].archetype).toBe("builder");
    expect(result.pets[0].subtype).toBe("fixer");
    expect(result.pets[0].hasSnapshot).toBe(true);
    // Should not include full personality object
    expect(result.pets[0]).not.toHaveProperty("personality");
  });

  it("returns hasSnapshot false when no snapshot exists", () => {
    const collection: Collection = { version: 2, pets: [mockPet] };
    const result = buildCollectionResponse(collection, new Set());

    expect(result.pets[0].hasSnapshot).toBe(false);
  });

  it("returns empty pets array for empty collection", () => {
    const collection: Collection = { version: 2, pets: [] };
    const result = buildCollectionResponse(collection, new Set());

    expect(result.pets).toHaveLength(0);
  });

  it("includes consumedTokens and date fields", () => {
    const collection: Collection = { version: 2, pets: [mockPet] };
    const result = buildCollectionResponse(collection, new Set());

    expect(result.pets[0].consumedTokens).toBe(1_000_000_000);
    expect(result.pets[0].spawnedAt).toBe("2026-01-01T00:00:00Z");
    expect(result.pets[0].completedAt).toBe("2026-02-01T00:00:00Z");
  });

  it("includes trait scores", () => {
    const collection: Collection = { version: 2, pets: [mockPet] };
    const result = buildCollectionResponse(collection, new Set());

    expect(result.pets[0].traits).toEqual({ builder: 80, fixer: 60 });
  });
});
