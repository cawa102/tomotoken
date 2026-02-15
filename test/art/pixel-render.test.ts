import { describe, it, expect, beforeAll } from "vitest";
import chalk from "chalk";
import { pixelsToHalfBlocks, pixelsToPlainBlocks } from "../../src/art/pixel/render.js";
import type { Palette, PixelCanvas } from "../../src/art/pixel/types.js";

beforeAll(() => {
  chalk.level = 1; // Force ANSI color output in test environment
});

const testPalette: Palette = {
  colors: [0, 136, 208, 214, 220, 255, 16, 204, 178, 130],
};

describe("pixelsToPlainBlocks", () => {
  it("converts transparent canvas to spaces", () => {
    const pixels: PixelCanvas = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const lines = pixelsToPlainBlocks(pixels, 4, 4);
    expect(lines).toHaveLength(2); // 4 pixel rows → 2 text rows
    expect(lines[0]).toBe("    ");
    expect(lines[1]).toBe("    ");
  });

  it("uses full block for same top/bottom colors", () => {
    const pixels: PixelCanvas = [
      [1, 0],
      [1, 0],
    ];
    const lines = pixelsToPlainBlocks(pixels, 2, 2);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe("\u2588 "); // █ + space
  });

  it("uses upper half block for top-only", () => {
    const pixels: PixelCanvas = [
      [1, 0],
      [0, 0],
    ];
    const lines = pixelsToPlainBlocks(pixels, 2, 2);
    expect(lines[0]).toBe("\u2580 "); // ▀ + space
  });

  it("uses lower half block for bottom-only", () => {
    const pixels: PixelCanvas = [
      [0, 0],
      [1, 0],
    ];
    const lines = pixelsToPlainBlocks(pixels, 2, 2);
    expect(lines[0]).toBe("\u2584 "); // ▄ + space
  });

  it("produces correct number of lines for odd pixel heights", () => {
    const pixels: PixelCanvas = [
      [1, 1],
      [1, 1],
      [1, 1],
    ];
    const lines = pixelsToPlainBlocks(pixels, 2, 3);
    expect(lines).toHaveLength(2); // ceil(3/2) = 2, but we step by 2 so row=0,2
  });
});

describe("pixelsToHalfBlocks", () => {
  it("produces ANSI colored output", () => {
    const pixels: PixelCanvas = [
      [1, 2],
      [3, 0],
    ];
    const lines = pixelsToHalfBlocks(pixels, testPalette, 2, 2);
    expect(lines).toHaveLength(1);
    // Should contain ANSI escape sequences
    expect(lines[0]).toContain("\x1b[");
  });

  it("produces correct number of text lines", () => {
    const pixels: PixelCanvas = Array.from({ length: 32 }, () =>
      Array.from({ length: 32 }, () => 1),
    );
    const lines = pixelsToHalfBlocks(pixels, testPalette, 32, 32);
    expect(lines).toHaveLength(16); // 32 pixel rows → 16 text rows
  });

  it("handles empty canvas", () => {
    const pixels: PixelCanvas = [
      [0, 0],
      [0, 0],
    ];
    const lines = pixelsToHalfBlocks(pixels, testPalette, 2, 2);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe("  ");
  });
});
