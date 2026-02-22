/**
 * Animation system for 3D creatures.
 *
 * Flag-based: reads `userData.animatable` from each mesh in LLM-generated designs.
 * All animations are time-based (not frame-based) for smooth rendering.
 */

/**
 * Cubic ease-in-out for smoother animation transitions.
 * @param {number} t - Input value 0..1
 * @returns {number} Eased value 0..1
 */
export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ============================================================
// Flag-based animation system (for LLM-generated designs)
// ============================================================

/**
 * Apply flag-based animations to an LLM-generated creature group.
 * Traverses the scene graph, reading `userData.animatable` from each mesh.
 *
 * Also applies global breathing.
 */
export function applyAnimations(group, time) {
  // Global breathing on body mesh
  group.traverse((child) => {
    if (child.userData?.isOutline) return;
    if (child.name === "body" && child.isMesh) {
      const breathCycle = Math.sin(time * 1.5) * 0.02;
      child.scale.y = 1 + breathCycle;
    }

    if (!child.userData?.animatable) return;
    const { type, speed = 1.0, amplitude = 0.1 } = child.userData.animatable;

    switch (type) {
      case "sway":
        child.rotation.z = Math.sin(time * speed) * amplitude;
        break;
      case "bob":
        if (child.userData._origY === undefined) {
          child.userData._origY = child.position.y;
        }
        child.position.y = child.userData._origY + Math.sin(time * speed) * amplitude;
        break;
      case "rotate":
        child.rotation.y = time * speed;
        break;
      case "wiggle":
        child.rotation.z = Math.sin(time * speed * 3) * amplitude * 0.3;
        break;
      case "flap":
        child.rotation.z = Math.sin(time * speed) * amplitude * 0.5;
        break;
    }
  });
}

