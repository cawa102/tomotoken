// test/viewer/model-loader.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock GLTFLoader before importing the module
const { mockLoad } = vi.hoisted(() => ({ mockLoad: vi.fn() }));
vi.mock("three/addons/loaders/GLTFLoader.js", () => ({
  GLTFLoader: vi.fn().mockImplementation(() => ({
    load: mockLoad,
  })),
}));

import { MODEL_BASE_PATH, loadModel } from "../../src/viewer/public/js/model-loader.js";

describe("model-loader", () => {
  beforeEach(() => {
    mockLoad.mockReset();
  });

  describe("MODEL_BASE_PATH", () => {
    it("exports './models/' as the base path", () => {
      expect(MODEL_BASE_PATH).toBe("./models/");
    });
  });

  describe("loadModel", () => {
    it("resolves model path from archetype name", async () => {
      const fakeGltf = {
        scene: { name: "Scene" },
        animations: [{ name: "idle" }],
      };
      mockLoad.mockImplementation((_url: string, onLoad: (gltf: unknown) => void) => {
        onLoad(fakeGltf);
      });

      const result = await loadModel("explorer");

      expect(mockLoad).toHaveBeenCalledOnce();
      const calledUrl = mockLoad.mock.calls[0][0];
      expect(calledUrl).toBe("./models/explorer.glb");
      expect(result).toEqual({ scene: fakeGltf.scene, animations: fakeGltf.animations });
    });

    it("returns null when model file not found", async () => {
      mockLoad.mockImplementation(
        (_url: string, _onLoad: unknown, _onProgress: unknown, onError: (err: Error) => void) => {
          onError(new Error("404 Not Found"));
        },
      );

      const result = await loadModel("nonexistent");

      expect(result).toBeNull();
    });

    it("returns null for empty archetype string", async () => {
      const result = await loadModel("");

      expect(result).toBeNull();
      expect(mockLoad).not.toHaveBeenCalled();
    });
  });
});
