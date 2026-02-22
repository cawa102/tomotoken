import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockLoad } = vi.hoisted(() => ({ mockLoad: vi.fn() }));
vi.mock("three/addons/loaders/GLTFLoader.js", () => ({
  GLTFLoader: vi.fn().mockImplementation(() => ({
    load: mockLoad,
  })),
}));

import { loadEggModel, EGG_MODEL_PATH } from "../../src/viewer/public/js/egg-loader.js";

describe("egg-loader", () => {
  beforeEach(() => {
    mockLoad.mockReset();
  });

  describe("EGG_MODEL_PATH", () => {
    it("exports egg model base path", () => {
      expect(EGG_MODEL_PATH).toBe("./models/eggs/");
    });
  });

  describe("loadEggModel", () => {
    it("loads correct GLB for stage 0", async () => {
      const fakeGltf = { scene: { name: "EggScene" }, animations: [] };
      mockLoad.mockImplementation((_url, onLoad) => onLoad(fakeGltf));

      const result = await loadEggModel(0);

      expect(mockLoad.mock.calls[0][0]).toBe("./models/eggs/egg-stage-0.glb");
      expect(result).not.toBeNull();
      expect(result.scene).toBe(fakeGltf.scene);
    });

    it("loads correct GLB for stage 3", async () => {
      const fakeGltf = { scene: { name: "EggScene" }, animations: [] };
      mockLoad.mockImplementation((_url, onLoad) => onLoad(fakeGltf));

      const result = await loadEggModel(3);

      expect(mockLoad.mock.calls[0][0]).toBe("./models/eggs/egg-stage-3.glb");
    });

    it("returns null for stage 4 (hatched — not an egg)", async () => {
      const result = await loadEggModel(4);
      expect(result).toBeNull();
      expect(mockLoad).not.toHaveBeenCalled();
    });

    it("returns null for invalid stage", async () => {
      const result = await loadEggModel(-1);
      expect(result).toBeNull();
    });

    it("returns null when GLB load fails", async () => {
      mockLoad.mockImplementation((_url, _onLoad, _onProg, onError) => {
        onError(new Error("404"));
      });

      const result = await loadEggModel(0);
      expect(result).toBeNull();
    });
  });
});
