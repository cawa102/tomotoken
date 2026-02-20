// test/viewer/creature-geometry.test.ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { buildLegacyCreature } from "../../src/viewer/public/js/creature.js";

const TEST_PARAMS = {
  headRatio: 0.5, bodyWidthRatio: 0.5, roundness: 0.5, topHeavy: 0.5,
  eyeSize: 2, eyeSpacing: 0.5,
  hasEars: false, hasHorns: false, hasTail: false, hasWings: false,
  limbStage: 0, patternType: 0, patternDensity: 0,
  neckWidth: 0.5, legLength: 0.3, armLength: 0.3,
  tailLength: 0.4, wingSize: 0.5, earSize: 0.3, hornSize: 0.3,
  bodyTaper: 0.3, asymmetry: 0.1,
};

const TEST_PALETTE = [
  "#1a1a2e", "#222244", "#4488aa", "#55aacc",
  "#88ccee", "#ffffff", "#111111", "#ff6644",
];

describe("creature geometry quality", () => {
  it("body sphere has at least 16 radial segments", () => {
    // Stage 1 creature with minimal features
    const { parts } = buildLegacyCreature(TEST_PARAMS, TEST_PALETTE, 1);
    const body = parts.body as THREE.Mesh;
    const geo = body.geometry as THREE.SphereGeometry;
    // SphereGeometry stores params in .parameters
    // widthSegments is the number of horizontal segments
    const params = geo.parameters;
    expect(params.widthSegments).toBeGreaterThanOrEqual(16);
  });

  it("head sphere has at least 16 radial segments", () => {
    const { parts } = buildLegacyCreature(TEST_PARAMS, TEST_PALETTE, 1);
    const head = parts.head as THREE.Mesh;
    const geo = head.geometry as THREE.SphereGeometry;
    expect(geo.parameters.widthSegments).toBeGreaterThanOrEqual(16);
  });
});
