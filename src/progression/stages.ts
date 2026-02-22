/**
 * Egg stage based on progress toward hatching.
 * 0 = pristine egg, 1 = small cracks, 2 = many cracks,
 * 3 = large fractures, 4 = hatched (character revealed).
 */
export type EggStage = 0 | 1 | 2 | 3 | 4;

export function computeEggStage(progress: number): EggStage {
  if (progress >= 1.0) return 4;
  if (progress >= 0.75) return 3;
  if (progress >= 0.50) return 2;
  if (progress >= 0.25) return 1;
  return 0;
}
