import { describe, it, expect } from "vitest";
import { createPrng } from "../../src/utils/hash.js";
import { generateItemPixels } from "../../src/art/parametric/item-shapes.js";
import type { ItemParams } from "../../src/art/parametric/item-types.js";

const SEED = "1111222233334444555566667777888811112222333344445555666677778888";

function makeItemParams(overrides: Partial<ItemParams>): ItemParams {
  return {
    family: "blade", length: 4, width: 2, taper: 0.5, curvature: 0.3,
    crossPiece: false, richness: "standard", dominantCategory: "impl",
    ...overrides,
  };
}

describe("generateItemPixels", () => {
  it("returns a 2D pixel array with non-zero pixels", () => {
    const result = generateItemPixels(makeItemParams({}), createPrng(SEED));
    expect(result.pixels.length).toBeGreaterThan(0);
    const flat = result.pixels.flat();
    expect(flat.some((v) => v !== 0)).toBe(true);
  });

  it("blade family: taller than wide", () => {
    const result = generateItemPixels(makeItemParams({ family: "blade", length: 5, width: 2 }), createPrng(SEED));
    expect(result.pixels.length).toBeGreaterThan(result.pixels[0]?.length ?? 0);
  });

  it("shield family: wider than tall", () => {
    const result = generateItemPixels(makeItemParams({ family: "shield", length: 3, width: 4 }), createPrng(SEED));
    expect(result.pixels[0]?.length ?? 0).toBeGreaterThanOrEqual(result.pixels.length);
  });

  it("orb family: roughly square", () => {
    const result = generateItemPixels(makeItemParams({ family: "orb", length: 3, width: 3 }), createPrng(SEED));
    const h = result.pixels.length;
    const w = result.pixels[0]?.length ?? 0;
    expect(Math.abs(h - w)).toBeLessThanOrEqual(2);
  });

  it("all 5 families produce valid output", () => {
    for (const family of ["blade", "staff", "shield", "tool", "orb"] as const) {
      const result = generateItemPixels(makeItemParams({ family }), createPrng(SEED));
      expect(result.pixels.length).toBeGreaterThan(0);
      expect(result.pixels.flat().some((v) => v !== 0)).toBe(true);
    }
  });

  it("lavish richness adds more pixels than modest", () => {
    const modest = generateItemPixels(makeItemParams({ richness: "modest" }), createPrng(SEED));
    const lavish = generateItemPixels(makeItemParams({ richness: "lavish" }), createPrng(SEED));
    const modestCount = modest.pixels.flat().filter((v) => v !== 0).length;
    const lavishCount = lavish.pixels.flat().filter((v) => v !== 0).length;
    expect(lavishCount).toBeGreaterThanOrEqual(modestCount);
  });

  it("is deterministic", () => {
    const a = generateItemPixels(makeItemParams({}), createPrng(SEED));
    const b = generateItemPixels(makeItemParams({}), createPrng(SEED));
    expect(a).toEqual(b);
  });

  it("returns anchorPoint for placement", () => {
    const result = generateItemPixels(makeItemParams({}), createPrng(SEED));
    expect(typeof result.anchorRow).toBe("number");
    expect(typeof result.anchorCol).toBe("number");
  });
});
