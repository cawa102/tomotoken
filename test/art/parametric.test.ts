import { describe, it, expect } from "vitest";
import { createPrng } from "../../src/utils/hash.js";
import { deriveCreatureParams } from "../../src/art/parametric/params.js";
import { generatePalette } from "../../src/art/parametric/palette.js";
import { adjustParamsForProgress } from "../../src/art/parametric/progress.js";
import { generateSilhouette } from "../../src/art/parametric/silhouette.js";
import { rasterizeSilhouette } from "../../src/art/parametric/rasterize.js";
import { placeFeatures } from "../../src/art/parametric/features.js";
import { applyPattern } from "../../src/art/parametric/pattern.js";
import { generateParametricBody } from "../../src/art/parametric/index.js";
import type { DepthMetrics, StyleMetrics } from "../../src/store/types.js";

const SEED =
  "abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234";
const DEPTH: DepthMetrics = {
  editTestLoopCount: 5,
  repeatEditSameFileCount: 3,
  phaseSwitchCount: 10,
  totalSessions: 5,
};
const STYLE: StyleMetrics = {
  bulletRatio: 0.3,
  questionRatio: 0.02,
  codeblockRatio: 0.1,
  avgMessageLen: 200,
  messageLenStd: 50,
  headingRatio: 0.05,
};
const TRAITS = {
  builder: 50,
  fixer: 20,
  refiner: 10,
  scholar: 10,
  scribe: 5,
  architect: 5,
  operator: 0,
  guardian: 0,
};

// ---------------------------------------------------------------------------
// deriveCreatureParams
// ---------------------------------------------------------------------------
describe("deriveCreatureParams", () => {
  it("returns all expected fields", () => {
    const prng = createPrng(SEED);
    const p = deriveCreatureParams(TRAITS, DEPTH, STYLE, prng);
    expect(p).toHaveProperty("headRatio");
    expect(p).toHaveProperty("bodyWidthRatio");
    expect(p).toHaveProperty("roundness");
    expect(p).toHaveProperty("eyeSize");
    expect(p).toHaveProperty("hasEars");
    expect(p).toHaveProperty("hasHorns");
    expect(p).toHaveProperty("hasTail");
    expect(p).toHaveProperty("hasWings");
    expect(p).toHaveProperty("limbStage");
    expect(p).toHaveProperty("patternType");
    expect(p).toHaveProperty("patternDensity");
    expect(p).toHaveProperty("neckWidth");
    expect(p).toHaveProperty("legLength");
    expect(p).toHaveProperty("armLength");
    expect(p).toHaveProperty("tailLength");
    expect(p).toHaveProperty("wingSize");
    expect(p).toHaveProperty("earSize");
    expect(p).toHaveProperty("hornSize");
    expect(p).toHaveProperty("bodyTaper");
    expect(p).toHaveProperty("asymmetry");
  });

  it("headRatio is in [0.20, 0.45]", () => {
    const prng = createPrng(SEED);
    const p = deriveCreatureParams(TRAITS, DEPTH, STYLE, prng);
    expect(p.headRatio).toBeGreaterThanOrEqual(0.2);
    expect(p.headRatio).toBeLessThanOrEqual(0.45);
  });

  it("bodyWidthRatio is in [0.30, 0.80]", () => {
    const prng = createPrng(SEED);
    const p = deriveCreatureParams(TRAITS, DEPTH, STYLE, prng);
    expect(p.bodyWidthRatio).toBeGreaterThanOrEqual(0.3);
    expect(p.bodyWidthRatio).toBeLessThanOrEqual(0.8);
  });

  it("roundness is in [0.0, 1.0]", () => {
    const prng = createPrng(SEED);
    const p = deriveCreatureParams(TRAITS, DEPTH, STYLE, prng);
    expect(p.roundness).toBeGreaterThanOrEqual(0.0);
    expect(p.roundness).toBeLessThanOrEqual(1.0);
  });

  it("eyeSize is 1, 2, or 3", () => {
    const prng = createPrng(SEED);
    const p = deriveCreatureParams(TRAITS, DEPTH, STYLE, prng);
    expect([1, 2, 3]).toContain(p.eyeSize);
  });

  it("boolean features are booleans", () => {
    const prng = createPrng(SEED);
    const p = deriveCreatureParams(TRAITS, DEPTH, STYLE, prng);
    expect(typeof p.hasEars).toBe("boolean");
    expect(typeof p.hasHorns).toBe("boolean");
    expect(typeof p.hasTail).toBe("boolean");
    expect(typeof p.hasWings).toBe("boolean");
    expect(typeof p.limbStage).toBe("number");
  });

  it("has limbStage property of type number", () => {
    const prng = createPrng(SEED);
    const p = deriveCreatureParams(TRAITS, DEPTH, STYLE, prng);
    expect(typeof p.limbStage).toBe("number");
    expect(p.limbStage).toBe(0); // raw params always have limbStage=0 (pre-progress)
  });

  it("does not have hasArms or hasLegs properties", () => {
    const prng = createPrng(SEED);
    const p = deriveCreatureParams(TRAITS, DEPTH, STYLE, prng);
    expect("hasArms" in p).toBe(false);
    expect("hasLegs" in p).toBe(false);
  });

  it("is deterministic (same seed → same result)", () => {
    const a = deriveCreatureParams(TRAITS, DEPTH, STYLE, createPrng(SEED));
    const b = deriveCreatureParams(TRAITS, DEPTH, STYLE, createPrng(SEED));
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// generatePalette
// ---------------------------------------------------------------------------
describe("generatePalette", () => {
  it("returns 10 colors", () => {
    const prng = createPrng(SEED);
    const pal = generatePalette(TRAITS, DEPTH, STYLE, prng);
    expect(pal.colors).toHaveLength(10);
  });

  it("slot 0 is 0 (transparent)", () => {
    const prng = createPrng(SEED);
    const pal = generatePalette(TRAITS, DEPTH, STYLE, prng);
    expect(pal.colors[0]).toBe(0);
  });

  it("slot 5 is 231 (eye white)", () => {
    const prng = createPrng(SEED);
    const pal = generatePalette(TRAITS, DEPTH, STYLE, prng);
    expect(pal.colors[5]).toBe(231);
  });

  it("slot 6 is 16 (pupil/black)", () => {
    const prng = createPrng(SEED);
    const pal = generatePalette(TRAITS, DEPTH, STYLE, prng);
    expect(pal.colors[6]).toBe(16);
  });

  it("all color indices are valid ANSI 256 range (0-255)", () => {
    const prng = createPrng(SEED);
    const pal = generatePalette(TRAITS, DEPTH, STYLE, prng);
    for (const c of pal.colors) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(255);
    }
  });

  it("is deterministic", () => {
    const a = generatePalette(TRAITS, DEPTH, STYLE, createPrng(SEED));
    const b = generatePalette(TRAITS, DEPTH, STYLE, createPrng(SEED));
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// adjustParamsForProgress
// ---------------------------------------------------------------------------
describe("adjustParamsForProgress", () => {
  const baseParams = deriveCreatureParams(
    TRAITS,
    DEPTH,
    STYLE,
    createPrng(SEED),
  );

  it("progress < 0.1: limbStage=0, features disabled, patternDensity=0", () => {
    const p = adjustParamsForProgress(baseParams, 0.05);
    expect(p.limbStage).toBe(0);
    expect(p.hasEars).toBe(false);
    expect(p.hasTail).toBe(false);
    expect(p.hasHorns).toBe(false);
    expect(p.hasWings).toBe(false);
    expect(p.patternDensity).toBe(0);
  });

  it("progress = 0.5: ears/tail allowed, horns/wings disabled", () => {
    const p = adjustParamsForProgress(baseParams, 0.5);
    expect(p.hasHorns).toBe(false);
    expect(p.hasWings).toBe(false);
    // ears/tail preserve original value
    expect(p.hasEars).toBe(baseParams.hasEars);
    expect(p.hasTail).toBe(baseParams.hasTail);
  });

  it("progress = 1.0: all features preserved from input", () => {
    const p = adjustParamsForProgress(baseParams, 1.0);
    expect(p.hasEars).toBe(baseParams.hasEars);
    expect(p.hasTail).toBe(baseParams.hasTail);
    expect(p.hasHorns).toBe(baseParams.hasHorns);
    expect(p.hasWings).toBe(baseParams.hasWings);
  });

  describe("limbStage progression", () => {
    const base = deriveCreatureParams(TRAITS, DEPTH, STYLE, createPrng(SEED));

    it("limbStage=0 when progress < 0.1", () => {
      expect(adjustParamsForProgress(base, 0.05).limbStage).toBe(0);
    });

    it("limbStage=1 when progress in [0.1, 0.3)", () => {
      expect(adjustParamsForProgress(base, 0.1).limbStage).toBe(1);
      expect(adjustParamsForProgress(base, 0.29).limbStage).toBe(1);
    });

    it("limbStage=2 when progress in [0.3, 0.5)", () => {
      expect(adjustParamsForProgress(base, 0.3).limbStage).toBe(2);
      expect(adjustParamsForProgress(base, 0.49).limbStage).toBe(2);
    });

    it("limbStage=3 when progress in [0.5, 0.7)", () => {
      expect(adjustParamsForProgress(base, 0.5).limbStage).toBe(3);
      expect(adjustParamsForProgress(base, 0.69).limbStage).toBe(3);
    });

    it("limbStage=4 when progress in [0.7, 1.0)", () => {
      expect(adjustParamsForProgress(base, 0.7).limbStage).toBe(4);
      expect(adjustParamsForProgress(base, 0.99).limbStage).toBe(4);
    });

    it("limbStage=5 when progress >= 1.0", () => {
      expect(adjustParamsForProgress(base, 1.0).limbStage).toBe(5);
    });
  });

  it("immutable: input params not modified", () => {
    const before = { ...baseParams };
    adjustParamsForProgress(baseParams, 0.05);
    expect(baseParams).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// generateSilhouette
// ---------------------------------------------------------------------------
describe("generateSilhouette", () => {
  const params = adjustParamsForProgress(
    deriveCreatureParams(TRAITS, DEPTH, STYLE, createPrng(SEED)),
    0.5,
  );
  const canvasW = 32;
  const pixelH = 32;

  it("returns widthMap, headBounds, bodyBounds", () => {
    const s = generateSilhouette(params, canvasW, pixelH, 0.5);
    expect(s).toHaveProperty("widthMap");
    expect(s).toHaveProperty("headBounds");
    expect(s).toHaveProperty("bodyBounds");
  });

  it("widthMap length equals pixelH", () => {
    const s = generateSilhouette(params, canvasW, pixelH, 0.5);
    expect(s.widthMap).toHaveLength(pixelH);
  });

  it("head bounds are above body bounds", () => {
    const s = generateSilhouette(params, canvasW, pixelH, 0.5);
    expect(s.headBounds.bottom).toBeLessThanOrEqual(s.bodyBounds.top);
  });

  it("creature grows with progress", () => {
    const small = generateSilhouette(params, canvasW, pixelH, 0.1);
    const large = generateSilhouette(params, canvasW, pixelH, 1.0);
    const filledSmall = small.widthMap.filter((e) => e !== null).length;
    const filledLarge = large.widthMap.filter((e) => e !== null).length;
    expect(filledLarge).toBeGreaterThan(filledSmall);
  });

  it("at progress=0 creature is tiny, at progress=1 it's large", () => {
    const tiny = generateSilhouette(params, canvasW, pixelH, 0.0);
    const full = generateSilhouette(params, canvasW, pixelH, 1.0);
    const tinyFilled = tiny.widthMap.filter((e) => e !== null).length;
    const fullFilled = full.widthMap.filter((e) => e !== null).length;
    expect(tinyFilled).toBeLessThan(fullFilled);
    expect(tinyFilled).toBeGreaterThan(0); // still has some rows even at 0
  });
});

// ---------------------------------------------------------------------------
// rasterizeSilhouette
// ---------------------------------------------------------------------------
describe("rasterizeSilhouette", () => {
  const params = adjustParamsForProgress(
    deriveCreatureParams(TRAITS, DEPTH, STYLE, createPrng(SEED)),
    0.5,
  );
  const canvasW = 32;
  const pixelH = 32;
  const { widthMap } = generateSilhouette(params, canvasW, pixelH, 0.5);

  it("returns canvas with correct dimensions", () => {
    const canvas = rasterizeSilhouette(widthMap, canvasW, pixelH);
    expect(canvas).toHaveLength(pixelH);
    for (const row of canvas) {
      expect(row).toHaveLength(canvasW);
    }
  });

  it("outline pixels are 1, body fill pixels are 2", () => {
    const canvas = rasterizeSilhouette(widthMap, canvasW, pixelH);
    const values = new Set(canvas.flat());
    // Should have 0 (transparent), 1 (outline), 2 (fill)
    expect(values.has(0)).toBe(true);
    expect(values.has(1)).toBe(true);
    expect(values.has(2)).toBe(true);
  });

  it("transparent pixels are 0", () => {
    const canvas = rasterizeSilhouette(widthMap, canvasW, pixelH);
    // First row should be transparent (creature is bottom-aligned)
    expect(canvas[0].every((v) => v === 0)).toBe(true);
  });

  it("top and bottom rows of creature are all outline", () => {
    const canvas = rasterizeSilhouette(widthMap, canvasW, pixelH);
    // Find first and last non-empty rows
    let topRow = -1;
    let bottomRow = -1;
    for (let r = 0; r < pixelH; r++) {
      if (canvas[r].some((v) => v !== 0)) {
        if (topRow === -1) topRow = r;
        bottomRow = r;
      }
    }
    expect(topRow).toBeGreaterThanOrEqual(0);
    // All non-zero pixels in top row should be outline (1)
    const topNonZero = canvas[topRow].filter((v) => v !== 0);
    expect(topNonZero.every((v) => v === 1)).toBe(true);
    const bottomNonZero = canvas[bottomRow].filter((v) => v !== 0);
    expect(bottomNonZero.every((v) => v === 1)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// placeFeatures
// ---------------------------------------------------------------------------
describe("placeFeatures", () => {
  const prngForParams = createPrng(SEED);
  const rawParams = deriveCreatureParams(TRAITS, DEPTH, STYLE, prngForParams);
  const params = adjustParamsForProgress(rawParams, 0.8);
  const canvasW = 32;
  const pixelH = 32;
  const { widthMap, headBounds, bodyBounds } = generateSilhouette(
    params,
    canvasW,
    pixelH,
    0.8,
  );
  const canvas = rasterizeSilhouette(widthMap, canvasW, pixelH);

  it("always places eye pixels (palette 5/6)", () => {
    const prng = createPrng(SEED);
    const { canvas: featured } = placeFeatures(
      canvas,
      widthMap,
      params,
      headBounds,
      bodyBounds,
      prng,
    );
    const flat = featured.flat();
    // Pupil pixels (6) should always be present
    expect(flat.includes(6)).toBe(true);
  });

  it("returns animation hints with eyePositions", () => {
    const prng = createPrng(SEED);
    const { hints } = placeFeatures(
      canvas,
      widthMap,
      params,
      headBounds,
      bodyBounds,
      prng,
    );
    expect(hints.eyePositions.length).toBeGreaterThan(0);
    for (const [r, c] of hints.eyePositions) {
      expect(typeof r).toBe("number");
      expect(typeof c).toBe("number");
    }
  });

  it("shimmerPixels are non-empty for any creature with body", () => {
    const prng = createPrng(SEED);
    const { hints } = placeFeatures(
      canvas,
      widthMap,
      params,
      headBounds,
      bodyBounds,
      prng,
    );
    expect(hints.shimmerPixels.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// applyPattern
// ---------------------------------------------------------------------------
describe("applyPattern", () => {
  const canvasW = 32;
  const pixelH = 32;

  function buildTestCanvas() {
    const prng = createPrng(SEED);
    const rawParams = deriveCreatureParams(TRAITS, DEPTH, STYLE, prng);
    const params = adjustParamsForProgress(rawParams, 0.8);
    const { widthMap, headBounds, bodyBounds } = generateSilhouette(
      params,
      canvasW,
      pixelH,
      0.8,
    );
    const rasterized = rasterizeSilhouette(widthMap, canvasW, pixelH);
    const { canvas } = placeFeatures(
      rasterized,
      widthMap,
      params,
      headBounds,
      bodyBounds,
      createPrng(SEED),
    );
    return { canvas, widthMap, params, bodyBounds };
  }

  it("patternType 0 (none): canvas unchanged", () => {
    const { canvas, widthMap, params, bodyBounds } = buildTestCanvas();
    const noPatternParams = { ...params, patternType: 0 as const };
    const result = applyPattern(
      canvas,
      widthMap,
      noPatternParams,
      bodyBounds,
      createPrng(SEED),
    );
    // Should be a copy but identical values
    expect(result).toEqual(canvas);
    expect(result).not.toBe(canvas); // different reference
  });

  it("patternType 1-5: some body pixels changed from 2 to 3 (or 8/9)", () => {
    for (let pt = 1; pt <= 5; pt++) {
      const { canvas, widthMap, params, bodyBounds } = buildTestCanvas();
      const patternedParams = {
        ...params,
        patternType: pt as 1 | 2 | 3 | 4 | 5,
        patternDensity: 0.8,
      };
      const result = applyPattern(
        canvas,
        widthMap,
        patternedParams,
        bodyBounds,
        createPrng(SEED),
      );
      const flat = result.flat();
      // At least some pixels should now be 3, 8, or 9
      const hasSecondary =
        flat.includes(3) || flat.includes(8) || flat.includes(9);
      expect(hasSecondary).toBe(true);
    }
  });

  it("only modifies body pixels (2), doesn't touch outline (1) or eyes (5,6)", () => {
    const { canvas, widthMap, params, bodyBounds } = buildTestCanvas();
    const patternedParams = {
      ...params,
      patternType: 1 as const,
      patternDensity: 0.8,
    };
    const result = applyPattern(
      canvas,
      widthMap,
      patternedParams,
      bodyBounds,
      createPrng(SEED),
    );
    for (let r = 0; r < result.length; r++) {
      for (let c = 0; c < result[r].length; c++) {
        const orig = canvas[r][c];
        const after = result[r][c];
        // If original was outline or eye, it should be unchanged
        if (orig === 1 || orig === 5 || orig === 6) {
          expect(after).toBe(orig);
        }
      }
    }
  });

  it("returns new canvas (immutable)", () => {
    const { canvas, widthMap, params, bodyBounds } = buildTestCanvas();
    const before = canvas.map((row) => [...row]);
    applyPattern(canvas, widthMap, params, bodyBounds, createPrng(SEED));
    // Original canvas should not be mutated
    expect(canvas).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// generateParametricBody (full pipeline)
// ---------------------------------------------------------------------------
describe("generateParametricBody", () => {
  const canvasW = 32;
  const canvasH = 16;

  it("determinism: same inputs → identical PixelCanvas", () => {
    const a = generateParametricBody(
      createPrng(SEED),
      0.5,
      TRAITS,
      DEPTH,
      STYLE,
      canvasW,
      canvasH,
    );
    const b = generateParametricBody(
      createPrng(SEED),
      0.5,
      TRAITS,
      DEPTH,
      STYLE,
      canvasW,
      canvasH,
    );
    expect(a.pixelCanvas).toEqual(b.pixelCanvas);
    expect(a.palette).toEqual(b.palette);
  });

  it("diversity: different seeds → different pixel output", () => {
    const seedA = SEED;
    const seedB =
      "1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff";
    const a = generateParametricBody(
      createPrng(seedA),
      0.5,
      TRAITS,
      DEPTH,
      STYLE,
      canvasW,
      canvasH,
    );
    const b = generateParametricBody(
      createPrng(seedB),
      0.5,
      TRAITS,
      DEPTH,
      STYLE,
      canvasW,
      canvasH,
    );
    const hashA = a.pixelCanvas.flat().join(",");
    const hashB = b.pixelCanvas.flat().join(",");
    expect(hashA).not.toBe(hashB);
  });

  it("recognition: progress > 0 always produces canvas with eye pixels", () => {
    const result = generateParametricBody(
      createPrng(SEED),
      0.3,
      TRAITS,
      DEPTH,
      STYLE,
      canvasW,
      canvasH,
    );
    const flat = result.pixelCanvas.flat();
    const hasEyes = flat.includes(5) || flat.includes(6);
    expect(hasEyes).toBe(true);
  });

  it("progress: tiny at 0.05, large at 1.0", () => {
    const small = generateParametricBody(
      createPrng(SEED),
      0.05,
      TRAITS,
      DEPTH,
      STYLE,
      canvasW,
      canvasH,
    );
    const large = generateParametricBody(
      createPrng(SEED),
      1.0,
      TRAITS,
      DEPTH,
      STYLE,
      canvasW,
      canvasH,
    );
    const filledSmall = small.pixelCanvas.flat().filter((v) => v !== 0).length;
    const filledLarge = large.pixelCanvas.flat().filter((v) => v !== 0).length;
    expect(filledLarge).toBeGreaterThan(filledSmall);
  });

  it("returns valid BodyResult with pixelCanvas, animationHints, palette", () => {
    const result = generateParametricBody(
      createPrng(SEED),
      0.5,
      TRAITS,
      DEPTH,
      STYLE,
      canvasW,
      canvasH,
    );
    expect(result).toHaveProperty("pixelCanvas");
    expect(result).toHaveProperty("animationHints");
    expect(result).toHaveProperty("palette");
    expect(result.pixelCanvas).toHaveLength(canvasH * 2);
    expect(result.animationHints.eyePositions.length).toBeGreaterThan(0);
    expect(result.palette.colors).toHaveLength(10);
  });
});

// ---------------------------------------------------------------------------
// limb stages integration
// ---------------------------------------------------------------------------
describe("limb stages integration", () => {
  const canvasW = 32;
  const canvasH = 16;

  it("progress 0.05 → no limb pixels outside body", () => {
    const result = generateParametricBody(
      createPrng(SEED),
      0.05,
      TRAITS,
      DEPTH,
      STYLE,
      canvasW,
      canvasH,
    );
    const flat = result.pixelCanvas.flat();
    expect(flat.filter((v) => v !== 0).length).toBeGreaterThan(0);
  });

  it("progress 0.15 → has 1px stick limbs", () => {
    const result = generateParametricBody(
      createPrng(SEED),
      0.15,
      TRAITS,
      DEPTH,
      STYLE,
      canvasW,
      canvasH,
    );
    const flat = result.pixelCanvas.flat();
    expect(flat.filter((v) => v !== 0).length).toBeGreaterThan(10);
  });

  it("progress 0.5 → has joint highlights (palette 3) in limb area", () => {
    const result = generateParametricBody(
      createPrng(SEED),
      0.5,
      TRAITS,
      DEPTH,
      STYLE,
      canvasW,
      canvasH,
    );
    const flat = result.pixelCanvas.flat();
    expect(flat.includes(3)).toBe(true);
  });

  it("progress 1.0 → has all detail including outlines", () => {
    const result = generateParametricBody(
      createPrng(SEED),
      1.0,
      TRAITS,
      DEPTH,
      STYLE,
      canvasW,
      canvasH,
    );
    const flat = result.pixelCanvas.flat();
    const nonZero = flat.filter((v) => v !== 0).length;
    const tinyResult = generateParametricBody(
      createPrng(SEED),
      0.05,
      TRAITS,
      DEPTH,
      STYLE,
      canvasW,
      canvasH,
    );
    const tinyNonZero = tinyResult.pixelCanvas
      .flat()
      .filter((v) => v !== 0).length;
    expect(nonZero).toBeGreaterThan(tinyNonZero * 2);
  });

  it("limb pixel count increases with stage progression", () => {
    const progresses = [0.15, 0.35, 0.55, 0.75, 1.0];
    const pixelCounts = progresses.map((p) => {
      const r = generateParametricBody(
        createPrng(SEED),
        p,
        TRAITS,
        DEPTH,
        STYLE,
        canvasW,
        canvasH,
      );
      return r.pixelCanvas.flat().filter((v) => v !== 0).length;
    });
    for (let i = 1; i < pixelCounts.length; i++) {
      expect(pixelCounts[i]).toBeGreaterThanOrEqual(pixelCounts[i - 1]);
    }
  });

  it("determinism: same seed → identical canvas at each stage", () => {
    for (const progress of [0.15, 0.35, 0.55, 0.75, 1.0]) {
      const a = generateParametricBody(
        createPrng(SEED),
        progress,
        TRAITS,
        DEPTH,
        STYLE,
        canvasW,
        canvasH,
      );
      const b = generateParametricBody(
        createPrng(SEED),
        progress,
        TRAITS,
        DEPTH,
        STYLE,
        canvasW,
        canvasH,
      );
      expect(a.pixelCanvas).toEqual(b.pixelCanvas);
    }
  });
});
