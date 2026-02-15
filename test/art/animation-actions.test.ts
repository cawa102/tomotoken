import { describe, it, expect } from "vitest";
import {
  applyBlink, applyArmSway, applyFootTap, applyGesture, applyShimmer,
} from "../../src/art/animation-actions.js";
import type { AnimationHints, MutablePixelCanvas } from "../../src/art/pixel/types.js";

function makeCanvas(): MutablePixelCanvas {
  return Array.from({ length: 8 }, () => Array(8).fill(0));
}

function makeHints(): AnimationHints {
  return {
    eyePositions: [[2, 3], [2, 5]],
    gesturePixels: [[4, 1], [4, 7]],
    shimmerPixels: [[3, 3], [3, 4], [3, 5]],
  };
}

describe("applyBlink", () => {
  it("sets eye pixels to palette 1 (closed)", () => {
    const canvas = makeCanvas();
    canvas[2][3] = 6; // pupil
    canvas[2][5] = 6;
    const result = applyBlink(canvas, makeHints());
    expect(result[2][3]).toBe(1);
    expect(result[2][5]).toBe(1);
  });

  it("does not modify non-eye pixels", () => {
    const canvas = makeCanvas();
    canvas[3][3] = 2;
    const result = applyBlink(canvas, makeHints());
    expect(result[3][3]).toBe(2);
  });

  it("returns new canvas (immutable)", () => {
    const canvas = makeCanvas();
    canvas[2][3] = 6;
    const before = canvas.map((r) => [...r]);
    applyBlink(canvas, makeHints());
    expect(canvas).toEqual(before);
  });
});

describe("applyArmSway", () => {
  it("shifts a gesture pixel by 1 in row direction", () => {
    const canvas = makeCanvas();
    canvas[4][1] = 2;
    const hints: AnimationHints = {
      ...makeHints(),
      gesturePixels: [[4, 1]],
    };
    const prng = () => 0.5;
    const result = applyArmSway(canvas, hints, prng);
    // Original pixel should be moved
    const changed = result[3][1] !== 0 || result[5][1] !== 0;
    expect(changed).toBe(true);
  });
});

describe("applyFootTap", () => {
  it("shifts a gesture pixel up by 1", () => {
    const canvas = makeCanvas();
    canvas[4][1] = 2;
    const hints: AnimationHints = {
      ...makeHints(),
      gesturePixels: [[4, 1]],
    };
    const prng = () => 0.1;
    const result = applyFootTap(canvas, hints, prng);
    expect(result[3][1]).toBe(2);
    expect(result[4][1]).toBe(0);
  });
});

describe("applyGesture", () => {
  it("shifts gesture pixels horizontally", () => {
    const canvas = makeCanvas();
    canvas[4][1] = 2;
    canvas[4][7] = 2;
    const prng = () => 0.5;
    const result = applyGesture(canvas, makeHints(), prng);
    // At least one pixel should have moved
    const moved = result[4][1] !== canvas[4][1] || result[4][7] !== canvas[4][7];
    expect(moved).toBe(true);
  });
});

describe("applyShimmer", () => {
  it("changes shimmer pixel to highlight (4)", () => {
    const canvas = makeCanvas();
    canvas[3][3] = 2;
    canvas[3][4] = 2;
    const prng = () => 0.1;
    const result = applyShimmer(canvas, makeHints(), prng);
    const hasHighlight = result.flat().includes(4);
    expect(hasHighlight).toBe(true);
  });
});
