import type { PetRenderData } from "../art3d/types.js";
import type { AppState, PersonalitySnapshot } from "../store/types.js";
import { TRAIT_IDS } from "../config/constants.js";
import { createPrng } from "../utils/hash.js";
import { deriveCreatureParams, adjustParamsForProgress, computeLimbStage, paletteToHexArray, generatePalette } from "../art/parametric/index.js";

/**
 * Derive the archetype (highest trait) and subtype (second highest).
 */
function deriveArchetypeAndSubtype(traits: Record<string, number>): { archetype: string; subtype: string } {
  const sorted = [...TRAIT_IDS].sort((a, b) => (traits[b] ?? 0) - (traits[a] ?? 0));
  return { archetype: sorted[0], subtype: sorted[1] };
}

/**
 * Build PetRenderData from the current app state for the 3D viewer.
 *
 * Uses the same PRNG call order as generateParametricBody() to produce
 * identical CreatureParams and Palette values:
 *   1. deriveCreatureParams(prng)  — consumes N calls
 *   2. generatePalette(prng)       — consumes M calls
 */
export function buildRenderData(state: AppState, seed: string): PetRenderData {
  const pet = state.currentPet;
  const progress = pet.requiredTokens > 0
    ? Math.min(1.0, pet.consumedTokens / pet.requiredTokens)
    : 0;

  const snapshot: PersonalitySnapshot = pet.personalitySnapshot ?? {
    usageMix: {},
    depthMetrics: { editTestLoopCount: 0, repeatEditSameFileCount: 0, phaseSwitchCount: 0, totalSessions: 0 },
    styleMetrics: { bulletRatio: 0, questionRatio: 0, codeblockRatio: 0, avgMessageLen: 0, messageLenStd: 0, headingRatio: 0 },
    traits: Object.fromEntries(TRAIT_IDS.map((id) => [id, 0])),
  };

  const traits = snapshot.traits;
  const { archetype, subtype } = deriveArchetypeAndSubtype(traits);

  // Single PRNG, same call order as generateParametricBody()
  const prng = createPrng(seed);
  const rawParams = deriveCreatureParams(traits, snapshot.depthMetrics, snapshot.styleMetrics, prng);
  const creatureParams = adjustParamsForProgress(rawParams, progress);
  const palette = generatePalette(traits, snapshot.depthMetrics, snapshot.styleMetrics, prng);
  const hexPalette = paletteToHexArray(palette);

  const stage = computeLimbStage(progress);

  const creatureDesign = pet.generatedDesigns?.[stage] ?? null;

  return {
    creatureParams,
    palette: hexPalette,
    progress,
    petId: pet.petId,
    seed,
    archetype,
    subtype,
    stage,
    traits,
    creatureDesign,
  };
}
