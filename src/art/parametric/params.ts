import type { DepthMetrics, StyleMetrics } from "../../store/types.js";
import type { CreatureParams, PatternType } from "./types.js";

/**
 * Blend a trait influence (0-1) with PRNG randomness.
 * Result = (traitInfluence * 0.3 + prng() * 0.7) * (max - min) + min
 */
function blend(
  traitInfluence: number,
  prng: () => number,
  min: number,
  max: number,
): number {
  const mixed = traitInfluence * 0.3 + prng() * 0.7;
  return mixed * (max - min) + min;
}

/**
 * Boolean feature check: trait contribution * 0.3 + prng * 0.7 > threshold.
 */
function featureCheck(
  traitInfluence: number,
  prng: () => number,
  threshold: number,
): boolean {
  return traitInfluence * 0.3 + prng() * 0.7 > threshold;
}

/**
 * Derives creature parameters from personality traits, depth/style metrics, and PRNG.
 * Each parameter is 30% trait-influenced, 70% random.
 */
export function deriveCreatureParams(
  traits: Record<string, number>,
  depth: DepthMetrics,
  style: StyleMetrics,
  prng: () => number,
): CreatureParams {
  const t = (id: string): number => traits[id] ?? 0;

  const headRatio = blend((t("scholar") + t("scribe")) / 200, prng, 0.20, 0.45);
  const bodyWidthRatio = blend((t("builder") + t("guardian")) / 200, prng, 0.30, 0.80);
  const roundness = blend((t("refiner") + t("operator")) / 200, prng, 0.0, 1.0);
  const topHeavy = blend(t("architect") / 100, prng, 0.0, 1.0);
  const eyeSize = (Math.floor(prng() * 3) + 1) as 1 | 2 | 3;
  const eyeSpacing = blend(0.5, prng, 0.3, 0.7);
  const hasEars = featureCheck((t("guardian") + t("fixer")) / 200, prng, 0.45);
  const hasHorns = featureCheck((t("guardian") + t("builder")) / 200, prng, 0.70);
  const hasTail = featureCheck((t("operator") + t("fixer")) / 200, prng, 0.40);
  const hasWings = featureCheck((t("scribe") + t("architect")) / 200, prng, 0.80);
  const hasArms = true;
  const hasLegs = true;

  // Pattern type from style complexity
  const styleComplexity = style.codeblockRatio + style.bulletRatio + style.headingRatio;
  const patternRaw = Math.floor(
    (styleComplexity * 0.3 + prng() * 0.7) * 6,
  );
  const patternType = Math.min(5, Math.max(0, patternRaw)) as PatternType;

  // Pattern density from depth
  const normLoops =
    depth.totalSessions > 0
      ? Math.min(1, depth.editTestLoopCount / Math.max(1, depth.totalSessions * 5))
      : 0;
  const patternDensity = blend(normLoops, prng, 0.0, 1.0);

  const neckWidth = blend((t("refiner") + t("builder")) / 200, prng, 0.3, 0.8);
  const legLength = blend(t("operator") / 100, prng, 0.1, 0.3);
  const armLength = blend(t("builder") / 100, prng, 0.1, 0.3);
  const tailLength = blend(t("operator") / 100, prng, 0.1, 0.4);
  const wingSize = blend(t("architect") / 100, prng, 0.1, 0.4);
  const earSize = blend(t("guardian") / 100, prng, 0.1, 0.3);
  const hornSize = blend(t("guardian") / 100, prng, 0.1, 0.3);
  const bodyTaper = blend(t("refiner") / 100, prng, 0.0, 1.0);
  const asymmetry = blend(t("fixer") / 100, prng, 0.0, 0.2);

  return {
    headRatio,
    bodyWidthRatio,
    roundness,
    topHeavy,
    eyeSize,
    eyeSpacing,
    hasEars,
    hasHorns,
    hasTail,
    hasWings,
    hasArms,
    hasLegs,
    patternType,
    patternDensity,
    neckWidth,
    legLength,
    armLength,
    tailLength,
    wingSize,
    earSize,
    hornSize,
    bodyTaper,
    asymmetry,
  };
}
