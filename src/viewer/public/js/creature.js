import * as THREE from "three";
import { createGradientMap } from "./toon-utils.js";
import { addOutlines } from "./outline.js";
import { loadModel } from "./model-loader.js";
import { applyPalette } from "./palette-apply.js";
import { createAnimMixer } from "./anim-mixer.js";

// --- Geometry factory for primitive strings ---
const TOON_SEGMENTS = 24;

function createGeometry(primitive, scale) {
  const [sx, sy, sz] = scale;
  let geo;

  switch (primitive) {
    case "sphere":
      geo = new THREE.SphereGeometry(0.5, TOON_SEGMENTS, TOON_SEGMENTS - 2);
      break;
    case "box":
      geo = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
      break;
    case "cylinder":
      geo = new THREE.CylinderGeometry(0.5, 0.5, 1, TOON_SEGMENTS);
      break;
    case "cone":
      geo = new THREE.ConeGeometry(0.5, 1, TOON_SEGMENTS);
      break;
    case "torus":
      geo = new THREE.TorusGeometry(0.35, 0.15, TOON_SEGMENTS, TOON_SEGMENTS);
      break;
    case "capsule":
      geo = new THREE.CapsuleGeometry(0.3, 0.4, 4, TOON_SEGMENTS);
      break;
    default:
      geo = new THREE.SphereGeometry(0.5, TOON_SEGMENTS, TOON_SEGMENTS - 2);
  }

  geo.scale(sx, sy, sz);
  return geo;
}

/**
 * Recursively build a Three.js Object3D from a part definition.
 */
function buildPart(partDef) {
  const { name, primitive, position, rotation, scale, color, material, children, animatable } = partDef;

  const geo = createGeometry(primitive, scale);
  const gradientMap = createGradientMap(3);
  const mat = new THREE.MeshToonMaterial({
    color: new THREE.Color(color),
    gradientMap,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = true;

  if (animatable) {
    mesh.userData.animatable = { ...animatable };
  }

  if (children && children.length > 0) {
    for (const childDef of children) {
      const childMesh = buildPart(childDef);
      mesh.add(childMesh);
    }
  }

  return mesh;
}

/**
 * Build a 3D creature from an LLM-generated CreatureDesign JSON.
 * Returns { group, parts } where parts is a flat map of named meshes.
 */
export function buildFromDesign(design) {
  const group = new THREE.Group();
  group.name = "creature";

  const parts = {};

  for (const partDef of design.parts) {
    const mesh = buildPart(partDef);
    group.add(mesh);
    parts[partDef.name] = mesh;

    // Collect named descendants for expression lookups
    mesh.traverse((child) => {
      if (child !== mesh && child.name) {
        parts[child.name] = child;
      }
    });
  }

  addOutlines(group);
  return { group, parts };
}

/**
 * Build a 3D creature from a pre-made glTF model.
 * Returns { group, parts } or null if the model cannot be loaded.
 */
export async function buildFromModel(archetype, palette) {
  const result = await loadModel(archetype);
  if (!result) {
    return null;
  }

  const group = result.scene;
  group.name = "creature";
  group.userData.isGltfModel = true;

  if (palette) {
    applyPalette(group, palette);
  }

  const parts = {};
  group.traverse((child) => {
    if (child !== group && child.name) {
      parts[child.name] = child;
    }
  });

  let mixer = null;
  let actions = null;
  if (result.animations && result.animations.length > 0) {
    const anim = createAnimMixer(group, result.animations);
    mixer = anim.mixer;
    actions = anim.actions;
  }

  return { group, parts, mixer, actions };
}

/**
 * Remove existing creature from scene and dispose of geometries/materials/textures.
 */
export function disposeCreature(scene) {
  const existing = scene.getObjectByName("creature");
  if (existing) {
    existing.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose();
        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        for (const mat of materials) {
          if (!mat) continue;
          // Dispose textures referenced by material properties
          for (const value of Object.values(mat)) {
            if (value && value.isTexture) {
              value.dispose();
            }
          }
          mat.dispose();
        }
      }
    });
    scene.remove(existing);
  }
}
