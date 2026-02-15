import type { CreatureParams } from "./types.js";

/**
 * Applies progress-based gating to creature features.
 * Early-stage creatures are simpler; features unlock as progress increases.
 */
export function adjustParamsForProgress(
  params: CreatureParams,
  progress: number,
): CreatureParams {
  if (progress < 0.1) {
    return {
      ...params,
      hasLegs: false,
      hasArms: false,
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
      hasHorns: false,
      hasWings: false,
      patternDensity: params.patternDensity * progress,
    };
  }

  if (progress < 0.7) {
    return {
      ...params,
      hasWings: false,
      patternDensity: params.patternDensity * progress,
    };
  }

  return {
    ...params,
    patternDensity: params.patternDensity * progress,
  };
}
