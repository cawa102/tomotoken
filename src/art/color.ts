import type { PixelCanvas, Palette } from "./pixel/types.js";
import { pixelsToHalfBlocks } from "./pixel/render.js";

/**
 * Colorize PixelCanvas frames into ANSI-colored half-block strings.
 *
 * Each pixel frame is rendered to half-block characters with ANSI 256 colors.
 * Output: array of frames, each frame is an array of strings.
 */
export function colorizeFrames(
  frames: readonly PixelCanvas[],
  palette: Palette,
  canvasWidth: number,
  pixelHeight: number,
): string[][] {
  return frames.map((frame) =>
    pixelsToHalfBlocks(frame, palette, canvasWidth, pixelHeight),
  );
}
