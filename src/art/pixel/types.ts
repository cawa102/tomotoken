export type Prng = () => number;

/** 2D grid of palette indices. 0 = transparent, 1-9 = palette colors. */
export type PixelCanvas = readonly (readonly number[])[];

/** Mutable version for building canvases. */
export type MutablePixelCanvas = number[][];

export interface Palette {
  readonly colors: readonly number[]; // ANSI 256 indices: [0]=unused(transparent), [1]-[9]=actual colors
}

export interface SpriteDef {
  readonly lines: readonly string[]; // '.' or ' ' = transparent(0), '1'-'9' = palette index
  readonly variants: readonly SpriteVariant[];
  readonly eyePositions: readonly [number, number][]; // [row, col] pairs
  readonly gesturePixels: readonly [number, number][]; // pixels that can shift for gesture animation
}

export interface SpriteVariant {
  readonly pixels: readonly VariantPixel[];
}

export interface VariantPixel {
  readonly x: number; // column
  readonly y: number; // row
  readonly value: number; // palette index
}

export interface BodyResult {
  readonly pixelCanvas: PixelCanvas;
  readonly animationHints: AnimationHints;
  readonly palette: Palette;
}

export interface AnimationHints {
  readonly eyePositions: readonly [number, number][]; // [row, col]
  readonly gesturePixels: readonly [number, number][]; // [row, col]
  readonly shimmerPixels: readonly [number, number][]; // [row, col] — non-transparent, non-eye pixels
}

export interface ArchetypeSprites {
  readonly palette: Palette;
  readonly stages: readonly SpriteDef[]; // 5 stages: egg, infant, child, youth, complete
}
