import { TRAIT_IDS } from "../../config/constants.js";
import type { Collection } from "../../store/types.js";

export function getTopTrait(traits: Record<string, number>): string {
  const sorted = [...TRAIT_IDS].sort((a, b) => (traits[b] ?? 0) - (traits[a] ?? 0));
  return sorted[0];
}

export interface CollectionStatsData {
  readonly totalPets: number;
  readonly totalTokens: number;
  readonly avgTokensPerPet: number;
  readonly firstCompletedAt: string | null;
  readonly latestCompletedAt: string | null;
  readonly archetypeDistribution: readonly { readonly archetype: string; readonly count: number }[];
  readonly rarestArchetype: string | null;
  readonly mostCommonArchetype: string | null;
}

export function computeCollectionStats(collection: Collection): CollectionStatsData {
  const { pets } = collection;

  if (pets.length === 0) {
    return {
      totalPets: 0, totalTokens: 0, avgTokensPerPet: 0,
      firstCompletedAt: null, latestCompletedAt: null,
      archetypeDistribution: [], rarestArchetype: null, mostCommonArchetype: null,
    };
  }

  const totalTokens = pets.reduce((sum, p) => sum + p.consumedTokens, 0);
  const dates = [...pets].sort((a, b) => a.completedAt.localeCompare(b.completedAt));

  const counts: Record<string, number> = {};
  for (const pet of pets) {
    const arch = getTopTrait(pet.personality.traits);
    counts[arch] = (counts[arch] ?? 0) + 1;
  }

  const distribution = Object.entries(counts)
    .map(([archetype, count]) => ({ archetype, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalPets: pets.length,
    totalTokens,
    avgTokensPerPet: Math.round(totalTokens / pets.length),
    firstCompletedAt: dates[0].completedAt,
    latestCompletedAt: dates[dates.length - 1].completedAt,
    archetypeDistribution: distribution,
    mostCommonArchetype: distribution[0].archetype,
    rarestArchetype: distribution[distribution.length - 1].archetype,
  };
}
