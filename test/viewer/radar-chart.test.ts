import { describe, it, expect } from "vitest";
import { computeRadarPoints } from "../../src/viewer/public/js/radar-chart.js";

describe("computeRadarPoints", () => {
  const TRAIT_KEYS = [
    "builder", "fixer", "refiner", "scholar",
    "scribe", "architect", "operator", "guardian",
  ];

  it("returns 8 points for 8 traits", () => {
    const traits: Record<string, number> = Object.fromEntries(
      TRAIT_KEYS.map((k) => [k, 50]),
    );
    const points = computeRadarPoints(traits, 80);
    expect(points).toHaveLength(8);
  });

  it("all-zero traits returns points at center", () => {
    const traits: Record<string, number> = Object.fromEntries(
      TRAIT_KEYS.map((k) => [k, 0]),
    );
    const points = computeRadarPoints(traits, 80);
    for (const p of points) {
      expect(p.x).toBeCloseTo(0, 1);
      expect(p.y).toBeCloseTo(0, 1);
    }
  });

  it("max traits returns points at radius", () => {
    const traits: Record<string, number> = Object.fromEntries(
      TRAIT_KEYS.map((k) => [k, 100]),
    );
    const points = computeRadarPoints(traits, 80);
    for (const p of points) {
      const dist = Math.sqrt(p.x * p.x + p.y * p.y);
      expect(dist).toBeCloseTo(80, 0);
    }
  });

  it("handles missing traits gracefully", () => {
    const points = computeRadarPoints({ builder: 50 }, 80);
    expect(points).toHaveLength(8);
  });

  it("normalizes by max trait so dominant reaches full radius", () => {
    const traits: Record<string, number> = Object.fromEntries(
      TRAIT_KEYS.map((k) => [k, 0]),
    );
    traits["operator"] = 30;
    traits["scholar"] = 15;
    const points = computeRadarPoints(traits, 80);
    // operator (index 6) should reach full radius
    const opDist = Math.sqrt(points[6].x ** 2 + points[6].y ** 2);
    expect(opDist).toBeCloseTo(80, 0);
    // scholar (index 3) should be at half radius
    const scDist = Math.sqrt(points[3].x ** 2 + points[3].y ** 2);
    expect(scDist).toBeCloseTo(40, 0);
  });
});
