import { describe, it, expect } from "vitest";
import { createPrng } from "../../src/utils/hash.js";
import { generateFrames, generateBaseFrame, generateRandomFrame, getActionPool } from "../../src/art/animator.js";
import { generateBody } from "../../src/art/body.js";
import type { AnimationHints, PixelCanvas } from "../../src/art/pixel/types.js";
import type { DepthMetrics, StyleMetrics } from "../../src/store/types.js";
import type { LimbStage } from "../../src/art/parametric/types.js";

const SEED = "1111222233334444555566667777888811112222333344445555666677778888";
const DEPTH: DepthMetrics = { editTestLoopCount: 5, repeatEditSameFileCount: 3, phaseSwitchCount: 10, totalSessions: 5 };
const STYLE: StyleMetrics = { bulletRatio: 0.3, questionRatio: 0.02, codeblockRatio: 0.1, avgMessageLen: 200, messageLenStd: 50, headingRatio: 0.05 };
const TRAITS = { builder: 50, fixer: 20, refiner: 10, scholar: 10, scribe: 5, architect: 5, operator: 0, guardian: 0 };

function makeBase(): PixelCanvas {
  const canvas = Array.from({ length: 8 }, () => Array(8).fill(0));
  canvas[2][3] = 6; canvas[2][5] = 6; // eyes
  canvas[4][1] = 2; canvas[4][7] = 2; // arms
  canvas[6][3] = 2; canvas[6][5] = 2; // legs
  return canvas;
}

function makeHints(): AnimationHints {
  return {
    eyePositions: [[2, 3], [2, 5]],
    gesturePixels: [[4, 1], [4, 7], [6, 3], [6, 5]],
    shimmerPixels: [[3, 3], [3, 4], [3, 5]],
  };
}

describe("generateFrames (legacy)", () => {
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

describe("generateBaseFrame", () => {
  it("returns deep copy of input", () => {
    const base = makeBase();
    const result = generateBaseFrame(base);
    expect(result).toEqual(base);
    expect(result).not.toBe(base);
  });
});

describe("getActionPool", () => {
  it("Stage 0: returns blink, gesture, shimmer only", () => {
    const pool = getActionPool(0);
    expect(pool).toContain("blink");
    expect(pool).toContain("gesture");
    expect(pool).toContain("shimmer");
    expect(pool).not.toContain("arm_sway");
    expect(pool).not.toContain("foot_tap");
  });

  it("Stage 1: same as Stage 0 (no limb animations)", () => {
    const pool = getActionPool(1);
    expect(pool).not.toContain("arm_sway");
    expect(pool).not.toContain("foot_tap");
  });

  it("Stage 2-3: adds arm_sway", () => {
    expect(getActionPool(2)).toContain("arm_sway");
    expect(getActionPool(3)).toContain("arm_sway");
  });

  it("Stage 3+: adds foot_tap", () => {
    expect(getActionPool(3)).toContain("foot_tap");
    expect(getActionPool(4)).toContain("foot_tap");
  });

  it("Stage 5: adds orb_float", () => {
    expect(getActionPool(5)).toContain("orb_float");
  });
});

describe("generateRandomFrame", () => {
  it("returns frame with same dimensions as base", () => {
    const base = makeBase();
    const frame = generateRandomFrame(base, makeHints(), 4, Math.random);
    expect(frame).toHaveLength(base.length);
    expect(frame[0]).toHaveLength(base[0].length);
  });

  it("frame is 90%+ similar to base", () => {
    const base = makeBase();
    const frame = generateRandomFrame(base, makeHints(), 4, Math.random);
    let same = 0;
    let total = 0;
    for (let r = 0; r < base.length; r++) {
      for (let c = 0; c < base[r].length; c++) {
        total++;
        if (frame[r][c] === base[r][c]) same++;
      }
    }
    expect(same / total).toBeGreaterThan(0.9);
  });

  it("sometimes returns base unchanged (no action triggered)", () => {
    const base = makeBase();
    // Use prng that returns high value (above 0.3 threshold = no action)
    const noActionPrng = () => 0.95;
    const frame = generateRandomFrame(base, makeHints(), 4, noActionPrng);
    expect(frame).toEqual(base);
  });
});
