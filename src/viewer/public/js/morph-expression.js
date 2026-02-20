export const MORPH_NAMES = [
  "happy",
  "sleepy",
  "excited",
  "focused",
  "surprised",
  "sad",
];

/**
 * Apply a morph expression to all meshes with morph targets in a group.
 * Resets all influences to 0, then sets the matching expression to 1.
 * Use "default" to reset all influences without activating any.
 * @param {import("three").Group} group - Root group to traverse
 * @param {string} expression - Expression name or "default" to reset
 */
export function applyMorphExpression(group, expression) {
  group.traverse((child) => {
    if (!child.isMesh) return;
    if (!child.morphTargetDictionary || !child.morphTargetInfluences) return;

    // Reset all morph influences to 0
    for (let i = 0; i < child.morphTargetInfluences.length; i++) {
      child.morphTargetInfluences[i] = 0;
    }

    if (expression === "default") return;

    const index = child.morphTargetDictionary[expression];
    if (index !== undefined) {
      child.morphTargetInfluences[index] = 1;
    }
  });
}
