// test/viewer/creature-model-loading.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as THREE from "three";

// Mock model-loader module
const { mockLoadModel } = vi.hoisted(() => ({ mockLoadModel: vi.fn() }));
vi.mock("../../src/viewer/public/js/model-loader.js", () => ({
  loadModel: mockLoadModel,
}));

// Mock outline module (uses WebGL internals)
vi.mock("../../src/viewer/public/js/outline.js", () => ({
  addOutlines: vi.fn(),
}));

import { buildFromModel } from "../../src/viewer/public/js/creature.js";

describe("buildFromModel", () => {
  beforeEach(() => {
    mockLoadModel.mockReset();
  });

  it("returns loaded model scene as group with parts map", async () => {
    const childA = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    childA.name = "body";
    const childB = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    childB.name = "head";

    const fakeScene = new THREE.Group();
    fakeScene.add(childA);
    fakeScene.add(childB);

    mockLoadModel.mockResolvedValue({ scene: fakeScene, animations: [] });

    const result = await buildFromModel("explorer");

    expect(result).not.toBeNull();
    expect(result!.group.name).toBe("creature");
    expect(result!.parts.body).toBe(childA);
    expect(result!.parts.head).toBe(childB);
  });

  it("returns null when loadModel returns null", async () => {
    mockLoadModel.mockResolvedValue(null);

    const result = await buildFromModel("nonexistent");

    expect(result).toBeNull();
  });

  it("builds parts map by traversing nested children", async () => {
    const parent = new THREE.Group();
    parent.name = "torso";
    const nested = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    nested.name = "spine";
    parent.add(nested);

    const fakeScene = new THREE.Group();
    fakeScene.add(parent);

    mockLoadModel.mockResolvedValue({ scene: fakeScene, animations: [] });

    const result = await buildFromModel("builder");

    expect(result!.parts.torso).toBe(parent);
    expect(result!.parts.spine).toBe(nested);
  });
});
