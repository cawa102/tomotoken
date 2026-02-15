import type { AnimationHints, MutablePixelCanvas, PixelCanvas } from "./pixel/types.js";

function deepCopy(canvas: PixelCanvas): MutablePixelCanvas {
  return canvas.map((row) => [...row]);
}

export function applyBlink(base: PixelCanvas, hints: AnimationHints): PixelCanvas {
  const frame = deepCopy(base);
  for (const [row, col] of hints.eyePositions) {
    if (row >= 0 && row < frame.length && col >= 0 && col < frame[row].length) {
      const val = frame[row][col];
      if (val === 5 || val === 6) frame[row][col] = 1;
    }
  }
  return frame;
}

export function applyArmSway(base: PixelCanvas, hints: AnimationHints, prng: () => number): PixelCanvas {
  const frame = deepCopy(base);
  const candidates = hints.gesturePixels;
  if (candidates.length === 0) return frame;
  const [row, col] = candidates[Math.floor(prng() * candidates.length)];
  const dir = prng() > 0.5 ? 1 : -1;
  const newRow = row + dir;
  if (newRow >= 0 && newRow < frame.length && frame[newRow][col] === 0) {
    frame[newRow][col] = frame[row][col];
    frame[row][col] = 0;
  }
  return frame;
}

export function applyFootTap(base: PixelCanvas, hints: AnimationHints, prng: () => number): PixelCanvas {
  const frame = deepCopy(base);
  const candidates = hints.gesturePixels;
  if (candidates.length === 0) return frame;
  const [row, col] = candidates[Math.floor(prng() * candidates.length)];
  if (row - 1 >= 0 && frame[row - 1][col] === 0) {
    frame[row - 1][col] = frame[row][col];
    frame[row][col] = 0;
  }
  return frame;
}

export function applyGesture(base: PixelCanvas, hints: AnimationHints, prng: () => number): PixelCanvas {
  const frame = deepCopy(base);
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

export function applyShimmer(base: PixelCanvas, hints: AnimationHints, prng: () => number): PixelCanvas {
  const frame = deepCopy(base);
  const candidates = hints.shimmerPixels;
  if (candidates.length === 0) return frame;
  const count = Math.min(3, Math.floor(prng() * 3) + 1);
  for (let i = 0; i < count; i++) {
    const [row, col] = candidates[Math.floor(prng() * candidates.length)];
    if (row >= 0 && row < frame.length && col >= 0 && col < frame[row].length) {
      frame[row][col] = 4;
    }
  }
  return frame;
}
