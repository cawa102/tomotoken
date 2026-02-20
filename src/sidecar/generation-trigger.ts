import type { AppState } from "../store/types.js";
import { saveState, updatePetInState } from "../store/store.js";
import { generateCreatureDesign } from "../generation/designer.js";
import { computeLimbStage } from "../art/parametric/progress.js";
import { TRAIT_IDS } from "../config/constants.js";

function deriveArchetypeAndSubtype(traits: Record<string, number>): { archetype: string; subtype: string } {
  const sorted = [...TRAIT_IDS].sort((a, b) => (traits[b] ?? 0) - (traits[a] ?? 0));
  return { archetype: sorted[0], subtype: sorted[1] };
}

/**
 * Check if LLM generation should be triggered for the current stage.
 * If ANTHROPIC_API_KEY is set and no design exists for the current stage,
 * call the Claude API to generate a design and save it to state.
 *
 * Returns the (possibly updated) state. On failure, returns original state (PRNG fallback).
 */
export async function triggerGenerationIfNeeded(state: AppState): Promise<AppState> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return state;

  const pet = state.currentPet;
  const snapshot = pet.personalitySnapshot;
  if (!snapshot) return state;

  const progress = pet.requiredTokens > 0
    ? Math.min(1.0, pet.consumedTokens / pet.requiredTokens)
    : 0;
  const stage = computeLimbStage(progress);

  if (pet.generatedDesigns?.[stage]) return state;

  const { archetype, subtype } = deriveArchetypeAndSubtype(snapshot.traits);

  const previousStage = stage > 0 ? stage - 1 : null;
  const previousParts = previousStage !== null
    ? (pet.generatedDesigns?.[previousStage]?.parts ?? null)
    : null;

  try {
    const design = await generateCreatureDesign({
      archetype,
      subtype,
      traits: snapshot.traits,
      depth: snapshot.depthMetrics,
      style: snapshot.styleMetrics,
      stage,
      previousParts,
      apiKey,
    });

    const updatedDesigns = { ...(pet.generatedDesigns ?? {}), [stage]: design };
    const updatedState = updatePetInState(state, { generatedDesigns: updatedDesigns });
    saveState(updatedState);
    return updatedState;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[tomotoken] LLM generation failed (falling back to PRNG): ${message}\n`);
    return state;
  }
}
