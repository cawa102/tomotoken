// test/viewer/emissive-accents.test.ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { buildLegacyCreature } from "../../src/viewer/public/js/creature.js";

const TEST_PARAMS = {
  headRatio: 0.5, bodyWidthRatio: 0.5, roundness: 0.5, topHeavy: 0.5,
  eyeSize: 2, eyeSpacing: 0.5,
  hasEars: false, hasHorns: true, hasTail: false, hasWings: false,
  limbStage: 0, patternType: 0, patternDensity: 0,
  neckWidth: 0.5, legLength: 0.3, armLength: 0.3,
  tailLength: 0.4, wingSize: 0.5, earSize: 0.3, hornSize: 0.3,
  bodyTaper: 0.3, asymmetry: 0.1,
};

const TEST_PALETTE = [
  "#1a1a2e", "#222244", "#4488aa", "#55aacc",
  "#88ccee", "#ffffff", "#111111", "#ff6644",
];

describe("emissive accents", () => {
  it("horn materials have non-black emissive color with positive intensity", () => {
    // Stage 3+ for horns to appear
    const { group } = buildLegacyCreature(TEST_PARAMS, TEST_PALETTE, 3);
    const emissiveMaterials: THREE.MeshToonMaterial[] = [];
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && !child.userData.isOutline) {
        const mat = (child as THREE.Mesh).material as THREE.MeshToonMaterial;
        // Check for actual non-black emissive (not just default intensity)
        if (mat.emissive && mat.emissive.getHex() !== 0x000000 && mat.emissiveIntensity > 0) {
          emissiveMaterials.push(mat);
        }
      }
    });
    expect(emissiveMaterials.length).toBeGreaterThan(0);
  });
});
