import type { AppState } from "../store/types.js";
import { saveState, updatePetInState } from "../store/store.js";
import { generateCreatureDesign } from "../generation/designer.js";
import { createLLMProvider } from "../generation/llm-provider.js";
import { computeEggStage } from "../progression/stages.js";
import { TRAIT_IDS } from "../config/constants.js";
import { loadConfig, resolveApiKey } from "../config/index.js";

function deriveArchetypeAndSubtype(traits: Record<string, number>): { archetype: string; subtype: string } {
  const sorted = [...TRAIT_IDS].sort((a, b) => (traits[b] ?? 0) - (traits[a] ?? 0));
  return { archetype: sorted[0], subtype: sorted[1] };
}

/**
 * Check if LLM generation should be triggered for the current stage.
 * Resolves API key from config (config.json) or env vars.
 * Only generates at stage 4 (hatched) — egg stages use procedural shaders.
 *
 * Returns the (possibly updated) state. On failure, returns original state (PRNG fallback).
 */
let generationInFlight: Promise<AppState> | null = null;

export async function triggerGenerationIfNeeded(state: AppState): Promise<AppState> {
  const config = loadConfig();
  const apiKey = resolveApiKey(config.llm);
  if (!apiKey) return state;

  const pet = state.currentPet;
  const snapshot = pet.personalitySnapshot;
  if (!snapshot) return state;

  const progress = pet.requiredTokens > 0
    ? Math.min(1.0, pet.consumedTokens / pet.requiredTokens)
    : 0;
  const stage = computeEggStage(progress);

  // Only generate at stage 4 (hatched). Egg stages 0-3 use procedural shaders.
  if (stage < 4) return state;

  if (pet.generatedDesigns?.[stage]) return state;

  // Deduplicate concurrent generation requests
  if (generationInFlight) return generationInFlight;

  const { archetype, subtype } = deriveArchetypeAndSubtype(snapshot.traits);

  const previousStage = stage > 0 ? stage - 1 : null;
  const previousParts = previousStage !== null
    ? (pet.generatedDesigns?.[previousStage]?.parts ?? null)
    : null;

  const provider = createLLMProvider({
    provider: config.llm.provider,
    model: config.llm.model,
    apiKey,
  });

  generationInFlight = (async () => {
    try {
      const design = await generateCreatureDesign({
        archetype,
        subtype,
        traits: snapshot.traits,
        depth: snapshot.depthMetrics,
        style: snapshot.styleMetrics,
        stage,
        previousParts,
        provider,
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
  })();

  try {
    return await generationInFlight;
  } finally {
    generationInFlight = null;
  }
}
