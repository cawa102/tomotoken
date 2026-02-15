export { deriveCreatureParams } from "./params.js";
export { generatePalette } from "./palette.js";
export { adjustParamsForProgress } from "./progress.js";
export { generateSilhouette } from "./silhouette.js";
export { rasterizeSilhouette } from "./rasterize.js";
export { placeFeatures } from "./features.js";
export { applyPattern } from "./pattern.js";
export type { CreatureParams, WidthMap, Bounds, PatternType, LimbStage } from "./types.js";
export type { ItemFamily, Richness } from "./item-types.js";
export { deriveItemParams } from "./item-params.js";
export { generateItemPixels } from "./item-shapes.js";
export { placeItemOnCanvas } from "./item.js";

import type { BodyResult } from "../pixel/types.js";
import type { DepthMetrics, StyleMetrics } from "../../store/types.js";
import { deriveCreatureParams } from "./params.js";
import { generatePalette } from "./palette.js";
import { adjustParamsForProgress } from "./progress.js";
import { generateSilhouette } from "./silhouette.js";
import { rasterizeSilhouette } from "./rasterize.js";
import { placeFeatures } from "./features.js";
import { applyPattern } from "./pattern.js";
import { placeItemOnCanvas } from "./item.js";

/**
 * Generates a complete parametric creature body from personality data and PRNG.
 *
 * Pipeline: params → progress gate → silhouette → rasterize → features → pattern → (item?) → BodyResult
 */
export function generateParametricBody(
  prng: () => number,
  progress: number,
  traits: Record<string, number>,
  depth: DepthMetrics,
  style: StyleMetrics,
  canvasW: number,
  canvasH: number,
  usageMix?: Record<string, number>,
  tokenRatio?: number,
): BodyResult {
  const pixelH = canvasH * 2;
  const rawParams = deriveCreatureParams(traits, depth, style, prng);
  const params = adjustParamsForProgress(rawParams, progress);
  const palette = generatePalette(traits, depth, style, prng);
  const { widthMap, headBounds, bodyBounds } = generateSilhouette(
    params,
    canvasW,
    pixelH,
    progress,
  );
  const rasterized = rasterizeSilhouette(widthMap, canvasW, pixelH);
  const { canvas: featured, hints } = placeFeatures(
    rasterized,
    widthMap,
    params,
    headBounds,
    bodyBounds,
    prng,
  );
  let patterned = applyPattern(
    featured,
    widthMap,
    params,
    bodyBounds,
    prng,
  );

  // Stage 5: place procedural item if usageMix is provided
  if (params.limbStage >= 5 && usageMix) {
    patterned = placeItemOnCanvas(
      patterned,
      bodyBounds,
      traits,
      usageMix,
      tokenRatio ?? 1.0,
      prng,
    );
  }

  return { pixelCanvas: patterned, animationHints: hints, palette };
}
