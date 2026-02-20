// test/viewer/eye-highlight.test.ts
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

describe("eye highlights", () => {
  it("each eye group contains a highlight mesh with MeshBasicMaterial", () => {
    const { parts } = buildLegacyCreature(TEST_PARAMS, TEST_PALETTE, 1);
    const leftEye = parts.leftEye as THREE.Group;
    const rightEye = parts.rightEye as THREE.Group;

    const findHighlight = (eyeGroup: THREE.Group) => {
      let found: THREE.Mesh | null = null;
      eyeGroup.traverse((child) => {
        if (child.name === "eye_highlight" && (child as THREE.Mesh).isMesh) {
          found = child as THREE.Mesh;
        }
      });
      return found;
    };

    const leftHighlight = findHighlight(leftEye);
    const rightHighlight = findHighlight(rightEye);

    expect(leftHighlight).not.toBeNull();
    expect(rightHighlight).not.toBeNull();
    expect(leftHighlight!.material.type).toBe("MeshBasicMaterial");
    expect((leftHighlight!.material as THREE.MeshBasicMaterial).color.getHex()).toBe(0xffffff);
  });
});
