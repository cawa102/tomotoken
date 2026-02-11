import { describe, it, expect } from "vitest";
import { generateSeed } from "../../src/art/seed.js";

describe("generateSeed", () => {
  it("returns a 64-char hex string", () => {
    const seed = generateSeed("machine-1", "pet-abc");
    expect(seed).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for same inputs", () => {
    const a = generateSeed("m1", "p1");
    const b = generateSeed("m1", "p1");
    expect(a).toBe(b);
  });

  it("differs for different inputs", () => {
    const a = generateSeed("m1", "p1");
    const b = generateSeed("m1", "p2");
    expect(a).not.toBe(b);
  });
});
