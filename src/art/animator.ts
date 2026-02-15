import type { AnimationHints, MutablePixelCanvas, PixelCanvas } from "./pixel/types.js";
import type { LimbStage } from "./parametric/types.js";
import {
  applyBlink, applyArmSway, applyFootTap, applyGesture, applyShimmer,
} from "./animation-actions.js";

type ActionName = "blink" | "arm_sway" | "foot_tap" | "gesture" | "shimmer" | "orb_float";
type Prng = () => number;

const ACTION_TRIGGER_PROBABILITY = 0.3;

function deepCopyPixels(canvas: PixelCanvas): MutablePixelCanvas {
  return canvas.map((row) => [...row]);
}

export function generateBaseFrame(base: PixelCanvas): PixelCanvas {
  return base.map((row) => [...row]);
}

export function getActionPool(limbStage: LimbStage): ActionName[] {
  const pool: ActionName[] = ["blink", "gesture", "shimmer"];
  if (limbStage >= 2) pool.push("arm_sway");
  if (limbStage >= 3) pool.push("foot_tap");
  if (limbStage >= 5) pool.push("orb_float");
  return pool;
}

function applyAction(
  base: PixelCanvas,
  hints: AnimationHints,
  action: ActionName,
  prng: Prng,
): PixelCanvas {
  switch (action) {
    case "blink": return applyBlink(base, hints);
    case "arm_sway": return applyArmSway(base, hints, prng);
    case "foot_tap": return applyFootTap(base, hints, prng);
    case "gesture": return applyGesture(base, hints, prng);
    case "shimmer": return applyShimmer(base, hints, prng);
    case "orb_float": return applyArmSway(base, hints, prng); // reuse vertical shift
    default: return generateBaseFrame(base);
  }
}

export function generateRandomFrame(
  base: PixelCanvas,
  hints: AnimationHints,
  limbStage: LimbStage,
  prng: Prng,
): PixelCanvas {
  if (prng() > ACTION_TRIGGER_PROBABILITY) {
    return generateBaseFrame(base);
  }

  const pool = getActionPool(limbStage);
  const action = pool[Math.floor(prng() * pool.length)];
  return applyAction(base, hints, action, prng);
}

/**
 * Legacy API: still generates 4 frames for compatibility.
 * The renderer may switch to generateRandomFrame() for live display.
 */
export function generateFrames(
  base: PixelCanvas,
  hints: AnimationHints,
  prng: Prng,
): PixelCanvas[] {
  return [
    deepCopyPixels(base),
    applyBlink(base, hints),
    applyGesture(base, hints, prng),
    applyShimmer(base, hints, prng),
  ];
}
