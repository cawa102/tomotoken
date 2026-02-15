import { createPrng } from "../utils/hash.js";
import { generateBody } from "./body.js";
import { generateFrames } from "./animator.js";
import { colorizeFrames } from "./color.js";
import { pixelsToPlainBlocks } from "./pixel/render.js";
import type { ArtParams, ArtOutput } from "./types.js";

/**
 * Render pixel art for a pet.
 *
 * Pipeline:
 *   1. Create PRNG from seed
 *   2. Generate PixelCanvas body (parametric generation from traits)
 *   3. Generate 4 animation frames (blink, gesture, shimmer)
 *   4. Render to plain half-block strings (raw frames)
 *   5. Render to ANSI-colored half-block strings (color frames)
 */
export function renderArt(params: ArtParams): ArtOutput {
  const { seed, progress, traits, depthMetrics, styleMetrics, canvasWidth, canvasHeight, usageMix, tokenRatio } = params;

  const prng = createPrng(seed);
  const { pixelCanvas, animationHints, palette } = generateBody(
    prng,
    progress,
    traits,
    depthMetrics,
    styleMetrics,
    canvasWidth,
    canvasHeight,
    usageMix,
    tokenRatio,
  );

  // Pixel height is 2x text height (half-block encoding)
  const pixelHeight = canvasHeight * 2;

  const pixelFrames = generateFrames(pixelCanvas, animationHints, prng);

  // Raw frames: plain half-block characters (no color)
  const frames = pixelFrames.map((f) => {
    const lines = pixelsToPlainBlocks(f, canvasWidth, pixelHeight);
    return padFrame(lines, canvasWidth, canvasHeight);
  });

  // Colored frames: ANSI 256-color half-block characters
  const colorFrames = colorizeFrames(pixelFrames, palette, canvasWidth, pixelHeight);

  return { frames, colorFrames };
}

/**
 * Pad/trim frame to exact target dimensions.
 */
function padFrame(lines: string[], width: number, height: number): string[] {
  const result: string[] = [];
  for (let i = 0; i < height; i++) {
    if (i < lines.length) {
      result.push(lines[i].padEnd(width).slice(0, width));
    } else {
      result.push(" ".repeat(width));
    }
  }
  return result;
}
