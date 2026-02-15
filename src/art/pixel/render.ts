import chalk from "chalk";
import type { PixelCanvas, Palette } from "./types.js";

/**
 * Convert a PixelCanvas into half-block ANSI-colored strings.
 *
 * Each text row encodes 2 pixel rows using Unicode half-block characters:
 *   ▀ = foreground(top) + background(bottom)
 *   ▄ = foreground(bottom) + background(top)
 *   █ = foreground only (top === bottom)
 *   ' ' = transparent (both transparent)
 *
 * Output: height/2 lines, each `width` visible characters wide.
 */
export function pixelsToHalfBlocks(
  pixels: PixelCanvas,
  palette: Palette,
  width: number,
  height: number,
): string[] {
  const lines: string[] = [];

  for (let row = 0; row < height; row += 2) {
    let line = "";
    for (let col = 0; col < width; col++) {
      const top = pixels[row]?.[col] ?? 0;
      const bot = pixels[row + 1]?.[col] ?? 0;

      if (top === 0 && bot === 0) {
        line += " ";
        continue;
      }
      if (top === bot) {
        line += chalk.ansi256(palette.colors[top])("\u2588"); // █
        continue;
      }
      if (top === 0) {
        line += chalk.ansi256(palette.colors[bot])("\u2584"); // ▄
        continue;
      }
      if (bot === 0) {
        line += chalk.ansi256(palette.colors[top])("\u2580"); // ▀
        continue;
      }
      // Both non-transparent and different
      line += chalk.ansi256(palette.colors[top]).bgAnsi256(palette.colors[bot])("\u2580"); // ▀
    }
    lines.push(line);
  }

  return lines;
}

/**
 * Convert PixelCanvas to plain (uncolored) half-block strings.
 * Uses Unicode block chars without ANSI colors — for raw frame output.
 */
export function pixelsToPlainBlocks(
  pixels: PixelCanvas,
  width: number,
  height: number,
): string[] {
  const lines: string[] = [];

  for (let row = 0; row < height; row += 2) {
    let line = "";
    for (let col = 0; col < width; col++) {
      const top = pixels[row]?.[col] ?? 0;
      const bot = pixels[row + 1]?.[col] ?? 0;

      if (top === 0 && bot === 0) {
        line += " ";
      } else if (top !== 0 && bot !== 0) {
        if (top === bot) {
          line += "\u2588"; // █
        } else {
          line += "\u2580"; // ▀
        }
      } else if (top !== 0) {
        line += "\u2580"; // ▀
      } else {
        line += "\u2584"; // ▄
      }
    }
    lines.push(line);
  }

  return lines;
}
