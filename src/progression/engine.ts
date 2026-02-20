import { v4 as uuidv4 } from "uuid";
import type { PetRecord, CompletedPet, PersonalitySnapshot } from "../store/types.js";
import type { AdvanceResult } from "./types.js";

const EMPTY_PERSONALITY: PersonalitySnapshot = {
  usageMix: {},
  depthMetrics: { editTestLoopCount: 0, repeatEditSameFileCount: 0, phaseSwitchCount: 0, totalSessions: 0 },
  styleMetrics: { bulletRatio: 0, questionRatio: 0, codeblockRatio: 0, avgMessageLen: 0, messageLenStd: 0, headingRatio: 0 },
  traits: {},
};

export function advancePet(
  currentPet: PetRecord,
  deltaTokens: number,
  t0: number,
  g: number,
  spawnIndex: number,
): AdvanceResult {
  let remaining = deltaTokens;
  let pet = currentPet;
  let idx = spawnIndex;
  const completed: CompletedPet[] = [];

  while (remaining > 0) {
    const need = pet.requiredTokens - pet.consumedTokens;

    if (remaining < need) {
      pet = { ...pet, consumedTokens: pet.consumedTokens + remaining };
      remaining = 0;
    } else {
      // Complete this pet
      remaining -= need;
      const completedPet: CompletedPet = {
        petId: pet.petId,
        spawnedAt: pet.spawnedAt,
        completedAt: new Date().toISOString(),
        requiredTokens: pet.requiredTokens,
        consumedTokens: pet.requiredTokens,
        spawnIndex: pet.spawnIndex,
        personality: pet.personalitySnapshot ?? EMPTY_PERSONALITY,
        frames: [],
        colorFrames: [],
        seed: "",
      };
      completed.push(completedPet);

      idx += 1;
      const newRequired = Math.ceil(t0 * Math.pow(g, idx));
      pet = {
        petId: uuidv4(),
        spawnedAt: new Date().toISOString(),
        requiredTokens: newRequired,
        consumedTokens: 0,
        spawnIndex: idx,
        personalitySnapshot: null,
        generatedDesigns: null,
      };
    }
  }

  return {
    updatedPet: pet,
    completedPets: completed,
    newSpawnIndex: idx,
    remainingTokens: remaining,
  };
}
