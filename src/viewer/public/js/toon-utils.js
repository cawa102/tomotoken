// src/viewer/public/js/toon-utils.js
import * as THREE from "three";

/**
 * Create a gradient map DataTexture for MeshToonMaterial.
 * Controls the number of shading steps in cel-shading.
 *
 * @param {number} steps - Number of shading steps (2-5). Default 3.
 * @returns {THREE.DataTexture}
 */
export function createGradientMap(steps = 3) {
  const colors = new Uint8Array(steps);
  for (let i = 0; i < steps; i++) {
    colors[i] = Math.round((i / (steps - 1)) * 255);
  }
  const texture = new THREE.DataTexture(colors, steps, 1, THREE.RedFormat);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Create a MeshToonMaterial with consistent toon settings.
 *
 * @param {Object} opts
 * @param {number|THREE.Color} opts.color - Diffuse color
 * @param {THREE.DataTexture} [opts.gradientMap] - Custom gradient map (default: 3-step)
 * @returns {THREE.MeshToonMaterial}
 */
export function createToonMaterial({ color, gradientMap }) {
  return new THREE.MeshToonMaterial({
    color: new THREE.Color(color),
    gradientMap: gradientMap || createGradientMap(3),
  });
}
