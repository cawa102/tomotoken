import { describe, it, expect } from "vitest";
import { createPrng } from "../../src/utils/hash.js";
import { deriveItemParams } from "../../src/art/parametric/item-params.js";
import type { ItemFamily } from "../../src/art/parametric/item-types.js";

const SEED = "1111222233334444555566667777888811112222333344445555666677778888";
const TRAITS = { builder: 60, fixer: 40, refiner: 30, scholar: 50, scribe: 20, architect: 70, operator: 10, guardian: 45 };
const USAGE_MIX = { impl: 0.4, debug: 0.2, refactor: 0.1, research: 0.1, docs: 0.05, planning: 0.1, ops: 0.03, security: 0.02 };

describe("deriveItemParams", () => {
  it("returns valid ItemFamily", () => {
    const prng = createPrng(SEED);
    const result = deriveItemParams(TRAITS, USAGE_MIX, 0.8, prng);
    const validFamilies: ItemFamily[] = ["blade", "staff", "shield", "tool", "orb"];
    expect(validFamilies).toContain(result.family);
  });

  it("length is in [2, 6]", () => {
    const prng = createPrng(SEED);
    const result = deriveItemParams(TRAITS, USAGE_MIX, 0.8, prng);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.length).toBeLessThanOrEqual(6);
  });

  it("width is in [1, 4]", () => {
    const prng = createPrng(SEED);
    const result = deriveItemParams(TRAITS, USAGE_MIX, 0.8, prng);
    expect(result.width).toBeGreaterThanOrEqual(1);
    expect(result.width).toBeLessThanOrEqual(4);
  });

  it("taper is in [0, 1]", () => {
    const prng = createPrng(SEED);
    const result = deriveItemParams(TRAITS, USAGE_MIX, 0.8, prng);
    expect(result.taper).toBeGreaterThanOrEqual(0);
    expect(result.taper).toBeLessThanOrEqual(1);
  });

  it("curvature is in [0, 1]", () => {
    const prng = createPrng(SEED);
    const result = deriveItemParams(TRAITS, USAGE_MIX, 0.8, prng);
    expect(result.curvature).toBeGreaterThanOrEqual(0);
    expect(result.curvature).toBeLessThanOrEqual(1);
  });

  it("crossPiece is boolean", () => {
    const prng = createPrng(SEED);
    const result = deriveItemParams(TRAITS, USAGE_MIX, 0.8, prng);
    expect(typeof result.crossPiece).toBe("boolean");
  });

  it("richness is 'modest', 'standard', or 'lavish'", () => {
    const prng = createPrng(SEED);
    const result = deriveItemParams(TRAITS, USAGE_MIX, 0.8, prng);
    expect(["modest", "standard", "lavish"]).toContain(result.richness);
  });

  it("richness='modest' when tokenRatio < 0.5", () => {
    const prng = createPrng(SEED);
    const result = deriveItemParams(TRAITS, USAGE_MIX, 0.3, prng);
    expect(result.richness).toBe("modest");
  });

  it("richness='lavish' when tokenRatio > 1.0", () => {
    const prng = createPrng(SEED);
    const result = deriveItemParams(TRAITS, USAGE_MIX, 1.5, prng);
    expect(result.richness).toBe("lavish");
  });

  it("is deterministic (same seed → same result)", () => {
    const a = deriveItemParams(TRAITS, USAGE_MIX, 0.8, createPrng(SEED));
    const b = deriveItemParams(TRAITS, USAGE_MIX, 0.8, createPrng(SEED));
    expect(a).toEqual(b);
  });

  it("different seeds → different results", () => {
    const seed2 = "aaaa" + SEED.slice(4);
    const a = deriveItemParams(TRAITS, USAGE_MIX, 0.8, createPrng(SEED));
    const b = deriveItemParams(TRAITS, USAGE_MIX, 0.8, createPrng(seed2));
    expect(a).not.toEqual(b);
  });
});
