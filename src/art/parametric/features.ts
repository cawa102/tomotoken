import type { MutablePixelCanvas, AnimationHints } from "../pixel/types.js";
import type { CreatureParams, WidthMap, Bounds } from "./types.js";

interface FeaturesResult {
  readonly canvas: MutablePixelCanvas;
  readonly hints: AnimationHints;
}

/**
 * Deep-copies a mutable pixel canvas.
 */
function copyCanvas(canvas: MutablePixelCanvas): MutablePixelCanvas {
  return canvas.map((row) => [...row]);
}

/**
 * Safely sets a pixel on the canvas if within bounds.
 */
function setPixel(
  canvas: MutablePixelCanvas,
  row: number,
  col: number,
  value: number,
): void {
  if (row >= 0 && row < canvas.length && col >= 0 && col < canvas[0].length) {
    canvas[row][col] = value;
  }
}

/**
 * Places facial features, limbs, and appendages onto the rasterized silhouette.
 * Returns the modified canvas and animation hints.
 */
export function placeFeatures(
  canvas: MutablePixelCanvas,
  _widthMap: WidthMap,
  params: CreatureParams,
  headBounds: Bounds,
  bodyBounds: Bounds,
  prng: () => number,
): FeaturesResult {
  const result = copyCanvas(canvas);
  const eyePositions: [number, number][] = [];
  const gesturePixels: [number, number][] = [];
  const shimmerPixels: [number, number][] = [];

  const headCenterY = Math.round((headBounds.top + headBounds.bottom) / 2);
  const headCenterX = Math.round((headBounds.left + headBounds.right) / 2);
  const headWidth = headBounds.right - headBounds.left;
  const headHeight = headBounds.bottom - headBounds.top;

  // --- Eyes (always placed) ---
  const eyeRow = headCenterY;
  const eyeOffset = Math.max(1, Math.round(headWidth * params.eyeSpacing * 0.5));
  const leftEyeCol = headCenterX - eyeOffset;
  const rightEyeCol = headCenterX + eyeOffset;

  if (params.eyeSize === 1) {
    // Single pixel eyes
    setPixel(result, eyeRow, leftEyeCol, 6);
    setPixel(result, eyeRow, rightEyeCol, 6);
    eyePositions.push([eyeRow, leftEyeCol], [eyeRow, rightEyeCol]);
  } else if (params.eyeSize === 2) {
    // 2x2 eyes: white surround + pupil
    for (const col of [leftEyeCol, rightEyeCol]) {
      setPixel(result, eyeRow - 1, col, 5);
      setPixel(result, eyeRow - 1, col + 1, 5);
      setPixel(result, eyeRow, col, 6);
      setPixel(result, eyeRow, col + 1, 5);
      eyePositions.push([eyeRow, col]);
    }
  } else {
    // 3x2 eyes: wider white area + pupil
    for (const col of [leftEyeCol, rightEyeCol]) {
      setPixel(result, eyeRow - 1, col - 1, 5);
      setPixel(result, eyeRow - 1, col, 5);
      setPixel(result, eyeRow - 1, col + 1, 5);
      setPixel(result, eyeRow, col - 1, 5);
      setPixel(result, eyeRow, col, 6);
      setPixel(result, eyeRow, col + 1, 5);
      eyePositions.push([eyeRow, col]);
    }
  }

  // --- Mouth ---
  const mouthRow = Math.min(headBounds.bottom - 1, eyeRow + Math.max(2, Math.round(headHeight * 0.3)));
  const mouthWidth = Math.max(2, Math.round(headWidth * 0.2));
  const mouthStart = headCenterX - Math.floor(mouthWidth / 2);
  for (let c = mouthStart; c < mouthStart + mouthWidth; c++) {
    setPixel(result, mouthRow, c, 7);
  }

  // --- Ears (if enabled) ---
  if (params.hasEars) {
    const earH = Math.max(2, Math.round(headHeight * params.earSize));
    // Left ear: triangle above head-left
    for (let i = 0; i < earH; i++) {
      const row = headBounds.top - earH + i;
      const col = headBounds.left + i;
      setPixel(result, row, col, 1);
      if (i > 0) setPixel(result, row, col + 1, 2);
      gesturePixels.push([row, col]);
    }
    // Right ear: triangle above head-right
    for (let i = 0; i < earH; i++) {
      const row = headBounds.top - earH + i;
      const col = headBounds.right - i;
      setPixel(result, row, col, 1);
      if (i > 0) setPixel(result, row, col - 1, 2);
      gesturePixels.push([row, col]);
    }
  }

  // --- Horns (if enabled) ---
  if (params.hasHorns) {
    const hornH = Math.max(2, Math.round(headHeight * params.hornSize * 1.5));
    const hornBaseL = headBounds.left + Math.round(headWidth * 0.2);
    const hornBaseR = headBounds.right - Math.round(headWidth * 0.2);
    for (let i = 0; i < hornH; i++) {
      const row = headBounds.top - hornH + i;
      setPixel(result, row, hornBaseL - Math.floor(i / 2), 8);
      setPixel(result, row, hornBaseR + Math.floor(i / 2), 8);
      gesturePixels.push([row, hornBaseL], [row, hornBaseR]);
    }
  }

  // --- Tail (if enabled) ---
  if (params.hasTail) {
    const tailLen = Math.max(2, Math.round(headWidth * params.tailLength * 2));
    const tailRow = Math.round((bodyBounds.top + bodyBounds.bottom) / 2);
    const tailDir = prng() > 0.5 ? 1 : -1; // Left or right
    const tailStartCol = tailDir > 0 ? bodyBounds.right + 1 : bodyBounds.left - 1;
    for (let i = 0; i < tailLen; i++) {
      const col = tailStartCol + tailDir * i;
      const row = tailRow + Math.round(Math.sin(i * 0.8) * 1.5);
      setPixel(result, row, col, 9);
      gesturePixels.push([row, col]);
    }
  }

  // --- Wings (if enabled) ---
  if (params.hasWings) {
    const wingH = Math.max(2, Math.round((bodyBounds.bottom - bodyBounds.top) * params.wingSize));
    const wingW = Math.max(2, Math.round(headWidth * params.wingSize * 1.5));
    const wingTopRow = bodyBounds.top;

    // Left wing
    for (let r = 0; r < wingH; r++) {
      const width = Math.max(1, Math.round(wingW * (1 - r / wingH)));
      for (let c = 0; c < width; c++) {
        const row = wingTopRow + r;
        const col = bodyBounds.left - 1 - c;
        const pIdx = r === 0 || c === width - 1 ? 4 : 8;
        setPixel(result, row, col, pIdx);
        gesturePixels.push([row, col]);
      }
    }

    // Right wing
    for (let r = 0; r < wingH; r++) {
      const width = Math.max(1, Math.round(wingW * (1 - r / wingH)));
      for (let c = 0; c < width; c++) {
        const row = wingTopRow + r;
        const col = bodyBounds.right + 1 + c;
        const pIdx = r === 0 || c === width - 1 ? 4 : 8;
        setPixel(result, row, col, pIdx);
        gesturePixels.push([row, col]);
      }
    }
  }

  // --- Arms (limbStage >= 1) ---
  if (params.limbStage >= 1) {
    const armLen = Math.max(1, Math.round((bodyBounds.bottom - bodyBounds.top) * params.armLength));
    const armRow = bodyBounds.top + Math.round((bodyBounds.bottom - bodyBounds.top) * 0.25);

    for (let i = 0; i < armLen; i++) {
      // Left arm
      setPixel(result, armRow + i, bodyBounds.left - 1, 2);
      gesturePixels.push([armRow + i, bodyBounds.left - 1]);
      // Right arm
      setPixel(result, armRow + i, bodyBounds.right + 1, 2);
      gesturePixels.push([armRow + i, bodyBounds.right + 1]);
    }
  }

  // --- Legs (limbStage >= 1) ---
  if (params.limbStage >= 1) {
    const legLen = Math.max(1, Math.round((bodyBounds.bottom - bodyBounds.top) * params.legLength));
    const legSpacing = Math.max(1, Math.round((bodyBounds.right - bodyBounds.left) * 0.25));
    const leftLegCol = Math.round((bodyBounds.left + bodyBounds.right) / 2) - legSpacing;
    const rightLegCol = Math.round((bodyBounds.left + bodyBounds.right) / 2) + legSpacing;

    for (let i = 1; i <= legLen; i++) {
      setPixel(result, bodyBounds.bottom + i, leftLegCol, 2);
      gesturePixels.push([bodyBounds.bottom + i, leftLegCol]);
      setPixel(result, bodyBounds.bottom + i, rightLegCol, 2);
      gesturePixels.push([bodyBounds.bottom + i, rightLegCol]);
    }
  }

  // --- Collect shimmer pixels (non-transparent, non-eye body pixels) ---
  for (let r = 0; r < result.length; r++) {
    for (let c = 0; c < result[r].length; c++) {
      const v = result[r][c];
      if (v !== 0 && v !== 5 && v !== 6) {
        shimmerPixels.push([r, c]);
      }
    }
  }

  return {
    canvas: result,
    hints: { eyePositions, gesturePixels, shimmerPixels },
  };
}
