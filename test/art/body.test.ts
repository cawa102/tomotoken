import { describe, it, expect } from "vitest";
import { generateBody } from "../../src/art/body.js";
import { createPrng } from "../../src/utils/hash.js";
import type { DepthMetrics, StyleMetrics } from "../../src/store/types.js";

const DEPTH: DepthMetrics = { editTestLoopCount: 5, repeatEditSameFileCount: 3, phaseSwitchCount: 10, totalSessions: 5 };
const STYLE: StyleMetrics = { bulletRatio: 0.3, questionRatio: 0.02, codeblockRatio: 0.1, avgMessageLen: 200, messageLenStd: 50, headingRatio: 0.05 };

const BUILDER_TRAITS = { builder: 50, fixer: 20, refiner: 10, scholar: 10, scribe: 5, architect: 5, operator: 0, guardian: 0 };
const SCHOLAR_TRAITS = { builder: 10, fixer: 5, refiner: 5, scholar: 50, scribe: 20, architect: 5, operator: 3, guardian: 2 };

describe("generateBody", () => {
  it("generates pixel canvas within bounds", () => {
    const prng = createPrng("abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234");
    const result = generateBody(prng, 0.5, BUILDER_TRAITS, DEPTH, STYLE, 32, 16);

    // pixelCanvas should be 32 rows tall (16 text rows * 2)
    expect(result.pixelCanvas.length).toBe(32);
    for (const row of result.pixelCanvas) {
      expect(row.length).toBe(32);
    }
  });

  it("grows larger with higher progress (more filled pixels)", () => {
    const prng1 = createPrng("aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111");
    const small = generateBody(prng1, 0.1, BUILDER_TRAITS, DEPTH, STYLE, 32, 16);
    const prng2 = createPrng("aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111");
    const large = generateBody(prng2, 0.9, BUILDER_TRAITS, DEPTH, STYLE, 32, 16);

    const countFilled = (canvas: readonly (readonly number[])[]) =>
      canvas.flat().filter((v) => v > 0).length;

    expect(countFilled(large.pixelCanvas)).toBeGreaterThan(countFilled(small.pixelCanvas));
  });

  it("is deterministic", () => {
    const prng1 = createPrng("bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222");
    const a = generateBody(prng1, 0.5, SCHOLAR_TRAITS, DEPTH, STYLE, 32, 16);
    const prng2 = createPrng("bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222");
    const b = generateBody(prng2, 0.5, SCHOLAR_TRAITS, DEPTH, STYLE, 32, 16);
    expect(a.pixelCanvas).toEqual(b.pixelCanvas);
  });

  it("produces different shapes per trait profile", () => {
    const prng1 = createPrng("cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333");
    const builder = generateBody(prng1, 0.5, BUILDER_TRAITS, DEPTH, STYLE, 32, 16);
    const prng2 = createPrng("cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333");
    const scholar = generateBody(prng2, 0.5, SCHOLAR_TRAITS, DEPTH, STYLE, 32, 16);
    expect(builder.pixelCanvas).not.toEqual(scholar.pixelCanvas);
  });

  it("returns animation hints", () => {
    const prng = createPrng("dddd4444dddd4444dddd4444dddd4444dddd4444dddd4444dddd4444dddd4444");
    const result = generateBody(prng, 0.9, BUILDER_TRAITS, DEPTH, STYLE, 32, 16);
    expect(result.animationHints).toBeDefined();
    expect(result.animationHints.eyePositions).toBeDefined();
    expect(result.animationHints.gesturePixels).toBeDefined();
    expect(result.animationHints.shimmerPixels).toBeDefined();
  });

  it("returns a palette with colors", () => {
    const prng = createPrng("eeee5555eeee5555eeee5555eeee5555eeee5555eeee5555eeee5555eeee5555");
    const result = generateBody(prng, 0.5, BUILDER_TRAITS, DEPTH, STYLE, 32, 16);
    expect(result.palette.colors.length).toBeGreaterThanOrEqual(10);
  });
});
