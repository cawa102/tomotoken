// test/viewer/toon-utils.test.ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";

// Importing vanilla JS module from viewer public dir
import { createGradientMap, createToonMaterial } from "../../src/viewer/public/js/toon-utils.js";

describe("createGradientMap", () => {
  it("returns a DataTexture with correct dimensions for 3 steps", () => {
    const texture = createGradientMap(3);
    expect(texture).toBeInstanceOf(THREE.DataTexture);
    expect(texture.image.width).toBe(3);
    expect(texture.image.height).toBe(1);
  });

  it("generates correct gradient values for 3 steps", () => {
    const texture = createGradientMap(3);
    const data = texture.image.data;
    // 3 steps: [0, 128, 255] (0/2*255=0, 1/2*255=128, 2/2*255=255)
    expect(data[0]).toBe(0);
    expect(data[1]).toBe(128);
    expect(data[2]).toBe(255);
  });

  it("generates 2-step gradient (default toon look)", () => {
    const texture = createGradientMap(2);
    const data = texture.image.data;
    expect(data[0]).toBe(0);
    expect(data[1]).toBe(255);
  });

  it("defaults to 3 steps when no argument given", () => {
    const texture = createGradientMap();
    expect(texture.image.width).toBe(3);
  });

  it("marks texture as needsUpdate (version incremented)", () => {
    const texture = createGradientMap(3);
    // needsUpdate is a setter-only in three.js that increments version
    expect(texture.version).toBeGreaterThan(0);
  });
});

describe("createToonMaterial", () => {
  it("returns a MeshToonMaterial", () => {
    const mat = createToonMaterial({ color: 0xff0000 });
    expect(mat).toBeInstanceOf(THREE.MeshToonMaterial);
  });

  it("sets the specified color", () => {
    const mat = createToonMaterial({ color: 0xff0000 });
    expect(mat.color.getHex()).toBe(0xff0000);
  });

  it("uses provided gradientMap", () => {
    const gm = createGradientMap(4);
    const mat = createToonMaterial({ color: 0x00ff00, gradientMap: gm });
    expect(mat.gradientMap).toBe(gm);
  });

  it("creates default 3-step gradientMap when none provided", () => {
    const mat = createToonMaterial({ color: 0x0000ff });
    expect(mat.gradientMap).toBeDefined();
    expect(mat.gradientMap.image.width).toBe(3);
  });
});
