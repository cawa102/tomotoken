import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export const EGG_MODEL_PATH = "./models/eggs/";

const loader = new GLTFLoader();

/**
 * Load egg GLB model for the given stage (0-3).
 * Returns null for stage >= 4 (hatched) or on load failure.
 */
export async function loadEggModel(stage) {
  if (stage < 0 || stage > 3) return null;

  const url = `${EGG_MODEL_PATH}egg-stage-${stage}.glb`;

  return new Promise((resolve) => {
    loader.load(
      url,
      (gltf) => resolve({ scene: gltf.scene, animations: gltf.animations }),
      undefined,
      () => resolve(null),
    );
  });
}
