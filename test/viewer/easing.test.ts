// test/viewer/easing.test.ts
import { describe, it, expect } from "vitest";
import { easeInOutCubic } from "../../src/viewer/public/js/animation.js";

describe("easeInOutCubic", () => {
  it("returns 0 at t=0", () => {
    expect(easeInOutCubic(0)).toBeCloseTo(0);
  });

  it("returns 1 at t=1", () => {
    expect(easeInOutCubic(1)).toBeCloseTo(1);
  });

  it("returns 0.5 at t=0.5 (symmetric midpoint)", () => {
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
  });

  it("starts slow (value < t for small t)", () => {
    expect(easeInOutCubic(0.2)).toBeLessThan(0.2);
  });

  it("ends slow (value > t for large t)", () => {
    expect(easeInOutCubic(0.8)).toBeGreaterThan(0.8);
  });
});
