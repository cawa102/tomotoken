import * as THREE from "three";

export const CLIP_NAMES = ["idle", "blink", "walk", "jump", "wave"];

/**
 * Create an AnimationMixer for a group and set up actions for provided clips.
 * Automatically plays the "idle" clip in LoopRepeat if present.
 * @param {THREE.Group} group - Root group to animate
 * @param {THREE.AnimationClip[]} clips - Animation clips from glTF
 * @returns {{ mixer: THREE.AnimationMixer, actions: Record<string, THREE.AnimationAction> }}
 */
export function createAnimMixer(group, clips) {
  const mixer = new THREE.AnimationMixer(group);
  const actions = {};

  for (const clip of clips) {
    const action = mixer.clipAction(clip);
    actions[clip.name] = action;
  }

  if (actions["idle"]) {
    actions["idle"].setLoop(THREE.LoopRepeat, Infinity);
    actions["idle"].play();
  }

  return { mixer, actions };
}
