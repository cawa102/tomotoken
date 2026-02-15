import { describe, it, expect } from "vitest";
import { createPrng } from "../../src/utils/hash.js";
import { placeItemOnCanvas } from "../../src/art/parametric/item.js";
import type { MutablePixelCanvas } from "../../src/art/pixel/types.js";
import type { Bounds } from "../../src/art/parametric/types.js";

const SEED = "1111222233334444555566667777888811112222333344445555666677778888";
const TRAITS = { builder: 50, fixer: 40, refiner: 30, scholar: 50, scribe: 20, architect: 70, operator: 10, guardian: 45 };
const USAGE_MIX = { impl: 0.4, debug: 0.2, refactor: 0.1, research: 0.1, docs: 0.05, planning: 0.1, ops: 0.03, security: 0.02 };

function makeCanvas(w: number, h: number): MutablePixelCanvas {
  return Array.from({ length: h }, () => Array(w).fill(0));
}

describe("placeItemOnCanvas", () => {
  const bodyBounds: Bounds = { top: 17, bottom: 26, left: 10, right: 22 };

  it("adds non-zero pixels to canvas", () => {
    const canvas = makeCanvas(32, 32);
    const prng = createPrng(SEED);
    const result = placeItemOnCanvas(canvas, bodyBounds, TRAITS, USAGE_MIX, 0.8, prng);
    const originalCount = 0;
    const resultCount = result.flat().filter((v) => v !== 0).length;
    expect(resultCount).toBeGreaterThan(originalCount);
  });

  it("item pixels are placed near hand position (beside body)", () => {
    const canvas = makeCanvas(32, 32);
    const prng = createPrng(SEED);
    const result = placeItemOnCanvas(canvas, bodyBounds, TRAITS, USAGE_MIX, 0.8, prng);
    // Item should be near bodyBounds edges (left side or right side)
    let itemPixelsNearBody = 0;
    for (let r = bodyBounds.top; r <= bodyBounds.bottom + 5; r++) {
      for (let c = 0; c < bodyBounds.left; c++) {
        if (result[r][c] !== 0) itemPixelsNearBody++;
      }
      for (let c = bodyBounds.right + 1; c < 32; c++) {
        if (result[r][c] !== 0) itemPixelsNearBody++;
      }
    }
    expect(itemPixelsNearBody).toBeGreaterThan(0);
  });

  it("does not overwrite body pixels", () => {
    const canvas = makeCanvas(32, 32);
    // Pre-fill body area
    for (let r = bodyBounds.top; r <= bodyBounds.bottom; r++) {
      for (let c = bodyBounds.left; c <= bodyBounds.right; c++) {
        canvas[r][c] = 2;
      }
    }
    const prng = createPrng(SEED);
    const result = placeItemOnCanvas(canvas, bodyBounds, TRAITS, USAGE_MIX, 0.8, prng);
    for (let r = bodyBounds.top; r <= bodyBounds.bottom; r++) {
      for (let c = bodyBounds.left; c <= bodyBounds.right; c++) {
        expect(result[r][c]).toBe(2);
      }
    }
  });

  it("is deterministic", () => {
    const a = placeItemOnCanvas(makeCanvas(32, 32), bodyBounds, TRAITS, USAGE_MIX, 0.8, createPrng(SEED));
    const b = placeItemOnCanvas(makeCanvas(32, 32), bodyBounds, TRAITS, USAGE_MIX, 0.8, createPrng(SEED));
    expect(a).toEqual(b);
  });
});
