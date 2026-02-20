// test/viewer/outline.test.ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { addOutlines } from "../../src/viewer/public/js/outline.js";

function createTestGroup(): THREE.Group {
  const group = new THREE.Group();
  const geo = new THREE.SphereGeometry(1, 8, 6);
  const mat = new THREE.MeshToonMaterial({ color: 0xff0000 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "body";
  group.add(mesh);

  const childGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const childMat = new THREE.MeshToonMaterial({ color: 0x00ff00 });
  const childMesh = new THREE.Mesh(childGeo, childMat);
  childMesh.name = "head";
  group.add(childMesh);

  return group;
}

function countMeshes(obj: THREE.Object3D): number {
  let count = 0;
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) count++;
  });
  return count;
}

describe("addOutlines", () => {
  it("adds outline meshes for each mesh in the group", () => {
    const group = createTestGroup();
    const meshCountBefore = countMeshes(group);
    addOutlines(group);
    const meshCountAfter = countMeshes(group);
    // Each original mesh gets one outline sibling
    expect(meshCountAfter).toBe(meshCountBefore * 2);
  });

  it("outline meshes are marked with userData.isOutline", () => {
    const group = createTestGroup();
    addOutlines(group);
    const outlines: THREE.Mesh[] = [];
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && child.userData.isOutline) {
        outlines.push(child as THREE.Mesh);
      }
    });
    expect(outlines.length).toBe(2); // body_outline + head_outline
  });

  it("outline meshes use BackSide rendering", () => {
    const group = createTestGroup();
    addOutlines(group);
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && child.userData.isOutline) {
        const mesh = child as THREE.Mesh;
        expect((mesh.material as THREE.ShaderMaterial).side).toBe(THREE.BackSide);
      }
    });
  });

  it("outline meshes do not cast shadows", () => {
    const group = createTestGroup();
    addOutlines(group);
    group.traverse((child) => {
      if (child.userData.isOutline) {
        expect(child.castShadow).toBe(false);
      }
    });
  });

  it("outline names follow pattern: {original}_outline", () => {
    const group = createTestGroup();
    addOutlines(group);
    const names: string[] = [];
    group.traverse((child) => {
      if (child.userData.isOutline) {
        names.push(child.name);
      }
    });
    expect(names).toContain("body_outline");
    expect(names).toContain("head_outline");
  });

  it("respects custom color and thickness options", () => {
    const group = createTestGroup();
    addOutlines(group, { color: 0xff0000, thickness: 0.05 });
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && child.userData.isOutline) {
        const mat = (child as THREE.Mesh).material as THREE.ShaderMaterial;
        expect(mat.uniforms.outlineThickness.value).toBe(0.05);
        expect(mat.uniforms.outlineColor.value.getHex()).toBe(0xff0000);
      }
    });
  });
});
