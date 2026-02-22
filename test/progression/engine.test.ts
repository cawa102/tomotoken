import { describe, it, expect } from "vitest";
import { advancePet } from "../../src/progression/engine.js";
import { TOKENS_PER_PET } from "../../src/config/constants.js";
import type { PetRecord } from "../../src/store/types.js";

function makePet(overrides: Partial<PetRecord> = {}): PetRecord {
  return {
    petId: "pet-1",
    spawnedAt: "2026-01-01T00:00:00Z",
    requiredTokens: 1000,
    consumedTokens: 0,
    spawnIndex: 0,
    personalitySnapshot: null,
    generatedDesigns: null,
    ...overrides,
  };
}

describe("advancePet", () => {
  it("adds tokens without completing", () => {
    const result = advancePet(makePet(), 500);
    expect(result.updatedPet.consumedTokens).toBe(500);
    expect(result.completedPets).toHaveLength(0);
    expect(result.remainingTokens).toBe(0);
  });

  it("completes pet at exact threshold", () => {
    const result = advancePet(makePet({ consumedTokens: 800 }), 200);
    expect(result.completedPets).toHaveLength(1);
    expect(result.completedPets[0].consumedTokens).toBe(1000);
    expect(result.updatedPet.consumedTokens).toBe(0); // new pet
    expect(result.updatedPet.requiredTokens).toBe(TOKENS_PER_PET);
    expect(result.updatedPet.spawnIndex).toBe(1);
  });

  it("handles overflow completing a pet with carry-over", () => {
    const result = advancePet(makePet({ consumedTokens: 900 }), 300);
    expect(result.completedPets).toHaveLength(1);
    // Overflow: 300 - 100 = 200 into new pet
    expect(result.updatedPet.consumedTokens).toBe(200);
    expect(result.updatedPet.requiredTokens).toBe(TOKENS_PER_PET);
  });

  it("new pet after completion always costs TOKENS_PER_PET", () => {
    const result = advancePet(makePet({ requiredTokens: 500 }), 500);
    expect(result.completedPets).toHaveLength(1);
    expect(result.updatedPet.requiredTokens).toBe(TOKENS_PER_PET);
  });

  it("increments spawnIndex for each completed pet", () => {
    // Pet needs 100 more, delta large enough to complete it
    const result = advancePet(makePet({ consumedTokens: 900 }), 200);
    expect(result.completedPets).toHaveLength(1);
    expect(result.updatedPet.spawnIndex).toBe(1);
  });
});
