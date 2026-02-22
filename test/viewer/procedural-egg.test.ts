import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  hashString,
  createEggGeometry,
  createProceduralEgg,
} from "../../src/viewer/public/js/procedural-egg.js";

describe("hashString", () => {
  it("returns a number in [0, 1)", () => {
    const h = hashString("abc-123");
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(1);
  });

  it("is deterministic — same input gives same output", () => {
    expect(hashString("pet-xyz")).toBe(hashString("pet-xyz"));
  });

  it("produces different values for different inputs", () => {
    expect(hashString("pet-a")).not.toBe(hashString("pet-b"));
  });

  it("handles empty string", () => {
    const h = hashString("");
    expect(h).toBe(0);
  });
});

describe("createEggGeometry", () => {
  it("returns a BufferGeometry", () => {
    const geo = createEggGeometry();
    expect(geo).toBeInstanceOf(THREE.BufferGeometry);
    geo.dispose();
  });

  it("has position, normal, and uv attributes", () => {
    const geo = createEggGeometry();
    expect(geo.attributes.position).toBeDefined();
    expect(geo.attributes.normal).toBeDefined();
    expect(geo.attributes.uv).toBeDefined();
    geo.dispose();
  });

  it("bottom vertex is at y ≈ 0", () => {
    const geo = createEggGeometry();
    const pos = geo.attributes.position;
    let minY = Infinity;
    for (let i = 0; i < pos.count; i++) {
      minY = Math.min(minY, pos.getY(i));
    }
    expect(minY).toBeCloseTo(0, 1);
    geo.dispose();
  });

  it("top vertex is at y ≈ 1.3", () => {
    const geo = createEggGeometry();
    const pos = geo.attributes.position;
    let maxY = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      maxY = Math.max(maxY, pos.getY(i));
    }
    expect(maxY).toBeCloseTo(1.3, 1);
    geo.dispose();
  });

  it("is wider in the middle than at the top", () => {
    const geo = createEggGeometry();
    const pos = geo.attributes.position;
    let maxRadiusMid = 0;
    let maxRadiusTop = 0;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const r = Math.sqrt(pos.getX(i) ** 2 + pos.getZ(i) ** 2);
      if (y > 0.4 && y < 0.7) maxRadiusMid = Math.max(maxRadiusMid, r);
      if (y > 1.1) maxRadiusTop = Math.max(maxRadiusTop, r);
    }
    expect(maxRadiusMid).toBeGreaterThan(maxRadiusTop);
    geo.dispose();
  });
});

describe("createProceduralEgg", () => {
  it("returns a Group with isEgg flag", () => {
    const group = createProceduralEgg(0, "pet-abc");
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.userData.isEgg).toBe(true);
    expect(group.name).toBe("creature");
  });

  it("contains a Mesh child with ShaderMaterial", () => {
    const group = createProceduralEgg(2, "pet-xyz");
    const mesh = group.children[0];
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.material).toBeInstanceOf(THREE.ShaderMaterial);
  });

  it("passes seed and stage as uniforms", () => {
    const group = createProceduralEgg(3, "pet-test");
    const mat = group.children[0].material;
    expect(mat.uniforms.seed.value).toBeGreaterThan(0);
    expect(mat.uniforms.stage.value).toBe(3);
  });

  it("clamps stage to 0-3 range", () => {
    const gNeg = createProceduralEgg(-1, "a");
    expect(gNeg.children[0].material.uniforms.stage.value).toBe(0);
    const gHigh = createProceduralEgg(5, "b");
    expect(gHigh.children[0].material.uniforms.stage.value).toBe(3);
  });

  it("different petIds produce different seeds", () => {
    const g1 = createProceduralEgg(0, "pet-alpha");
    const g2 = createProceduralEgg(0, "pet-beta");
    const s1 = g1.children[0].material.uniforms.seed.value;
    const s2 = g2.children[0].material.uniforms.seed.value;
    expect(s1).not.toBe(s2);
  });
});
