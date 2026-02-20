import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export const MODEL_BASE_PATH = "./models/";

const loader = new GLTFLoader();

/**
 * Load a glTF/glb model for the given archetype.
 * Returns { scene, animations } on success, or null on failure.
 */
export function loadModel(archetype) {
  if (!archetype) {
    return Promise.resolve(null);
  }

  const url = `${MODEL_BASE_PATH}${archetype}.glb`;

  return new Promise((resolve) => {
    loader.load(
      url,
      (gltf) => resolve({ scene: gltf.scene, animations: gltf.animations }),
      undefined,
      () => resolve(null),
    );
  });
}
