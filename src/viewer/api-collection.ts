import type { Collection, CompletedPet } from "../store/types.js";
import type { PetRenderData } from "../art3d/types.js";
import { TRAIT_IDS } from "../config/constants.js";
import { createPrng } from "../utils/hash.js";
import { deriveCreatureParams, adjustParamsForProgress } from "../creature/index.js";
import { generatePalette, paletteToHexArray } from "../palette/index.js";
import { computeEggStage } from "../progression/stages.js";

export interface CollectionPetSummary {
  readonly petId: string;
  readonly archetype: string;
  readonly subtype: string;
  readonly traits: Record<string, number>;
  readonly consumedTokens: number;
  readonly spawnedAt: string;
  readonly completedAt: string;
  readonly hasSnapshot: boolean;
}

export interface CollectionResponse {
  readonly pets: readonly CollectionPetSummary[];
}

function deriveTopTwo(traits: Record<string, number>): { archetype: string; subtype: string } {
  const sorted = [...TRAIT_IDS].sort((a, b) => (traits[b] ?? 0) - (traits[a] ?? 0));
  return { archetype: sorted[0] ?? "unknown", subtype: sorted[1] ?? "unknown" };
}

export function findPetById(collection: Collection, petId: string): CompletedPet | null {
  return collection.pets.find((p) => p.petId === petId) ?? null;
}

/**
 * Build PetRenderData for a completed pet (always progress=1.0, stage=4).
 */
export function buildCompletedPetRenderData(pet: CompletedPet): PetRenderData {
  const snapshot = pet.personality;
  const traits = snapshot.traits;
  const { archetype, subtype } = deriveTopTwo(traits);

  const prng = createPrng(pet.seed);
  const rawParams = deriveCreatureParams(traits, snapshot.depthMetrics, snapshot.styleMetrics, prng);
  const creatureParams = adjustParamsForProgress(rawParams, 1.0);
  const palette = generatePalette(traits, snapshot.depthMetrics, snapshot.styleMetrics, prng);
  const hexPalette = paletteToHexArray(palette);

  const stage = computeEggStage(1.0); // always 4 for completed pets

  return {
    creatureParams,
    palette: hexPalette,
    progress: 1.0,
    petId: pet.petId,
    seed: pet.seed,
    archetype,
    subtype,
    stage,
    traits,
    creatureDesign: null, // completed pets don't store designs
  };
}

export function buildCollectionResponse(
  collection: Collection,
  snapshotPetIds: ReadonlySet<string>,
): CollectionResponse {
  return {
    pets: collection.pets.map((pet) => {
      const { archetype, subtype } = deriveTopTwo(pet.personality.traits);
      return {
        petId: pet.petId,
        archetype,
        subtype,
        traits: pet.personality.traits,
        consumedTokens: pet.consumedTokens,
        spawnedAt: pet.spawnedAt,
        completedAt: pet.completedAt,
        hasSnapshot: snapshotPetIds.has(pet.petId),
      };
    }),
  };
}
