import { describe, it, expect } from "vitest";
import { buildRenderData } from "../../src/sidecar/render-data.js";
import { createPrng } from "../../src/utils/hash.js";
import { deriveCreatureParams, adjustParamsForProgress, generatePalette, paletteToHexArray } from "../../src/art/parametric/index.js";
import type { AppState, DepthMetrics, StyleMetrics } from "../../src/store/types.js";

/**
 * This test verifies that buildRenderData produces identical CreatureParams
 * and palette as the existing generateParametricBody pipeline.
 *
 * If this test breaks, someone changed the PRNG call order in one of the
 * pipelines without updating the other.
 */
describe("PRNG parity: buildRenderData vs generateParametricBody", () => {
  const seed = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

  const traits: Record<string, number> = {
    builder: 50, fixer: 30, refiner: 20, scholar: 40,
    scribe: 10, architect: 60, operator: 25, guardian: 35,
  };
  const depth: DepthMetrics = {
    editTestLoopCount: 5, repeatEditSameFileCount: 2,
    phaseSwitchCount: 3, totalSessions: 10,
  };
  const style: StyleMetrics = {
    bulletRatio: 0.3, questionRatio: 0.1, codeblockRatio: 0.4,
    avgMessageLen: 120, messageLenStd: 40, headingRatio: 0.2,
  };

  const state: AppState = {
    version: 2,
    calibration: { t0: 10000, monthlyEstimate: 50000, calibratedAt: "2026-01-01T00:00:00Z" },
    spawnIndexCurrentMonth: 0,
    currentMonth: "2026-01",
    currentPet: {
      petId: "test-pet-parity",
      spawnedAt: "2026-01-15T00:00:00Z",
      requiredTokens: 10000,
      consumedTokens: 5000,
      spawnIndex: 0,
      personalitySnapshot: { usageMix: {}, depthMetrics: depth, styleMetrics: style, traits },
      generatedDesigns: null,
    },
    ingestionState: { files: {} },
    globalStats: { totalTokensAllTime: 50000, totalSessionsIngested: 10, earliestTimestamp: "2026-01-01", latestTimestamp: "2026-01-20" },
    lastEncouragementShownAt: null,
  };

  it("produces identical creatureParams as the parametric pipeline", () => {
    const renderData = buildRenderData(state, seed);

    // Reproduce the pipeline independently
    const prng = createPrng(seed);
    const rawParams = deriveCreatureParams(traits, depth, style, prng);
    const progress = 5000 / 10000; // consumed / required
    const expectedParams = adjustParamsForProgress(rawParams, progress);

    expect(renderData.creatureParams).toEqual(expectedParams);
  });

  it("produces identical palette hex values as the parametric pipeline", () => {
    const renderData = buildRenderData(state, seed);

    // Reproduce the pipeline: PRNG consumed by deriveCreatureParams first, then generatePalette
    const prng = createPrng(seed);
    deriveCreatureParams(traits, depth, style, prng); // consume PRNG calls
    const palette = generatePalette(traits, depth, style, prng);
    const expectedHex = paletteToHexArray(palette);

    expect(renderData.palette).toEqual(expectedHex);
  });
});
