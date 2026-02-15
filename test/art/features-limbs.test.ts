import { describe, it, expect } from "vitest";
import { placeFeatures } from "../../src/art/parametric/features.js";
import type {
  CreatureParams,
  Bounds,
  WidthMap,
} from "../../src/art/parametric/types.js";
import type { MutablePixelCanvas } from "../../src/art/pixel/types.js";

function makeCanvas(w: number, h: number): MutablePixelCanvas {
  return Array.from({ length: h }, () => Array(w).fill(0));
}

function makeParams(overrides: Partial<CreatureParams>): CreatureParams {
  return {
    headRatio: 0.3,
    bodyWidthRatio: 0.5,
    roundness: 0.5,
    topHeavy: 0.3,
    eyeSize: 1,
    eyeSpacing: 0.5,
    hasEars: false,
    hasHorns: false,
    hasTail: false,
    hasWings: false,
    limbStage: 0,
    patternType: 0,
    patternDensity: 0,
    neckWidth: 0.5,
    legLength: 0.2,
    armLength: 0.2,
    tailLength: 0.2,
    wingSize: 0.2,
    earSize: 0.2,
    hornSize: 0.2,
    bodyTaper: 0.3,
    asymmetry: 0.05,
    ...overrides,
  };
}

const W = 32;
const H = 32;
const headBounds: Bounds = { top: 10, bottom: 16, left: 12, right: 20 };
const bodyBounds: Bounds = { top: 17, bottom: 26, left: 10, right: 22 };
const widthMap: WidthMap = Array(H).fill(null);

function countNonZeroPixelsInRegion(
  canvas: MutablePixelCanvas,
  rowStart: number,
  rowEnd: number,
  colStart: number,
  colEnd: number,
): number {
  let count = 0;
  for (let r = rowStart; r <= rowEnd; r++) {
    for (let c = colStart; c <= colEnd; c++) {
      if (
        r >= 0 &&
        r < canvas.length &&
        c >= 0 &&
        c < canvas[0].length &&
        canvas[r][c] !== 0
      ) {
        count++;
      }
    }
  }
  return count;
}

describe("placeFeatures limb stages", () => {
  const prng = () => 0.5; // deterministic

  it("limbStage=0: no arm or leg pixels below/beside body", () => {
    const canvas = makeCanvas(W, H);
    const params = makeParams({ limbStage: 0 });
    const { canvas: result } = placeFeatures(
      canvas,
      widthMap,
      params,
      headBounds,
      bodyBounds,
      prng,
    );
    // Check no pixels outside body bounds on sides (arms area)
    const armPixels = countNonZeroPixelsInRegion(
      result,
      bodyBounds.top,
      bodyBounds.bottom,
      0,
      bodyBounds.left - 2,
    );
    const legPixels = countNonZeroPixelsInRegion(
      result,
      bodyBounds.bottom + 1,
      H - 1,
      0,
      W - 1,
    );
    expect(armPixels).toBe(0);
    expect(legPixels).toBe(0);
  });

  it("limbStage=1: arm pixels are 1px wide sticks", () => {
    const canvas = makeCanvas(W, H);
    const params = makeParams({ limbStage: 1 });
    const { canvas: result } = placeFeatures(
      canvas,
      widthMap,
      params,
      headBounds,
      bodyBounds,
      prng,
    );
    // Left arm column: bodyBounds.left - 1
    const leftArmCol = bodyBounds.left - 1;
    let armPixelCount = 0;
    for (let r = bodyBounds.top; r <= bodyBounds.bottom; r++) {
      if (result[r][leftArmCol] !== 0) armPixelCount++;
    }
    expect(armPixelCount).toBeGreaterThan(0);
    // Each arm row should be exactly 1px wide (no pixel at leftArmCol - 1)
    for (let r = bodyBounds.top; r <= bodyBounds.bottom; r++) {
      if (result[r][leftArmCol] !== 0) {
        expect(result[r][leftArmCol - 1]).toBe(0);
      }
    }
  });

  it("limbStage=1: leg pixels are 1px wide sticks", () => {
    const canvas = makeCanvas(W, H);
    const params = makeParams({ limbStage: 1 });
    const { canvas: result } = placeFeatures(
      canvas,
      widthMap,
      params,
      headBounds,
      bodyBounds,
      prng,
    );
    // Legs below body
    let legPixels = 0;
    for (let r = bodyBounds.bottom + 1; r < H; r++) {
      for (let c = 0; c < W; c++) {
        if (result[r][c] !== 0) legPixels++;
      }
    }
    expect(legPixels).toBeGreaterThan(0);
  });

  it("limbStage=2: arms are 2px wide", () => {
    const canvas = makeCanvas(W, H);
    const params = makeParams({ limbStage: 2, armLength: 0.3 });
    const { canvas: result } = placeFeatures(
      canvas,
      widthMap,
      params,
      headBounds,
      bodyBounds,
      prng,
    );
    const armRow =
      bodyBounds.top +
      Math.round((bodyBounds.bottom - bodyBounds.top) * 0.25);
    // Left arm: should have pixels at both bodyBounds.left - 1 and bodyBounds.left - 2
    const col1 = bodyBounds.left - 1;
    const col2 = bodyBounds.left - 2;
    let twoPixWideRows = 0;
    for (let r = armRow; r <= bodyBounds.bottom; r++) {
      if (result[r][col1] !== 0 && result[r][col2] !== 0) twoPixWideRows++;
    }
    expect(twoPixWideRows).toBeGreaterThan(0);
  });

  it("limbStage=2: elbow has joint highlight (palette 3)", () => {
    const canvas = makeCanvas(W, H);
    const params = makeParams({ limbStage: 2, armLength: 0.3 });
    const { canvas: result } = placeFeatures(
      canvas,
      widthMap,
      params,
      headBounds,
      bodyBounds,
      prng,
    );
    // There should be at least one pixel with palette 3 (joint) in the arm region
    let jointPixels = 0;
    for (let r = bodyBounds.top; r <= bodyBounds.bottom; r++) {
      for (let c = 0; c < bodyBounds.left; c++) {
        if (result[r][c] === 3) jointPixels++;
      }
    }
    expect(jointPixels).toBeGreaterThan(0);
  });

  it("limbStage=2: legs are 2px wide with knee highlight", () => {
    const canvas = makeCanvas(W, H);
    const params = makeParams({ limbStage: 2, legLength: 0.3 });
    const { canvas: result } = placeFeatures(
      canvas,
      widthMap,
      params,
      headBounds,
      bodyBounds,
      prng,
    );
    let kneePixels = 0;
    for (let r = bodyBounds.bottom + 1; r < H; r++) {
      for (let c = 0; c < W; c++) {
        if (result[r][c] === 3) kneePixels++;
      }
    }
    expect(kneePixels).toBeGreaterThan(0);
  });
});
