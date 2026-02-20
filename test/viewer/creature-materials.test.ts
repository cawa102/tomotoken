// test/viewer/creature-materials.test.ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { buildLegacyCreature } from "../../src/viewer/public/js/creature.js";

// Minimal CreatureParams for testing (stage 1+ body with all features)
const TEST_PARAMS = {
  headRatio: 0.5,
  bodyWidthRatio: 0.5,
  roundness: 0.5,
  topHeavy: 0.5,
  eyeSize: 2,
  eyeSpacing: 0.5,
  hasEars: true,
  hasHorns: true,
  hasTail: true,
  hasWings: true,
  limbStage: 4,
  patternType: 1,
  patternDensity: 0.5,
  neckWidth: 0.5,
  legLength: 0.3,
  armLength: 0.3,
  tailLength: 0.4,
  wingSize: 0.5,
  earSize: 0.3,
  hornSize: 0.3,
  bodyTaper: 0.3,
  asymmetry: 0.1,
};

const TEST_PALETTE = [
  "#1a1a2e", "#222244", "#4488aa", "#55aacc",
  "#88ccee", "#ffffff", "#111111", "#ff6644",
];

describe("creature materials after toon migration", () => {
  it("buildLegacyCreature stage 4 uses only MeshToonMaterial (except eye highlights)", () => {
    const { group } = buildLegacyCreature(TEST_PARAMS, TEST_PALETTE, 4);
    const materials: THREE.Material[] = [];
    group.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          materials.push(...mesh.material);
        } else {
          materials.push(mesh.material);
        }
      }
    });

    // All materials should be MeshToonMaterial (no MeshStandardMaterial)
    const standardMats = materials.filter((m) => m.type === "MeshStandardMaterial");
    expect(standardMats).toHaveLength(0);

    const toonMats = materials.filter((m) => m.type === "MeshToonMaterial");
    expect(toonMats.length).toBeGreaterThan(0);
  });

  it("egg (stage 0) also uses MeshToonMaterial", () => {
    const { group } = buildLegacyCreature(TEST_PARAMS, TEST_PALETTE, 0);
    const materials: THREE.Material[] = [];
    group.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        materials.push(
          ...(Array.isArray(mesh.material) ? mesh.material : [mesh.material]),
        );
      }
    });
    const standardMats = materials.filter((m) => m.type === "MeshStandardMaterial");
    expect(standardMats).toHaveLength(0);
  });
});
