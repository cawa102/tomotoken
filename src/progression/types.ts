import type { CompletedPet, PetRecord } from "../store/types.js";

export interface AdvanceResult {
  readonly updatedPet: PetRecord;
  readonly completedPets: readonly CompletedPet[];
  readonly newSpawnIndex: number;
  readonly remainingTokens: number;
}

export interface CalibrationInput {
  readonly totalTokensAllTime: number;
  readonly earliestTimestamp: string;
  readonly latestTimestamp: string;
}

export interface CalibrationResult {
  readonly monthlyEstimate: number;
  readonly t0: number;
}
