// src/viewer/public/js/outline.js
import * as THREE from "three";

const DEFAULT_THICKNESS = 0.03;
const DEFAULT_COLOR = 0x111122;

/**
 * Create a backface-only ShaderMaterial for outlines.
 * Uses vertex shader to push vertices along normals.
 *
 * @param {number} color - Outline color hex
 * @param {number} thickness - How far to push along normals
 * @returns {THREE.ShaderMaterial}
 */
function createOutlineMaterial(color, thickness) {
  return new THREE.ShaderMaterial({
    uniforms: {
      outlineColor: { value: new THREE.Color(color) },
      outlineThickness: { value: thickness },
    },
    vertexShader: `
      uniform float outlineThickness;
      void main() {
        vec3 pos = position + normal * outlineThickness;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 outlineColor;
      void main() {
        gl_FragColor = vec4(outlineColor, 1.0);
      }
    `,
    side: THREE.BackSide,
  });
}

/**
 * Add outline meshes to every mesh in a creature group.
 * Uses Inverted Hull method: clone geometry, render BackSide, push along normals.
 *
 * @param {THREE.Group} group - Creature group to add outlines to
 * @param {Object} [options]
 * @param {number} [options.color=0x111122] - Outline color
 * @param {number} [options.thickness=0.03] - Outline thickness
 */
export function addOutlines(group, options = {}) {
  const { color = DEFAULT_COLOR, thickness = DEFAULT_THICKNESS } = options;
  const outlineMat = createOutlineMaterial(color, thickness);

  // Collect meshes first to avoid mutating while traversing
  const meshesToOutline = [];
  group.traverse((child) => {
    if (child.isMesh && child.geometry) {
      meshesToOutline.push(child);
    }
  });

  for (const mesh of meshesToOutline) {
    const outlineMesh = new THREE.Mesh(mesh.geometry, outlineMat);
    outlineMesh.name = `${mesh.name}_outline`;
    outlineMesh.position.copy(mesh.position);
    outlineMesh.rotation.copy(mesh.rotation);
    outlineMesh.scale.copy(mesh.scale);
    outlineMesh.castShadow = false;
    outlineMesh.receiveShadow = false;
    outlineMesh.userData.isOutline = true;

    if (mesh.parent) {
      mesh.parent.add(outlineMesh);
    }
  }
}
