import * as THREE from "three";

export const COLOR_ROLE_PREFIX = "cr_";

const ROLE_TO_INDEX = {
  body: 0,
  accent: 1,
  detail: 2,
  eye: 3,
  eyewhite: 4,
  mouth: 5,
  accessory: 6,
  highlight: 7,
};

/**
 * Apply palette colors to a group's meshes based on naming convention.
 * Meshes named cr_{role}_{part} receive palette[ROLE_TO_INDEX[role]].
 * @param {THREE.Group} group - Root group to traverse
 * @param {string[]} palette - Array of 8 hex color strings
 */
export function applyPalette(group, palette) {
  group.traverse((child) => {
    if (!child.isMesh) return;
    if (!child.name.startsWith(COLOR_ROLE_PREFIX)) return;

    const withoutPrefix = child.name.slice(COLOR_ROLE_PREFIX.length);
    const underscoreIdx = withoutPrefix.indexOf("_");
    const role = underscoreIdx === -1 ? withoutPrefix : withoutPrefix.slice(0, underscoreIdx);

    const index = ROLE_TO_INDEX[role];
    if (index === undefined) return;

    const color = palette[index];
    if (color === undefined) return;

    const material = child.material;
    if (material && material.color) {
      material.color.set(color);
    }
  });
}
