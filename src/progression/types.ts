import type { CompletedPet, PetRecord } from "../store/types.js";

export interface AdvanceResult {
  readonly updatedPet: PetRecord;
  readonly completedPets: readonly CompletedPet[];
  readonly remainingTokens: number;
}
