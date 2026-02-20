// test/viewer/morph-expression.test.ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  MORPH_NAMES,
  applyMorphExpression,
} from "../../src/viewer/public/js/morph-expression.js";

function makeMorphMesh(morphNames: string[]): THREE.Mesh {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshToonMaterial();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "cr_body_face";

  // Set up morph targets manually
  mesh.morphTargetDictionary = {};
  mesh.morphTargetInfluences = [];
  morphNames.forEach((name, i) => {
    mesh.morphTargetDictionary![name] = i;
    mesh.morphTargetInfluences!.push(0);
  });

  return mesh;
}

describe("morph-expression", () => {
  it("exports standard MORPH_NAMES", () => {
    expect(MORPH_NAMES).toEqual([
      "happy",
      "sleepy",
      "excited",
      "focused",
      "surprised",
      "sad",
    ]);
  });

  it("sets morph target influence for matching expression", () => {
    const group = new THREE.Group();
    const mesh = makeMorphMesh(["happy", "sleepy", "excited"]);
    group.add(mesh);

    applyMorphExpression(group, "happy");

    expect(mesh.morphTargetInfluences![0]).toBe(1); // happy
    expect(mesh.morphTargetInfluences![1]).toBe(0); // sleepy
    expect(mesh.morphTargetInfluences![2]).toBe(0); // excited
  });

  it("sets correct morph for non-first expression", () => {
    const group = new THREE.Group();
    const mesh = makeMorphMesh(["happy", "sleepy", "excited"]);
    group.add(mesh);

    applyMorphExpression(group, "sleepy");

    expect(mesh.morphTargetInfluences![0]).toBe(0); // happy
    expect(mesh.morphTargetInfluences![1]).toBe(1); // sleepy
    expect(mesh.morphTargetInfluences![2]).toBe(0); // excited
  });

  it("resets all morph targets when expression is 'default'", () => {
    const group = new THREE.Group();
    const mesh = makeMorphMesh(["happy", "sleepy", "excited"]);
    // Pre-set some influences
    mesh.morphTargetInfluences![0] = 1;
    mesh.morphTargetInfluences![2] = 0.5;
    group.add(mesh);

    applyMorphExpression(group, "default");

    expect(mesh.morphTargetInfluences![0]).toBe(0);
    expect(mesh.morphTargetInfluences![1]).toBe(0);
    expect(mesh.morphTargetInfluences![2]).toBe(0);
  });

  it("does nothing for meshes without morph targets", () => {
    const group = new THREE.Group();
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshToonMaterial();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = "cr_body_torso";
    group.add(mesh);

    // Should not throw
    expect(() => applyMorphExpression(group, "happy")).not.toThrow();
  });

  it("traverses nested children for morph targets", () => {
    const group = new THREE.Group();
    const nested = new THREE.Group();
    const mesh = makeMorphMesh(["happy", "sad"]);
    nested.add(mesh);
    group.add(nested);

    applyMorphExpression(group, "sad");

    expect(mesh.morphTargetInfluences![0]).toBe(0); // happy
    expect(mesh.morphTargetInfluences![1]).toBe(1); // sad
  });

  it("handles expression not in dictionary gracefully (resets all)", () => {
    const group = new THREE.Group();
    const mesh = makeMorphMesh(["happy", "sleepy"]);
    mesh.morphTargetInfluences![0] = 1;
    group.add(mesh);

    applyMorphExpression(group, "nonexistent");

    // All influences should be reset to 0
    expect(mesh.morphTargetInfluences![0]).toBe(0);
    expect(mesh.morphTargetInfluences![1]).toBe(0);
  });
});
