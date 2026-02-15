import { describe, it, expect } from "vitest";
import { generateFrames } from "../../src/art/animator.js";
import { generateBody } from "../../src/art/body.js";
import { createPrng } from "../../src/utils/hash.js";
import type { DepthMetrics, StyleMetrics } from "../../src/store/types.js";

const SEED = "1111222233334444555566667777888811112222333344445555666677778888";
const DEPTH: DepthMetrics = { editTestLoopCount: 5, repeatEditSameFileCount: 3, phaseSwitchCount: 10, totalSessions: 5 };
const STYLE: StyleMetrics = { bulletRatio: 0.3, questionRatio: 0.02, codeblockRatio: 0.1, avgMessageLen: 200, messageLenStd: 50, headingRatio: 0.05 };
const TRAITS = { builder: 50, fixer: 20, refiner: 10, scholar: 10, scribe: 5, architect: 5, operator: 0, guardian: 0 };

describe("generateFrames", () => {
  it("generates exactly 4 frames", () => {
    const prng = createPrng(SEED);
    const { pixelCanvas, animationHints } = generateBody(prng, 0.5, TRAITS, DEPTH, STYLE, 24, 12);
    const prng2 = createPrng(SEED);
    const frames = generateFrames(pixelCanvas, animationHints, prng2);
    expect(frames).toHaveLength(4);
  });

  it("frames have same dimensions as base", () => {
    const prng = createPrng(SEED);
    const { pixelCanvas, animationHints } = generateBody(prng, 0.5, TRAITS, DEPTH, STYLE, 24, 12);
    const prng2 = createPrng(SEED);
    const frames = generateFrames(pixelCanvas, animationHints, prng2);
    for (const frame of frames) {
      expect(frame.length).toBe(pixelCanvas.length);
      expect(frame[0].length).toBe(pixelCanvas[0].length);
    }
  });

  it("frames are 90%+ similar to base", () => {
    const prng = createPrng(SEED);
    const { pixelCanvas, animationHints } = generateBody(prng, 0.7, TRAITS, DEPTH, STYLE, 24, 12);
    const prng2 = createPrng(SEED);
    const frames = generateFrames(pixelCanvas, animationHints, prng2);
    for (const frame of frames) {
      let same = 0;
      let total = 0;
      for (let y = 0; y < pixelCanvas.length; y++) {
        for (let x = 0; x < pixelCanvas[0].length; x++) {
          total++;
          if (frame[y][x] === pixelCanvas[y][x]) same++;
        }
      }
      expect(same / total).toBeGreaterThan(0.90);
    }
  });
});
