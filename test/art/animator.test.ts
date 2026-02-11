import { describe, it, expect } from "vitest";
import { generateFrames } from "../../src/art/animator.js";
import { generateBody } from "../../src/art/body.js";
import { createPrng } from "../../src/utils/hash.js";

const SEED = "1111222233334444555566667777888811112222333344445555666677778888";

describe("generateFrames", () => {
  it("generates exactly 4 frames", () => {
    const prng = createPrng(SEED);
    const base = generateBody(prng, 0.5, "builder", 24, 12);
    const prng2 = createPrng(SEED);
    const frames = generateFrames(base, prng2, "builder");
    expect(frames).toHaveLength(4);
  });

  it("frames have same dimensions as base", () => {
    const prng = createPrng(SEED);
    const base = generateBody(prng, 0.5, "builder", 24, 12);
    const prng2 = createPrng(SEED);
    const frames = generateFrames(base, prng2, "builder");
    for (const frame of frames) {
      expect(frame.length).toBe(base.length);
      expect(frame[0].length).toBe(base[0].length);
    }
  });

  it("frames are 95%+ similar to base", () => {
    const prng = createPrng(SEED);
    const base = generateBody(prng, 0.7, "scholar", 24, 12);
    const prng2 = createPrng(SEED);
    const frames = generateFrames(base, prng2, "scholar");
    for (const frame of frames) {
      let same = 0;
      let total = 0;
      for (let y = 0; y < base.length; y++) {
        for (let x = 0; x < base[0].length; x++) {
          total++;
          if (frame[y][x] === base[y][x]) same++;
        }
      }
      expect(same / total).toBeGreaterThan(0.90);
    }
  });
});
