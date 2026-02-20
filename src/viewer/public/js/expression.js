/**
 * Expression system for LLM-generated creatures.
 *
 * Finds eye/mouth meshes by name and adjusts scale/position
 * to create different facial expressions.
 */

/**
 * Apply an expression to a creature's parts.
 * Finds meshes whose name contains "eye" or "mouth" and adjusts them.
 *
 * @param {Object} parts - Flat map of named meshes from buildFromDesign
 * @param {Object} expression - Expression definition { eyes?, mouth? }
 */
export function applyExpression(parts, expression) {
  if (!expression) return;

  const eyeMeshes = Object.entries(parts).filter(([name]) =>
    name.toLowerCase().includes("eye")
  );

  const mouthMeshes = Object.entries(parts).filter(([name]) =>
    name.toLowerCase().includes("mouth")
  );

  if (expression.eyes) {
    const { scaleY, offsetY, shape } = expression.eyes;

    for (const [, mesh] of eyeMeshes) {
      if (scaleY !== undefined) {
        mesh.scale.y = scaleY;
      }
      if (offsetY !== undefined) {
        if (mesh.userData._origPosY === undefined) {
          mesh.userData._origPosY = mesh.position.y;
        }
        mesh.position.y = mesh.userData._origPosY + offsetY;
      }
      applyEyeShape(mesh, shape);
    }
  }

  if (expression.mouth) {
    const { scaleX, scaleY, shape } = expression.mouth;

    for (const [, mesh] of mouthMeshes) {
      if (scaleX !== undefined) {
        mesh.scale.x = scaleX;
      }
      if (scaleY !== undefined) {
        mesh.scale.y = scaleY;
      }
      applyMouthShape(mesh, shape);
    }
  }
}

/**
 * Adjust eye mesh based on shape keyword.
 */
function applyEyeShape(mesh, shape) {
  if (!shape) return;

  switch (shape) {
    case "round":
      mesh.scale.y = 1.0;
      break;
    case "happy":
      mesh.scale.y = 0.5;
      if (mesh.userData._origPosY === undefined) {
        mesh.userData._origPosY = mesh.position.y;
      }
      mesh.position.y = mesh.userData._origPosY + 0.01;
      break;
    case "sleepy":
      mesh.scale.y = 0.3;
      break;
    case "sparkle":
      mesh.scale.set(1.15, 1.15, 1.15);
      break;
  }
}

/**
 * Adjust mouth mesh based on shape keyword.
 */
function applyMouthShape(mesh, shape) {
  if (!shape) return;

  switch (shape) {
    case "smile":
      mesh.scale.x = 1.2;
      mesh.scale.y = 0.8;
      break;
    case "open":
      mesh.scale.x = 0.8;
      mesh.scale.y = 1.4;
      break;
    case "flat":
      mesh.scale.x = 1.0;
      mesh.scale.y = 0.3;
      break;
    case "pout":
      mesh.scale.x = 0.6;
      mesh.scale.y = 0.6;
      break;
  }
}

/**
 * Select the appropriate expression based on context.
 *
 * @param {Object} expressions - Map of expression names to expression defs
 * @param {Object} context - { progress, hour }
 * @returns {Object} The selected expression definition
 */
export function selectExpression(expressions, context) {
  if (!expressions) return null;

  const { progress = 0, hour = new Date().getHours() } = context || {};

  // Late night → sleepy
  if ((hour >= 23 || hour < 5) && expressions.sleepy) {
    return expressions.sleepy;
  }

  // Near stage advance → focused (check before happy since 0.9 > 0.7)
  if (progress > 0.9 && expressions.focused) {
    return expressions.focused;
  }

  // Progress increasing rapidly → happy
  if (progress > 0.7 && expressions.happy) {
    return expressions.happy;
  }

  // Default
  return expressions.default || null;
}
