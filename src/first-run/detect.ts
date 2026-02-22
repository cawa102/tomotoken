import type { AppState, Collection } from "../store/types.js";

export function isFirstRun(
  state: AppState | null,
  collection: Collection,
): boolean {
  if (state === null) return true;
  if (state.firstRunCompleted) return false;
  if (collection.pets.length > 0) return false;
  if (state.currentPet.consumedTokens > 0) return false;
  return true;
}
