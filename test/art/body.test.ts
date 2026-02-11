import { describe, it, expect } from "vitest";
import { generateBody } from "../../src/art/body.js";
import { createPrng } from "../../src/utils/hash.js";

describe("generateBody", () => {
  it("generates canvas within bounds", () => {
    const prng = createPrng("abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234");
    const canvas = generateBody(prng, 0.5, "builder", 24, 12);
    expect(canvas.length).toBeLessThanOrEqual(12);
    for (const row of canvas) {
      expect(row.length).toBeLessThanOrEqual(24);
    }
  });

  it("grows larger with higher progress", () => {
    const prng1 = createPrng("aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111");
    const small = generateBody(prng1, 0.1, "builder", 24, 12);
    const prng2 = createPrng("aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111");
    const large = generateBody(prng2, 0.9, "builder", 24, 12);
    const smallChars = small.flat().join("").replace(/ /g, "").length;
    const largeChars = large.flat().join("").replace(/ /g, "").length;
    expect(largeChars).toBeGreaterThan(smallChars);
  });

  it("is deterministic", () => {
    const prng1 = createPrng("bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222");
    const a = generateBody(prng1, 0.5, "scholar", 24, 12);
    const prng2 = createPrng("bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222");
    const b = generateBody(prng2, 0.5, "scholar", 24, 12);
    expect(a).toEqual(b);
  });

  it("produces different shapes per archetype", () => {
    const prng1 = createPrng("cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333");
    const builder = generateBody(prng1, 0.5, "builder", 24, 12);
    const prng2 = createPrng("cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333");
    const scholar = generateBody(prng2, 0.5, "scholar", 24, 12);
    expect(builder).not.toEqual(scholar);
  });
});
