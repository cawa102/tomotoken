import type { SpriteDef, MutablePixelCanvas, PixelCanvas, Prng, AnimationHints, Palette } from "./types.js";

/**
 * Parse a sprite definition's lines into a 2D number grid.
 * Characters: '.' or ' ' → 0 (transparent), '1'-'9' → palette index, '?' → variant marker (0 initially)
 */
function parseLines(lines: readonly string[]): MutablePixelCanvas {
  return lines.map((line) =>
    Array.from(line, (ch) => {
      if (ch === "." || ch === " ") return 0;
      if (ch === "?") return 0; // variant pixels start transparent
      const n = parseInt(ch, 10);
      return Number.isNaN(n) ? 0 : n;
    }),
  );
}

/**
 * Apply PRNG-driven variants to the pixel canvas:
 * 1. Select a random variant from the sprite's variant list
 * 2. Apply '?' pixels from sprite with 50% probability
 * 3. Swap accent colors (palette indices 8, 9) with nearby ANSI colors
 */
function applyVariants(
  canvas: MutablePixelCanvas,
  sprite: SpriteDef,
  prng: Prng,
  palette: Palette,
): { readonly canvas: MutablePixelCanvas; readonly palette: Palette } {
  // 1. Apply variant pixels
  if (sprite.variants.length > 0) {
    const variantIdx = Math.floor(prng() * sprite.variants.length);
    const variant = sprite.variants[variantIdx];
    for (const px of variant.pixels) {
      if (px.y >= 0 && px.y < canvas.length && px.x >= 0 && px.x < canvas[px.y].length) {
        canvas[px.y][px.x] = px.value;
      }
    }
  }

  // 2. Apply '?' detail pixels with 50% chance
  for (let y = 0; y < sprite.lines.length; y++) {
    for (let x = 0; x < sprite.lines[y].length; x++) {
      if (sprite.lines[y][x] === "?") {
        if (prng() > 0.5) {
          // Use accent color (8 or 9 randomly)
          canvas[y][x] = prng() > 0.5 ? 8 : 9;
        }
      }
    }
  }

  // 3. Swap accent colors with PRNG-driven alternatives
  const mutableColors = [...palette.colors];
  if (mutableColors.length > 8) {
    mutableColors[8] = shiftColor(palette.colors[8], prng);
  }
  if (mutableColors.length > 9) {
    mutableColors[9] = shiftColor(palette.colors[9], prng);
  }

  return {
    canvas,
    palette: { colors: mutableColors },
  };
}

/**
 * Shift an ANSI 256 color index by a small random offset within the same hue range.
 * Stays within the 16-231 color cube (6×6×6 RGB).
 */
function shiftColor(base: number, prng: Prng): number {
  if (base < 16 || base > 231) return base; // Don't shift grayscale or system colors
  const offset = Math.floor(prng() * 3) - 1; // -1, 0, or +1
  const shifted = base + offset * 6; // Move one step in the color cube
  if (shifted < 16 || shifted > 231) return base;
  return shifted;
}

/**
 * Center a sprite canvas within the target dimensions.
 */
function centerCanvas(
  source: MutablePixelCanvas,
  targetWidth: number,
  targetHeight: number,
): MutablePixelCanvas {
  const srcH = source.length;
  const srcW = srcH > 0 ? source[0].length : 0;

  const offsetY = Math.max(0, Math.floor((targetHeight - srcH) / 2));
  const offsetX = Math.max(0, Math.floor((targetWidth - srcW) / 2));

  const result: MutablePixelCanvas = Array.from({ length: targetHeight }, () =>
    Array.from({ length: targetWidth }, () => 0),
  );

  for (let y = 0; y < srcH; y++) {
    for (let x = 0; x < srcW; x++) {
      const ty = y + offsetY;
      const tx = x + offsetX;
      if (ty < targetHeight && tx < targetWidth) {
        result[ty][tx] = source[y][x];
      }
    }
  }

  return result;
}

/**
 * Collect shimmer-eligible pixels (non-transparent, non-eye, non-outline body pixels).
 */
function collectShimmerPixels(
  canvas: PixelCanvas,
  eyePositions: readonly [number, number][],
): [number, number][] {
  const eyeSet = new Set(eyePositions.map(([r, c]) => `${r},${c}`));
  const pixels: [number, number][] = [];

  for (let y = 0; y < canvas.length; y++) {
    for (let x = 0; x < (canvas[y]?.length ?? 0); x++) {
      const val = canvas[y][x];
      // Include body pixels (2,3,4,8,9) but not outline (1), eyes (5,6), or mouth (7)
      if (val >= 2 && val <= 4 && !eyeSet.has(`${y},${x}`)) {
        pixels.push([y, x]);
      }
    }
  }

  return pixels;
}

/**
 * Resolve a SpriteDef into a centered PixelCanvas with PRNG-driven individual variation.
 */
export function resolveSprite(
  sprite: SpriteDef,
  prng: Prng,
  palette: Palette,
  targetWidth: number,
  targetHeight: number,
): { readonly pixelCanvas: PixelCanvas; readonly animationHints: AnimationHints; readonly palette: Palette } {
  const parsed = parseLines(sprite.lines);
  const { canvas: varied, palette: adjustedPalette } = applyVariants(parsed, sprite, prng, palette);
  const centered = centerCanvas(varied, targetWidth, targetHeight);

  // Adjust eye/gesture positions based on centering offset
  const srcH = sprite.lines.length;
  const srcW = srcH > 0 ? sprite.lines[0].length : 0;
  const offsetY = Math.max(0, Math.floor((targetHeight - srcH) / 2));
  const offsetX = Math.max(0, Math.floor((targetWidth - srcW) / 2));

  const adjustedEyes: [number, number][] = sprite.eyePositions.map(([r, c]) => [
    r + offsetY,
    c + offsetX,
  ]);
  const adjustedGesture: [number, number][] = sprite.gesturePixels.map(([r, c]) => [
    r + offsetY,
    c + offsetX,
  ]);

  const shimmerPixels = collectShimmerPixels(centered, adjustedEyes);

  return {
    pixelCanvas: centered,
    animationHints: {
      eyePositions: adjustedEyes,
      gesturePixels: adjustedGesture,
      shimmerPixels,
    },
    palette: adjustedPalette,
  };
}
