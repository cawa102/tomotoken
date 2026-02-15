import type { Palette } from "../pixel/types.js";
import type { DepthMetrics, StyleMetrics } from "../../store/types.js";
import { clamp } from "../../utils/clamp.js";

/** Hue anchor per trait (degrees). */
const HUE_ANCHORS: Record<string, number> = {
  builder: 30,
  fixer: 0,
  refiner: 180,
  scholar: 240,
  scribe: 60,
  architect: 270,
  operator: 120,
  guardian: 330,
};

/**
 * Convert HSL (h: 0-360, s: 0-100, l: 0-100) to RGB [0-255].
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let r1: number, g1: number, b1: number;
  if (h < 60) { r1 = c; g1 = x; b1 = 0; }
  else if (h < 120) { r1 = x; g1 = c; b1 = 0; }
  else if (h < 180) { r1 = 0; g1 = c; b1 = x; }
  else if (h < 240) { r1 = 0; g1 = x; b1 = c; }
  else if (h < 300) { r1 = x; g1 = 0; b1 = c; }
  else { r1 = c; g1 = 0; b1 = x; }

  return [
    Math.round((r1 + m) * 255),
    Math.round((g1 + m) * 255),
    Math.round((b1 + m) * 255),
  ];
}

/**
 * Find the closest ANSI 256 color index to a given RGB.
 * Searches the 6x6x6 color cube (indices 16-231) and grayscale (232-255).
 */
function rgbToAnsi256(r: number, g: number, b: number): number {
  // The 6x6x6 cube values: 0, 95, 135, 175, 215, 255
  const cubeValues = [0, 95, 135, 175, 215, 255];

  let bestIndex = 16;
  let bestDist = Infinity;

  // Search color cube (16-231)
  for (let ri = 0; ri < 6; ri++) {
    for (let gi = 0; gi < 6; gi++) {
      for (let bi = 0; bi < 6; bi++) {
        const cr = cubeValues[ri];
        const cg = cubeValues[gi];
        const cb = cubeValues[bi];
        const dist = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = 16 + ri * 36 + gi * 6 + bi;
        }
      }
    }
  }

  // Search grayscale (232-255)
  for (let i = 0; i < 24; i++) {
    const gray = 8 + i * 10;
    const dist = (r - gray) ** 2 + (g - gray) ** 2 + (b - gray) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = 232 + i;
    }
  }

  return bestIndex;
}

/**
 * Convert HSL to the closest ANSI 256 color index.
 */
function hslToAnsi256(h: number, s: number, l: number): number {
  const [r, g, b] = hslToRgb(h, s, l);
  return rgbToAnsi256(r, g, b);
}

/**
 * Compute weighted circular mean of angles (degrees).
 */
function circularMean(
  angles: readonly number[],
  weights: readonly number[],
): number {
  let sinSum = 0;
  let cosSum = 0;
  let wTotal = 0;

  for (let i = 0; i < angles.length; i++) {
    const w = weights[i];
    if (w <= 0) continue;
    const rad = (angles[i] * Math.PI) / 180;
    sinSum += Math.sin(rad) * w;
    cosSum += Math.cos(rad) * w;
    wTotal += w;
  }

  if (wTotal === 0) return 0;

  const meanRad = Math.atan2(sinSum / wTotal, cosSum / wTotal);
  return ((meanRad * 180) / Math.PI + 360) % 360;
}

/**
 * Generates a 10-slot ANSI 256 color palette from traits and PRNG.
 *
 * Slots: 0=transparent(0), 1=outline(dark), 2=body primary, 3=body secondary(lighter),
 * 4=highlight, 5=eye white(231), 6=pupil(16/black), 7=mouth(accent),
 * 8=accent triadic+120, 9=accent triadic+240
 */
export function generatePalette(
  traits: Record<string, number>,
  depth: DepthMetrics,
  style: StyleMetrics,
  prng: () => number,
): Palette {
  const traitIds = Object.keys(HUE_ANCHORS);
  const angles = traitIds.map((id) => HUE_ANCHORS[id]);
  const weights = traitIds.map((id) => traits[id] ?? 0);

  // Base hue: weighted circular mean * 0.3 + random * 0.7
  const traitHue = circularMean(angles, weights);
  const baseHue = (traitHue * 0.3 + prng() * 360 * 0.7) % 360;

  // Saturation from activity level
  const sessionActivity =
    depth.totalSessions > 0
      ? clamp(0, 40, (depth.editTestLoopCount / depth.totalSessions) * 30)
      : 0;
  const saturation = 40 + sessionActivity;

  // Lightness from style
  const lightness = clamp(
    30,
    70,
    35 + style.codeblockRatio * 20 + style.bulletRatio * 10,
  );

  // PRNG jitter for triadic accents
  const jitter1 = (prng() - 0.5) * 30;
  const jitter2 = (prng() - 0.5) * 30;

  const colors: number[] = [
    0, // [0] transparent marker
    hslToAnsi256(baseHue, saturation, Math.max(10, lightness - 25)), // [1] outline (dark)
    hslToAnsi256(baseHue, saturation, lightness), // [2] body primary
    hslToAnsi256(baseHue, saturation, Math.min(80, lightness + 15)), // [3] body secondary (lighter)
    hslToAnsi256(baseHue, saturation + 10, Math.min(85, lightness + 25)), // [4] highlight
    231, // [5] eye white
    16, // [6] pupil (black)
    hslToAnsi256((baseHue + 180) % 360, saturation, lightness), // [7] mouth (complementary accent)
    hslToAnsi256((baseHue + 120 + jitter1) % 360, saturation, lightness), // [8] accent triadic +120
    hslToAnsi256((baseHue + 240 + jitter2) % 360, saturation, lightness), // [9] accent triadic +240
  ];

  return { colors };
}
