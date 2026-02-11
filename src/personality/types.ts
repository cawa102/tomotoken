import type { CATEGORY_IDS, TRAIT_IDS } from "../config/constants.js";

export type CategoryId = (typeof CATEGORY_IDS)[number];
export type TraitId = (typeof TRAIT_IDS)[number];

export type UsageMix = Record<CategoryId, number>;
export type TraitVector = Record<TraitId, number>;

export interface ClassificationSignals {
  readonly editedExtensions: readonly string[];
  readonly toolTransitions: readonly string[];
  readonly bashCommands: readonly string[];
  readonly toolUseCounts: Record<string, number>;
}

export interface SessionClassification {
  readonly scores: UsageMix;
  readonly primaryCategory: CategoryId;
}
