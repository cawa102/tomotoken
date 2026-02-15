import type { CreatureParams, LimbStage } from "./types.js";

function computeLimbStage(progress: number): LimbStage {
  if (progress < 0.1) return 0;
  if (progress < 0.3) return 1;
  if (progress < 0.5) return 2;
  if (progress < 0.7) return 3;
  if (progress >= 1.0) return 5;
  return 4;
}

/**
 * Applies progress-based gating to creature features.
 * Early-stage creatures are simpler; features unlock as progress increases.
 */
export function adjustParamsForProgress(
  params: CreatureParams,
  progress: number,
): CreatureParams {
  const limbStage = computeLimbStage(progress);

  if (progress < 0.1) {
    return {
      ...params,
      limbStage,
      hasEars: false,
      hasTail: false,
      hasHorns: false,
      hasWings: false,
      patternDensity: 0,
    };
  }

  if (progress < 0.3) {
    return {
      ...params,
      limbStage,
      hasEars: false,
      hasTail: false,
      hasHorns: false,
      hasWings: false,
      patternDensity: params.patternDensity * progress,
    };
  }

  if (progress < 0.5) {
    return {
      ...params,
      limbStage,
      hasHorns: false,
      hasWings: false,
      patternDensity: params.patternDensity * progress,
    };
  }

  if (progress < 0.7) {
    return {
      ...params,
      limbStage,
      hasWings: false,
      patternDensity: params.patternDensity * progress,
    };
  }

  return {
    ...params,
    limbStage,
    patternDensity: params.patternDensity * progress,
  };
}
