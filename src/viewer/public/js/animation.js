/**
 * Animation system for 3D creatures.
 *
 * Two modes:
 * 1. Flag-based (LLM designs): reads `userData.animatable` from each mesh
 * 2. Legacy (PRNG designs): fixed animation functions keyed by part names
 *
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
 * Also applies global breathing and idle bob/rotation.
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

  // Global idle bob
  const bob = Math.sin(time * 1.0) * 0.02;
  group.position.y = bob;

  // Global gentle rotation
  const rot = Math.sin(time * 0.3) * 0.1;
  group.rotation.y = rot;
}

// ============================================================
// Legacy animation system (for PRNG-generated designs)
// ============================================================

/**
 * Breathing: gentle body scale oscillation.
 */
function animateBreathing(parts, time) {
  if (!parts.body) return;
  const breathCycle = Math.sin(time * 1.5) * 0.02;
  parts.body.scale.set(1, 1 + breathCycle, 1);
}

/**
 * Blinking: periodically squash eye Y scale to 0.
 * Blinks every ~3-5 seconds, lasting ~0.15s.
 */
function animateBlink(parts, time) {
  if (!parts.leftEye || !parts.rightEye) return;

  const blinkPeriod = 3.5;
  const blinkPhase = time % blinkPeriod;
  const blinkDuration = 0.15;

  if (blinkPhase < blinkDuration) {
    const t = blinkPhase / blinkDuration;
    const squash = 1 - easeInOutCubic(Math.sin(t * Math.PI));
    parts.leftEye.scale.y = Math.max(0.05, squash);
    parts.rightEye.scale.y = Math.max(0.05, squash);
  } else {
    parts.leftEye.scale.y = 1;
    parts.rightEye.scale.y = 1;
  }
}

/**
 * Arm sway: gentle pendulum motion on arms.
 */
function animateArmSway(parts, time) {
  if (!parts.leftArm || !parts.rightArm) return;
  const swing = Math.sin(time * 1.2) * 0.15;
  parts.leftArm.rotation.x = swing;
  parts.rightArm.rotation.x = -swing;
}

/**
 * Foot tap: alternating leg micro-rotation.
 */
function animateFootTap(parts, time) {
  if (!parts.leftLeg || !parts.rightLeg) return;
  const tap = Math.sin(time * 2.0) * 0.08;
  parts.leftLeg.rotation.x = Math.max(0, tap);
  parts.rightLeg.rotation.x = Math.max(0, -tap);
}

/**
 * Ear twitch: periodic small rotation on ears.
 */
function animateEarTwitch(parts, time) {
  if (!parts.leftEar || !parts.rightEar) return;
  const twitchPeriod = 4.2;
  const twitchPhase = time % twitchPeriod;
  if (twitchPhase < 0.3) {
    const t = twitchPhase / 0.3;
    const twitch = Math.sin(t * Math.PI) * 0.2;
    parts.leftEar.rotation.z = 0.3 + twitch;
    parts.rightEar.rotation.z = -0.3 - twitch;
  }
}

/**
 * Tail wag: sinusoidal rotation on tail group.
 */
function animateTailWag(parts, time) {
  if (!parts.tail) return;
  const wag = Math.sin(time * 3.0) * 0.3;
  parts.tail.rotation.y = wag;
}

/**
 * Wing flap: periodic up/down rotation on wings.
 */
function animateWingFlap(parts, time) {
  if (!parts.wings) return;
  const leftWing = parts.wings.userData.leftWing;
  const rightWing = parts.wings.userData.rightWing;
  if (!leftWing || !rightWing) return;

  const flapPeriod = 2.0;
  const flapPhase = time % flapPeriod;
  if (flapPhase < 0.6) {
    const t = flapPhase / 0.6;
    const flap = Math.sin(t * Math.PI) * 0.4;
    leftWing.rotation.z = -flap;
    rightWing.rotation.z = flap;
  } else {
    leftWing.rotation.z = 0;
    rightWing.rotation.z = 0;
  }
}

/**
 * Gentle body bob: whole creature micro-translation on Y.
 */
function animateBob(group, time) {
  const bob = Math.sin(time * 1.0) * 0.02;
  group.position.y = bob;
}

/**
 * Slow idle rotation: very gentle Y rotation.
 */
function animateIdleRotation(group, time) {
  const rot = Math.sin(time * 0.3) * 0.1;
  group.rotation.y = rot;
}

/**
 * Apply all legacy idle animations to a PRNG-generated creature.
 * Kept for backward compatibility when no LLM design is available.
 */
export function applyLegacyAnimations(group, parts, time, _deltaTime) {
  animateBreathing(parts, time);
  animateBlink(parts, time);
  animateArmSway(parts, time);
  animateFootTap(parts, time);
  animateEarTwitch(parts, time);
  animateTailWag(parts, time);
  animateWingFlap(parts, time);
  animateBob(group, time);
  animateIdleRotation(group, time);
}
