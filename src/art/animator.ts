import type { AnimationHints, MutablePixelCanvas, PixelCanvas } from "./pixel/types.js";

type Prng = () => number;

function deepCopyPixels(canvas: PixelCanvas): MutablePixelCanvas {
  return canvas.map((row) => [...row]);
}

/**
 * Blink frame: set eye pixels to 0 (transparent) to simulate closed eyes.
 */
function blink(base: PixelCanvas, hints: AnimationHints): PixelCanvas {
  const frame = deepCopyPixels(base);
  for (const [row, col] of hints.eyePositions) {
    if (row >= 0 && row < frame.length && col >= 0 && col < frame[row].length) {
      // Set eye-white (5) and pupil (6) pixels to outline color (1) for "closed" look
      const val = frame[row][col];
      if (val === 5 || val === 6) {
        frame[row][col] = 1;
      }
    }
  }
  return frame;
}

/**
 * Gesture frame: shift a few edge pixels left or right by 1.
 */
function gesture(base: PixelCanvas, hints: AnimationHints, prng: Prng): PixelCanvas {
  const frame = deepCopyPixels(base);
  const candidates = hints.gesturePixels;
  if (candidates.length === 0) return frame;

  const count = Math.min(3, Math.floor(prng() * 3) + 1);
  for (let i = 0; i < count; i++) {
    const [row, col] = candidates[Math.floor(prng() * candidates.length)];
    if (row < 0 || row >= frame.length) continue;
    const dir = prng() > 0.5 ? 1 : -1;
    const newCol = col + dir;
    if (newCol >= 0 && newCol < frame[row].length && frame[row][newCol] === 0) {
      frame[row][newCol] = frame[row][col];
      frame[row][col] = 0;
    }
  }
  return frame;
}

/**
 * Shimmer frame: randomly swap a few body pixels to highlight color (4).
 */
function shimmer(base: PixelCanvas, hints: AnimationHints, prng: Prng): PixelCanvas {
  const frame = deepCopyPixels(base);
  const candidates = hints.shimmerPixels;
  if (candidates.length === 0) return frame;

  const count = Math.min(3, Math.floor(prng() * 3) + 1);
  for (let i = 0; i < count; i++) {
    const [row, col] = candidates[Math.floor(prng() * candidates.length)];
    if (row >= 0 && row < frame.length && col >= 0 && col < frame[row].length) {
      frame[row][col] = 4; // highlight color
    }
  }
  return frame;
}

/**
 * Generate 4 animation frames from a PixelCanvas:
 * [base, blink, gesture, shimmer]
 */
export function generateFrames(
  base: PixelCanvas,
  hints: AnimationHints,
  prng: Prng,
): PixelCanvas[] {
  return [
    deepCopyPixels(base),
    blink(base, hints),
    gesture(base, hints, prng),
    shimmer(base, hints, prng),
  ];
}
