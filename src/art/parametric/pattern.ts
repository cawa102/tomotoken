import type { MutablePixelCanvas } from "../pixel/types.js";
import type { CreatureParams, WidthMap, Bounds } from "./types.js";

/**
 * Deep-copies a mutable pixel canvas.
 */
function copyCanvas(canvas: MutablePixelCanvas): MutablePixelCanvas {
  return canvas.map((row) => [...row]);
}

/**
 * Check if a pixel is body fill (palette index 2) and within body bounds.
 */
function isBodyFill(
  canvas: MutablePixelCanvas,
  row: number,
  col: number,
  bodyBounds: Bounds,
): boolean {
  if (row < bodyBounds.top || row > bodyBounds.bottom) return false;
  if (row < 0 || row >= canvas.length) return false;
  if (col < 0 || col >= canvas[0].length) return false;
  return canvas[row][col] === 2;
}

/**
 * Apply horizontal stripes within the body region.
 * Alternates body pixels (2) to secondary (3) every N rows.
 */
function applyStripes(
  canvas: MutablePixelCanvas,
  bodyBounds: Bounds,
  density: number,
): void {
  const stripeInterval = Math.max(2, Math.round(6 - density * 4));
  for (let r = bodyBounds.top; r <= bodyBounds.bottom; r++) {
    if (Math.floor((r - bodyBounds.top) / stripeInterval) % 2 === 1) {
      for (let c = 0; c < canvas[r].length; c++) {
        if (isBodyFill(canvas, r, c, bodyBounds)) {
          canvas[r][c] = 3;
        }
      }
    }
  }
}

/**
 * Apply random spots within the body region.
 */
function applySpots(
  canvas: MutablePixelCanvas,
  bodyBounds: Bounds,
  density: number,
  prng: () => number,
): void {
  for (let r = bodyBounds.top; r <= bodyBounds.bottom; r++) {
    for (let c = 0; c < canvas[r].length; c++) {
      if (isBodyFill(canvas, r, c, bodyBounds) && prng() < density * 0.3) {
        canvas[r][c] = prng() > 0.7 ? 8 : 3;
      }
    }
  }
}

/**
 * Apply top-to-bottom gradient within the body region.
 */
function applyGradient(
  canvas: MutablePixelCanvas,
  bodyBounds: Bounds,
  density: number,
): void {
  const bodyH = bodyBounds.bottom - bodyBounds.top;
  if (bodyH <= 0) return;

  for (let r = bodyBounds.top; r <= bodyBounds.bottom; r++) {
    const rowFraction = (r - bodyBounds.top) / bodyH;
    if (rowFraction > 1 - density) {
      for (let c = 0; c < canvas[r].length; c++) {
        if (isBodyFill(canvas, r, c, bodyBounds)) {
          canvas[r][c] = 3;
        }
      }
    }
  }
}

/**
 * Apply checkerboard pattern within the body region.
 */
function applyChecker(
  canvas: MutablePixelCanvas,
  bodyBounds: Bounds,
  density: number,
): void {
  const checkSize = Math.max(1, Math.round(4 - density * 3));
  for (let r = bodyBounds.top; r <= bodyBounds.bottom; r++) {
    for (let c = 0; c < canvas[r].length; c++) {
      if (
        isBodyFill(canvas, r, c, bodyBounds) &&
        (Math.floor(r / checkSize) + Math.floor(c / checkSize)) % 2 === 0
      ) {
        canvas[r][c] = 3;
      }
    }
  }
}

/**
 * Apply diagonal swirl pattern within the body region.
 */
function applySwirl(
  canvas: MutablePixelCanvas,
  bodyBounds: Bounds,
  density: number,
  prng: () => number,
): void {
  const bodyCenterR = Math.round((bodyBounds.top + bodyBounds.bottom) / 2);
  const bodyCenterC = Math.round((bodyBounds.left + bodyBounds.right) / 2);
  const frequency = 0.3 + density * 0.5;

  // Consume one PRNG value to offset the swirl (deterministic per creature)
  const phaseOffset = prng() * Math.PI * 2;

  for (let r = bodyBounds.top; r <= bodyBounds.bottom; r++) {
    for (let c = 0; c < canvas[r].length; c++) {
      if (isBodyFill(canvas, r, c, bodyBounds)) {
        const dr = r - bodyCenterR;
        const dc = c - bodyCenterC;
        const angle = Math.atan2(dr, dc) + phaseOffset;
        const dist = Math.sqrt(dr * dr + dc * dc);
        if (Math.sin(angle * 3 + dist * frequency) > 0.3) {
          canvas[r][c] = 3;
        }
      }
    }
  }
}

/**
 * Applies a pattern over body-fill pixels based on the creature's patternType and density.
 * Only modifies pixels that are currently palette 2 (body fill).
 * Returns a new canvas (immutable).
 */
export function applyPattern(
  canvas: MutablePixelCanvas,
  _widthMap: WidthMap,
  params: CreatureParams,
  bodyBounds: Bounds,
  prng: () => number,
): MutablePixelCanvas {
  if (params.patternType === 0 || params.patternDensity <= 0) {
    return copyCanvas(canvas);
  }

  const result = copyCanvas(canvas);

  switch (params.patternType) {
    case 1:
      applyStripes(result, bodyBounds, params.patternDensity);
      break;
    case 2:
      applySpots(result, bodyBounds, params.patternDensity, prng);
      break;
    case 3:
      applyGradient(result, bodyBounds, params.patternDensity);
      break;
    case 4:
      applyChecker(result, bodyBounds, params.patternDensity);
      break;
    case 5:
      applySwirl(result, bodyBounds, params.patternDensity, prng);
      break;
  }

  return result;
}
