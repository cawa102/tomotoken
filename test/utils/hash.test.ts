import { describe, it, expect } from "vitest";
import { sha256, mulberry32, createPrng } from "../../src/utils/hash.js";

describe("sha256", () => {
  it("produces 64-char hex", () => {
    expect(sha256("test")).toMatch(/^[0-9a-f]{64}$/);
  });
  it("is deterministic", () => {
    expect(sha256("abc")).toBe(sha256("abc"));
  });
});

describe("mulberry32", () => {
  it("produces values in [0, 1)", () => {
    const prng = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = prng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it("is deterministic", () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    for (let i = 0; i < 10; i++) expect(a()).toBe(b());
  });
});
