import { generateParametricBody } from "./parametric/index.js";
import type { BodyResult } from "./pixel/types.js";
import type { DepthMetrics, StyleMetrics } from "../store/types.js";

type Prng = () => number;

/**
 * Generate a parametric pixel-art body from personality traits and PRNG.
 *
 * Returns a PixelCanvas (2D palette index grid), animation hints, and the resolved palette.
 * The pixel canvas has dimensions (canvasWidth × canvasHeight*2) to account for
 * half-block rendering (each text row = 2 pixel rows).
 */
export function generateBody(
  prng: Prng,
  progress: number,
  traits: Record<string, number>,
  depth: DepthMetrics,
  style: StyleMetrics,
  canvasWidth: number,
  canvasHeight: number,
  usageMix?: Record<string, number>,
  tokenRatio?: number,
): BodyResult {
  return generateParametricBody(prng, progress, traits, depth, style, canvasWidth, canvasHeight, usageMix, tokenRatio);
}
