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

// Mock palette-apply module
const { mockApplyPalette } = vi.hoisted(() => ({ mockApplyPalette: vi.fn() }));
vi.mock("../../src/viewer/public/js/palette-apply.js", () => ({
  applyPalette: mockApplyPalette,
}));

// Mock anim-mixer module
const { mockCreateAnimMixer } = vi.hoisted(() => ({
  mockCreateAnimMixer: vi.fn(() => ({ mixer: { update: vi.fn() }, actions: {} })),
}));
vi.mock("../../src/viewer/public/js/anim-mixer.js", () => ({
  createAnimMixer: mockCreateAnimMixer,
}));

import { buildFromModel } from "../../src/viewer/public/js/creature.js";

describe("buildFromModel", () => {
  beforeEach(() => {
    mockLoadModel.mockReset();
    mockApplyPalette.mockReset();
    mockCreateAnimMixer.mockClear();
    mockCreateAnimMixer.mockReturnValue({ mixer: { update: vi.fn() }, actions: {} });
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

  it("sets isGltfModel flag on loaded group", async () => {
    const fakeScene = new THREE.Group();
    mockLoadModel.mockResolvedValue({ scene: fakeScene, animations: [] });

    const result = await buildFromModel("explorer");

    expect(result!.group.userData.isGltfModel).toBe(true);
  });

  it("applies palette colors to loaded model when palette provided", async () => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshStandardMaterial({ color: 0xffffff }),
    );
    mesh.name = "cr_body_torso";

    const fakeScene = new THREE.Group();
    fakeScene.add(mesh);

    mockLoadModel.mockResolvedValue({ scene: fakeScene, animations: [] });

    const palette = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ffffff", "#000000", "#888888", "#ff8800"];
    const result = await buildFromModel("explorer", palette);

    expect(result).not.toBeNull();
    expect(mockApplyPalette).toHaveBeenCalledOnce();
    expect(mockApplyPalette).toHaveBeenCalledWith(result!.group, palette);
  });

  it("does not call applyPalette when no palette provided", async () => {
    const fakeScene = new THREE.Group();
    mockLoadModel.mockResolvedValue({ scene: fakeScene, animations: [] });

    await buildFromModel("explorer");

    expect(mockApplyPalette).not.toHaveBeenCalled();
  });

  it("creates animation mixer from loaded animations", async () => {
    const fakeScene = new THREE.Group();
    const fakeClip = new THREE.AnimationClip("idle", 1, []);
    const fakeMixer = { update: vi.fn() };
    const fakeActions = { idle: {} };
    mockCreateAnimMixer.mockReturnValue({ mixer: fakeMixer, actions: fakeActions });
    mockLoadModel.mockResolvedValue({ scene: fakeScene, animations: [fakeClip] });

    const result = await buildFromModel("explorer");

    expect(mockCreateAnimMixer).toHaveBeenCalledOnce();
    expect(mockCreateAnimMixer).toHaveBeenCalledWith(result!.group, [fakeClip]);
    expect(result!.mixer).toBe(fakeMixer);
    expect(result!.actions).toBe(fakeActions);
  });

  it("returns null mixer and actions when no animations", async () => {
    const fakeScene = new THREE.Group();
    mockLoadModel.mockResolvedValue({ scene: fakeScene, animations: [] });

    const result = await buildFromModel("explorer");

    expect(mockCreateAnimMixer).not.toHaveBeenCalled();
    expect(result!.mixer).toBeNull();
    expect(result!.actions).toBeNull();
  });
});
