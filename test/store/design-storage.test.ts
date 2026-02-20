import { describe, it, expect } from "vitest";
import type { PetRecord } from "../../src/store/types.js";

describe("PetRecord with generatedDesigns", () => {
  it("allows generatedDesigns field", () => {
    const pet: PetRecord = {
      petId: "test-1",
      spawnedAt: "2026-01-01T00:00:00Z",
      requiredTokens: 10000,
      consumedTokens: 5000,
      spawnIndex: 0,
      personalitySnapshot: null,
      generatedDesigns: {
        0: {
          parts: [{
            name: "egg",
            primitive: "sphere",
            position: [0, 0.5, 0],
            rotation: [0, 0, 0],
            scale: [0.5, 0.65, 0.5],
            color: "#ffcc44",
            material: { roughness: 0.7, metalness: 0, flatShading: true },
          }],
          expressions: { default: {} },
          personality: { name: "Sunny", quirk: "warm glow" },
        },
      },
    };
    expect(pet.generatedDesigns).toBeDefined();
    expect(pet.generatedDesigns?.[0]?.personality.name).toBe("Sunny");
  });

  it("allows null generatedDesigns", () => {
    const pet: PetRecord = {
      petId: "test-2",
      spawnedAt: "2026-01-01T00:00:00Z",
      requiredTokens: 10000,
      consumedTokens: 0,
      spawnIndex: 0,
      personalitySnapshot: null,
      generatedDesigns: null,
    };
    expect(pet.generatedDesigns).toBeNull();
  });
});
