import { CATEGORY_IDS, TRAIT_IDS, CATEGORY_TO_TRAIT } from "../config/constants.js";
import { clamp } from "../utils/clamp.js";
import type { UsageMix, TraitVector, TraitId } from "./types.js";
import type { DepthMetrics, StyleMetrics } from "../store/types.js";

export interface TraitResult {
  readonly traits: TraitVector;
  readonly archetype: TraitId;
  readonly subtype: TraitId;
}

export function computeTraits(
  usageMix: UsageMix,
  depth: DepthMetrics,
  style: StyleMetrics,
): TraitResult {
  const traits: Record<string, number> = {};

  // Base scores from usage_mix
  for (const cat of CATEGORY_IDS) {
    const traitId = CATEGORY_TO_TRAIT[cat];
    traits[traitId] = Math.round((usageMix[cat] ?? 0) * 100);
  }

  // Depth/style adjustments (bounded [-10, +10])
  const normLoops = depth.totalSessions > 0
    ? depth.editTestLoopCount / depth.totalSessions
    : 0;

  traits["fixer"] += Math.min(10, Math.round(normLoops * 2));
  traits["refiner"] += Math.min(10, Math.round(depth.phaseSwitchCount > 20 ? 5 : 0));
  traits["architect"] += Math.min(10, Math.round(
    (style.bulletRatio > 0.2 ? 5 : 0) + (style.headingRatio > 0.05 ? 5 : 0)
  ));
  traits["scholar"] += Math.min(10, Math.round(
    depth.totalSessions > 0 && depth.repeatEditSameFileCount / depth.totalSessions < 0.5 ? 5 : 0
  ));

  // Clamp all to [0, 100]
  for (const t of TRAIT_IDS) {
    traits[t] = clamp(0, 100, traits[t] ?? 0);
  }

  // Find archetype (highest) and subtype (second highest)
  const sorted = [...TRAIT_IDS].sort((a, b) => (traits[b] ?? 0) - (traits[a] ?? 0));

  return {
    traits: traits as TraitVector,
    archetype: sorted[0],
    subtype: sorted[1],
  };
}
