import { describe, it, expect } from "vitest";
import { advancePet } from "../../src/progression/engine.js";
import type { PetRecord } from "../../src/store/types.js";

function makePet(overrides: Partial<PetRecord> = {}): PetRecord {
  return {
    petId: "pet-1",
    spawnedAt: "2026-01-01T00:00:00Z",
    requiredTokens: 1000,
    consumedTokens: 0,
    spawnIndex: 0,
    personalitySnapshot: null,
    ...overrides,
  };
}

describe("advancePet", () => {
  it("adds tokens without completing", () => {
    const result = advancePet(makePet(), 500, 1000, 1.5, 0);
    expect(result.updatedPet.consumedTokens).toBe(500);
    expect(result.completedPets).toHaveLength(0);
    expect(result.remainingTokens).toBe(0);
  });

  it("completes pet at exact threshold", () => {
    const result = advancePet(makePet({ consumedTokens: 800 }), 200, 1000, 1.5, 0);
    expect(result.completedPets).toHaveLength(1);
    expect(result.completedPets[0].consumedTokens).toBe(1000);
    expect(result.updatedPet.consumedTokens).toBe(0); // new pet
    expect(result.newSpawnIndex).toBe(1);
  });

  it("handles overflow completing multiple pets", () => {
    // Pet needs 100 more. Delta = 5000. T0=1000, g=1.5
    // Pet 0: needs 100, done. Remaining: 4900. spawn_idx=1
    // Pet 1: needs 1000*1.5^1=1500, done. Remaining: 3400. spawn_idx=2
    // Pet 2: needs 1000*1.5^2=2250, done. Remaining: 1150. spawn_idx=3
    // Pet 3: needs 1000*1.5^3=3375, not done. Consumed: 1150
    const result = advancePet(
      makePet({ consumedTokens: 900, requiredTokens: 1000 }),
      5000,
      1000,
      1.5,
      0,
    );
    expect(result.completedPets).toHaveLength(3);
    expect(result.updatedPet.consumedTokens).toBe(1150);
    expect(result.newSpawnIndex).toBe(3);
  });

  it("carries progress into new pet", () => {
    const result = advancePet(makePet({ consumedTokens: 900 }), 300, 1000, 1.5, 0);
    expect(result.completedPets).toHaveLength(1);
    // Overflow: 300 - 100 = 200 into new pet
    expect(result.updatedPet.consumedTokens).toBe(200);
  });
});
