import type { CreatureParams, WidthMap, WidthMapEntry, Bounds } from "./types.js";

interface SilhouetteResult {
  readonly widthMap: WidthMap;
  readonly headBounds: Bounds;
  readonly bodyBounds: Bounds;
}

/**
 * Compute half-width at a given row within an elliptical shape.
 * dy = offset from center, ry = vertical radius, maxHalfW = max horizontal half-width.
 * roundness blends between ellipse (1.0) and rectangle (0.0).
 */
function ellipseWidth(
  dy: number,
  ry: number,
  maxHalfW: number,
  roundness: number,
): number {
  if (ry <= 0 || maxHalfW <= 0) return 0;
  const clampedDy = Math.min(Math.abs(dy), ry);
  const ratio = clampedDy / ry;
  const ellipseHalf = maxHalfW * Math.sqrt(1 - ratio * ratio);
  const rectHalf = maxHalfW;
  return Math.round(ellipseHalf * roundness + rectHalf * (1 - roundness));
}

/**
 * Generates a silhouette (width map) describing the creature's outline.
 * The creature is bottom-aligned on the canvas and scaled by progress.
 */
export function generateSilhouette(
  params: CreatureParams,
  canvasW: number,
  pixelH: number,
  progress: number,
): SilhouetteResult {
  // Effective scale: tiny at progress=0, full at progress=1
  const scale = 0.15 + progress * 0.85;

  // Total creature height (using 70% of canvas height at full scale)
  const totalH = Math.max(4, Math.round(pixelH * 0.7 * scale));
  const headH = Math.max(2, Math.round(totalH * params.headRatio));
  const bodyH = Math.max(2, totalH - headH);

  // Bottom-align on canvas
  const creatureBottom = pixelH - 1;
  const creatureTop = creatureBottom - totalH + 1;

  const headTop = creatureTop;
  const headBottom = headTop + headH - 1;
  const bodyTop = headBottom + 1;
  const bodyBottom = creatureBottom;

  const centerX = Math.floor(canvasW / 2);

  // Head dimensions
  const headMaxHalfW = Math.max(
    1,
    Math.round((canvasW * params.bodyWidthRatio * 0.6 * scale) / 2),
  );
  const headRy = Math.max(1, Math.floor(headH / 2));

  // Body dimensions
  const bodyMaxHalfW = Math.max(
    1,
    Math.round((canvasW * params.bodyWidthRatio * scale) / 2),
  );
  const bodyRy = Math.max(1, Math.floor(bodyH / 2));

  // Neck width for transition
  const neckHalfW = Math.max(
    1,
    Math.round(Math.min(headMaxHalfW, bodyMaxHalfW) * params.neckWidth),
  );

  const entries: (WidthMapEntry | null)[] = new Array(pixelH).fill(null);

  // Head rows
  const headCenterY = headTop + headRy;
  for (let r = headTop; r <= headBottom; r++) {
    const dy = r - headCenterY;
    const halfW = ellipseWidth(dy, headRy, headMaxHalfW, params.roundness);
    if (halfW <= 0) continue;

    const asymOffset = Math.round(params.asymmetry * halfW * (r % 2 === 0 ? 1 : -1));
    const left = Math.max(0, centerX - halfW + asymOffset);
    const right = Math.min(canvasW - 1, centerX + halfW + asymOffset);
    entries[r] = { left, right };
  }

  // Body rows
  const bodyCenterY = bodyTop + bodyRy;
  for (let r = bodyTop; r <= bodyBottom; r++) {
    const dy = r - bodyCenterY;
    const rowFraction = (r - bodyTop) / Math.max(1, bodyH - 1); // 0 at top, 1 at bottom

    // Taper: reduce width toward bottom
    const taperFactor = 1 - params.bodyTaper * rowFraction * 0.5;

    // topHeavy: wider at top, narrower at bottom
    const topHeavyFactor = 1 - params.topHeavy * rowFraction * 0.3;

    const effectiveMaxHalfW = Math.max(
      1,
      Math.round(bodyMaxHalfW * taperFactor * topHeavyFactor),
    );

    const halfW = ellipseWidth(dy, bodyRy, effectiveMaxHalfW, params.roundness);
    if (halfW <= 0) continue;

    const asymOffset = Math.round(params.asymmetry * halfW * (r % 2 === 0 ? 1 : -1));
    const left = Math.max(0, centerX - halfW + asymOffset);
    const right = Math.min(canvasW - 1, centerX + halfW + asymOffset);
    entries[r] = { left, right };
  }

  // Neck transition: smooth the junction between head and body
  // Adjust the last row of head and first row of body to use neck width
  const neckRows = [headBottom, bodyTop];
  for (const r of neckRows) {
    if (r < 0 || r >= pixelH) continue;
    const existing = entries[r];
    if (existing === null) continue;

    const currentHalfW = Math.round((existing.right - existing.left) / 2);
    const blendedHalfW = Math.round(
      (currentHalfW + neckHalfW) / 2,
    );
    const asymOffset = Math.round(params.asymmetry * blendedHalfW * (r % 2 === 0 ? 1 : -1));
    entries[r] = {
      left: Math.max(0, centerX - blendedHalfW + asymOffset),
      right: Math.min(canvasW - 1, centerX + blendedHalfW + asymOffset),
    };
  }

  // Compute bounds
  let headLeft = canvasW;
  let headRight = 0;
  for (let r = headTop; r <= headBottom; r++) {
    const e = entries[r];
    if (e !== null) {
      headLeft = Math.min(headLeft, e.left);
      headRight = Math.max(headRight, e.right);
    }
  }

  let bodyLeft = canvasW;
  let bodyRight = 0;
  for (let r = bodyTop; r <= bodyBottom; r++) {
    const e = entries[r];
    if (e !== null) {
      bodyLeft = Math.min(bodyLeft, e.left);
      bodyRight = Math.max(bodyRight, e.right);
    }
  }

  return {
    widthMap: entries,
    headBounds: {
      top: headTop,
      bottom: headBottom,
      left: headLeft,
      right: headRight,
    },
    bodyBounds: {
      top: bodyTop,
      bottom: bodyBottom,
      left: bodyLeft,
      right: bodyRight,
    },
  };
}
