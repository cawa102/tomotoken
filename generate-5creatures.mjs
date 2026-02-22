/**
 * Generate 5 random parametric creatures and output an HTML preview.
 * Usage: node generate-5creatures.mjs
 */
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

// --- Inline PRNG (same as src/utils/hash.ts) ---
function mulberry32(seed) {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function createPrng(hexSeed) {
  return mulberry32(parseInt(hexSeed.slice(0, 8), 16));
}
function sha256(input) {
  return createHash("sha256").update(input).digest("hex");
}
function clamp(min, max, v) {
  return Math.max(min, Math.min(max, v));
}

// --- Import parametric pipeline from built dist ---
// We re-import the core functions. Since the build bundles everything,
// we import from the chunk directly. But since that's fragile, let's
// use a dynamic import approach via tsx or just inline the logic.

// Actually, let's import from source using dynamic import with tsx-like approach.
// Since the build output is ESM, we can import the chunk.

// Simpler approach: inline the necessary generation + render to HTML directly.
// This avoids import issues and gives us full control over HTML output.

// --- Parametric generation (inlined from src/art/parametric/) ---

function blend(traitBias, prng) {
  return traitBias * 0.3 + prng() * 0.7;
}

function deriveCreatureParams(traits, depth, style, prng) {
  const t = (id) => traits[id] ?? 0;
  const scholarScribe = (t("scholar") + t("scribe")) / 200;
  const builderGuardian = (t("builder") + t("guardian")) / 200;
  const refinerOperator = (t("refiner") + t("operator")) / 200;
  const architectBias = t("architect") / 100;
  const guardianFixer = (t("guardian") + t("fixer")) / 200;
  const operatorFixer = (t("operator") + t("fixer")) / 200;
  const scribeArchitect = (t("scribe") + t("architect")) / 200;
  const builderBias = t("builder") / 100;

  return {
    headRatio: 0.20 + blend(scholarScribe, prng) * 0.25,
    bodyWidthRatio: 0.30 + blend(builderGuardian, prng) * 0.50,
    roundness: blend(refinerOperator, prng),
    topHeavy: blend(architectBias, prng),
    eyeSize: prng() < 0.33 ? 1 : prng() < 0.66 ? 2 : 3,
    eyeSpacing: 0.3 + prng() * 0.4,
    hasEars: blend(guardianFixer + 0.25, prng) > 0.45,
    hasHorns: blend(guardianFixer * 0.6 + builderBias * 0.4 + 0.15, prng) > 0.70,
    hasTail: blend(operatorFixer + 0.15, prng) > 0.40,
    hasWings: blend(scribeArchitect + 0.10, prng) > 0.80,
    hasArms: prng() > 0.35,
    hasLegs: prng() > 0.25,
    patternType: Math.floor(prng() * 6),
    patternDensity: blend(depth.editTestLoopCount > 0 ? clamp(0, 1, depth.editTestLoopCount / 20) : 0, prng),
    neckWidth: 0.3 + prng() * 0.5,
    legLength: 0.1 + prng() * 0.2,
    armLength: 0.1 + prng() * 0.2,
    tailLength: 0.1 + prng() * 0.3,
    wingSize: 0.1 + prng() * 0.3,
    earSize: 0.1 + prng() * 0.2,
    hornSize: 0.1 + prng() * 0.2,
    bodyTaper: prng() * 0.5,
    asymmetry: prng() * 0.15,
  };
}

function adjustParamsForProgress(params, progress) {
  return {
    ...params,
    hasEars: params.hasEars && progress >= 0.5,
    hasHorns: params.hasHorns && progress >= 0.7,
    hasTail: params.hasTail && progress >= 0.5,
    hasWings: params.hasWings && progress >= 0.7,
    hasArms: params.hasArms && progress >= 0.3,
    hasLegs: params.hasLegs && progress >= 0.3,
    patternDensity: params.patternDensity * Math.min(1, progress * 1.5),
  };
}

// --- HSL/Color utilities ---
function hslToRgb(h, s, l) {
  const sN = s / 100, lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;
  let r1, g1, b1;
  if (h < 60) { r1 = c; g1 = x; b1 = 0; }
  else if (h < 120) { r1 = x; g1 = c; b1 = 0; }
  else if (h < 180) { r1 = 0; g1 = c; b1 = x; }
  else if (h < 240) { r1 = 0; g1 = x; b1 = c; }
  else if (h < 300) { r1 = x; g1 = 0; b1 = c; }
  else { r1 = c; g1 = 0; b1 = x; }
  return [Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((b1 + m) * 255)];
}

// ANSI 256 to RGB lookup
function ansi256ToRgb(idx) {
  if (idx < 16) {
    // Standard 16 colors
    const basic = [
      [0,0,0],[128,0,0],[0,128,0],[128,128,0],[0,0,128],[128,0,128],[0,128,128],[192,192,192],
      [128,128,128],[255,0,0],[0,255,0],[255,255,0],[0,0,255],[255,0,255],[0,255,255],[255,255,255],
    ];
    return basic[idx];
  }
  if (idx < 232) {
    const i = idx - 16;
    const r = Math.floor(i / 36);
    const g = Math.floor((i % 36) / 6);
    const b = i % 6;
    const vals = [0, 95, 135, 175, 215, 255];
    return [vals[r], vals[g], vals[b]];
  }
  const gray = 8 + (idx - 232) * 10;
  return [gray, gray, gray];
}

function rgbToAnsi256(r, g, b) {
  const cubeValues = [0, 95, 135, 175, 215, 255];
  let bestIndex = 16, bestDist = Infinity;
  for (let ri = 0; ri < 6; ri++)
    for (let gi = 0; gi < 6; gi++)
      for (let bi = 0; bi < 6; bi++) {
        const d = (r - cubeValues[ri]) ** 2 + (g - cubeValues[gi]) ** 2 + (b - cubeValues[bi]) ** 2;
        if (d < bestDist) { bestDist = d; bestIndex = 16 + ri * 36 + gi * 6 + bi; }
      }
  for (let i = 0; i < 24; i++) {
    const gray = 8 + i * 10;
    const d = (r - gray) ** 2 + (g - gray) ** 2 + (b - gray) ** 2;
    if (d < bestDist) { bestDist = d; bestIndex = 232 + i; }
  }
  return bestIndex;
}

function hslToAnsi256(h, s, l) {
  const [r, g, b] = hslToRgb(h, s, l);
  return rgbToAnsi256(r, g, b);
}

function circularMean(angles, weights) {
  let sinSum = 0, cosSum = 0, wTotal = 0;
  for (let i = 0; i < angles.length; i++) {
    const w = weights[i];
    if (w <= 0) continue;
    const rad = (angles[i] * Math.PI) / 180;
    sinSum += Math.sin(rad) * w;
    cosSum += Math.cos(rad) * w;
    wTotal += w;
  }
  if (wTotal === 0) return 0;
  return ((Math.atan2(sinSum / wTotal, cosSum / wTotal) * 180) / Math.PI + 360) % 360;
}

const HUE_ANCHORS = { builder: 30, fixer: 0, refiner: 180, scholar: 240, scribe: 60, architect: 270, operator: 120, guardian: 330 };

function generatePalette(traits, depth, style, prng) {
  const traitIds = Object.keys(HUE_ANCHORS);
  const angles = traitIds.map(id => HUE_ANCHORS[id]);
  const weights = traitIds.map(id => traits[id] ?? 0);
  const traitHue = circularMean(angles, weights);
  const baseHue = (traitHue * 0.3 + prng() * 360 * 0.7) % 360;
  const sessionActivity = depth.totalSessions > 0
    ? clamp(0, 40, (depth.editTestLoopCount / depth.totalSessions) * 30) : 0;
  const saturation = 40 + sessionActivity;
  const lightness = clamp(30, 70, 35 + style.codeblockRatio * 20 + style.bulletRatio * 10);
  const jitter1 = (prng() - 0.5) * 30;
  const jitter2 = (prng() - 0.5) * 30;
  return {
    colors: [
      0,
      hslToAnsi256(baseHue, saturation, Math.max(10, lightness - 25)),
      hslToAnsi256(baseHue, saturation, lightness),
      hslToAnsi256(baseHue, saturation, Math.min(80, lightness + 15)),
      hslToAnsi256(baseHue, saturation + 10, Math.min(85, lightness + 25)),
      231,
      16,
      hslToAnsi256((baseHue + 180) % 360, saturation, lightness),
      hslToAnsi256((baseHue + 120 + jitter1) % 360, saturation, lightness),
      hslToAnsi256((baseHue + 240 + jitter2) % 360, saturation, lightness),
    ],
  };
}

// --- Silhouette ---
function ellipseWidth(y, cy, ry, rx) {
  const dy = (y - cy) / ry;
  if (Math.abs(dy) >= 1) return 0;
  return rx * Math.sqrt(1 - dy * dy);
}

function generateSilhouette(params, canvasW, pixelH, progress) {
  const scale = 0.15 + progress * 0.85;
  const headRows = Math.max(4, Math.round(pixelH * params.headRatio * scale));
  const bodyRows = Math.max(4, Math.round((pixelH - headRows) * scale * 0.7));
  const totalRows = headRows + bodyRows;
  const startY = pixelH - totalRows;
  const bodyW = Math.max(4, Math.round(canvasW * params.bodyWidthRatio * scale));
  const headW = Math.max(4, Math.round(bodyW * (0.6 + params.headRatio * 0.6)));
  const cx = Math.floor(canvasW / 2);
  const widthMap = new Array(pixelH).fill(null);

  // Head
  const headCy = startY + headRows / 2;
  const headRy = headRows / 2;
  const headRx = headW / 2;
  for (let y = startY; y < startY + headRows; y++) {
    const raw = ellipseWidth(y, headCy, headRy, headRx);
    const r = params.roundness;
    const rectW = headRx;
    const w = Math.round(raw * r + rectW * (1 - r));
    if (w > 0) widthMap[y] = { left: cx - w, right: cx + w };
  }

  // Body
  const bodyStartY = startY + headRows;
  const bodyCy = bodyStartY + bodyRows / 2;
  const bodyRy = bodyRows / 2;
  const bodyRx = bodyW / 2;
  for (let y = bodyStartY; y < bodyStartY + bodyRows; y++) {
    const relY = (y - bodyStartY) / bodyRows;
    const taper = 1 - relY * params.bodyTaper * 0.5;
    const topH = 1 + params.topHeavy * 0.3 * (1 - relY);
    const raw = ellipseWidth(y, bodyCy, bodyRy, bodyRx) * taper * topH;
    const r = params.roundness;
    const rectW = bodyRx * taper;
    const w = Math.round(raw * r + rectW * (1 - r));
    if (w > 0) widthMap[y] = { left: cx - w, right: cx + w };
  }

  // Neck blending
  const neckW = params.neckWidth;
  const hBot = startY + headRows - 1;
  const bTop = bodyStartY;
  if (widthMap[hBot] && widthMap[bTop]) {
    const hW = widthMap[hBot].right - widthMap[hBot].left;
    const bW = widthMap[bTop].right - widthMap[bTop].left;
    const nW = Math.round(Math.min(hW, bW) * neckW);
    widthMap[hBot] = { left: cx - Math.floor(nW / 2), right: cx + Math.ceil(nW / 2) };
    widthMap[bTop] = { left: cx - Math.floor(nW / 2), right: cx + Math.ceil(nW / 2) };
  }

  return {
    widthMap,
    headBounds: { top: startY, bottom: startY + headRows - 1, left: cx - Math.floor(headW / 2), right: cx + Math.ceil(headW / 2) },
    bodyBounds: { top: bodyStartY, bottom: bodyStartY + bodyRows - 1, left: cx - Math.floor(bodyW / 2), right: cx + Math.ceil(bodyW / 2) },
  };
}

// --- Rasterize ---
function rasterizeSilhouette(widthMap, canvasW, pixelH) {
  const canvas = Array.from({ length: pixelH }, () => new Array(canvasW).fill(0));
  for (let y = 0; y < pixelH; y++) {
    const entry = widthMap[y];
    if (!entry) continue;
    const { left, right } = entry;
    const l = Math.max(0, left);
    const r = Math.min(canvasW - 1, right);
    for (let x = l; x <= r; x++) {
      const isEdge = x === l || x === r || !widthMap[y - 1] || !widthMap[y + 1];
      canvas[y][x] = isEdge ? 1 : 2;
    }
  }
  return canvas;
}

// --- Features ---
function placeFeatures(canvas, widthMap, params, headBounds, bodyBounds, prng) {
  const c = canvas.map(r => [...r]);
  const eyePositions = [];
  const gesturePixels = [];
  const shimmerPixels = [];

  // Eyes
  const headCy = Math.floor((headBounds.top + headBounds.bottom) / 2);
  const headCx = Math.floor((headBounds.left + headBounds.right) / 2);
  const headW = headBounds.right - headBounds.left;
  const spacing = Math.round(headW * params.eyeSpacing * 0.5);
  const eyeY = Math.max(headBounds.top + 1, headCy - 1);

  for (const dx of [-spacing, spacing]) {
    const ex = clamp(headBounds.left + 1, headBounds.right - 1, headCx + dx);
    const ey = clamp(headBounds.top + 1, headBounds.bottom - 1, eyeY);
    if (params.eyeSize >= 2) {
      for (let dy = -1; dy <= 0; dy++)
        for (let ddx = -1; ddx <= 0; ddx++) {
          const py = clamp(0, canvas.length - 1, ey + dy);
          const px = clamp(0, canvas[0].length - 1, ex + ddx);
          if (c[py][px] !== 0) c[py][px] = 5;
        }
    }
    if (c[ey]?.[ex] !== undefined && c[ey][ex] !== 0) {
      c[ey][ex] = 6;
      eyePositions.push([ey, ex]);
    }
  }

  // Mouth
  const mouthY = Math.min(headBounds.bottom - 1, headCy + 2);
  if (c[mouthY]?.[headCx] !== undefined && c[mouthY][headCx] !== 0) {
    c[mouthY][headCx] = 7;
  }

  // Ears
  if (params.hasEars) {
    const earH = Math.max(1, Math.round(params.earSize * 6));
    for (const side of [-1, 1]) {
      const ex = side === -1 ? headBounds.left - 1 : headBounds.right + 1;
      for (let dy = 0; dy < earH; dy++) {
        const ey = headBounds.top - earH + dy;
        if (ey >= 0 && ex >= 0 && ex < canvas[0].length) { c[ey][ex] = 8; gesturePixels.push([ey, ex]); }
      }
    }
  }

  // Horns
  if (params.hasHorns) {
    const hornH = Math.max(1, Math.round(params.hornSize * 6));
    for (const side of [-1, 1]) {
      const hx = headCx + side * Math.round(headW * 0.2);
      for (let dy = 0; dy < hornH; dy++) {
        const hy = headBounds.top - 1 - dy;
        if (hy >= 0 && hx >= 0 && hx < canvas[0].length) { c[hy][hx] = 9; }
      }
    }
  }

  // Tail
  if (params.hasTail) {
    const tailLen = Math.max(1, Math.round(params.tailLength * 8));
    const dir = prng() > 0.5 ? 1 : -1;
    const baseX = dir === 1 ? bodyBounds.right + 1 : bodyBounds.left - 1;
    const baseY = Math.floor((bodyBounds.top + bodyBounds.bottom) / 2);
    for (let i = 0; i < tailLen; i++) {
      const tx = baseX + dir * i;
      const ty = baseY - Math.floor(i / 2);
      if (ty >= 0 && tx >= 0 && tx < canvas[0].length && ty < canvas.length) {
        c[ty][tx] = 8;
        gesturePixels.push([ty, tx]);
      }
    }
  }

  // Wings
  if (params.hasWings) {
    const wingH = Math.max(2, Math.round(params.wingSize * 10));
    for (const side of [-1, 1]) {
      const wx = side === -1 ? bodyBounds.left - 2 : bodyBounds.right + 2;
      for (let dy = 0; dy < wingH; dy++) {
        const wy = bodyBounds.top + dy;
        const ww = Math.max(1, Math.round((1 - dy / wingH) * 3));
        for (let ddx = 0; ddx < ww; ddx++) {
          const px = wx + side * ddx;
          if (wy >= 0 && wy < canvas.length && px >= 0 && px < canvas[0].length) {
            c[wy][px] = 9;
            gesturePixels.push([wy, px]);
          }
        }
      }
    }
  }

  // Arms
  if (params.hasArms) {
    const armLen = Math.max(1, Math.round(params.armLength * 8));
    for (const side of [-1, 1]) {
      const ax = side === -1 ? bodyBounds.left : bodyBounds.right;
      const ay = bodyBounds.top + 2;
      for (let i = 0; i < armLen; i++) {
        const px = ax + side * (i + 1);
        const py = ay + Math.floor(i / 2);
        if (py >= 0 && py < canvas.length && px >= 0 && px < canvas[0].length) {
          c[py][px] = 2;
          gesturePixels.push([py, px]);
        }
      }
    }
  }

  // Legs
  if (params.hasLegs) {
    const legLen = Math.max(1, Math.round(params.legLength * 8));
    const bodyCx = Math.floor((bodyBounds.left + bodyBounds.right) / 2);
    const bodyW = bodyBounds.right - bodyBounds.left;
    for (const dx of [-Math.round(bodyW * 0.25), Math.round(bodyW * 0.25)]) {
      const lx = bodyCx + dx;
      for (let i = 0; i < legLen; i++) {
        const ly = bodyBounds.bottom + 1 + i;
        if (ly < canvas.length && lx >= 0 && lx < canvas[0].length) {
          c[ly][lx] = 1;
        }
      }
    }
  }

  // Shimmer pixels
  for (let y = 0; y < c.length; y++)
    for (let x = 0; x < c[0].length; x++)
      if (c[y][x] > 0 && c[y][x] !== 5 && c[y][x] !== 6)
        shimmerPixels.push([y, x]);

  return { canvas: c, hints: { eyePositions, gesturePixels, shimmerPixels } };
}

// --- Pattern ---
function applyPattern(canvas, widthMap, params, bodyBounds, prng) {
  if (params.patternType === 0 || params.patternDensity <= 0) return canvas;
  const c = canvas.map(r => [...r]);
  const protect = new Set([0, 1, 5, 6, 7]);
  for (let y = bodyBounds.top; y <= bodyBounds.bottom; y++) {
    const entry = widthMap[y];
    if (!entry) continue;
    for (let x = entry.left; x <= entry.right; x++) {
      if (x < 0 || x >= c[0].length) continue;
      if (protect.has(c[y][x])) continue;
      let apply = false;
      switch (params.patternType) {
        case 1: apply = y % Math.max(2, Math.round(4 * (1 - params.patternDensity))) === 0; break;
        case 2: apply = prng() < params.patternDensity * 0.3; break;
        case 3: { const relY = (y - bodyBounds.top) / Math.max(1, bodyBounds.bottom - bodyBounds.top); apply = relY > 0.5; break; }
        case 4: apply = ((x + y) % 2 === 0) && prng() < params.patternDensity; break;
        case 5: { const cx = (bodyBounds.left + bodyBounds.right) / 2; const cy = (bodyBounds.top + bodyBounds.bottom) / 2;
          const angle = Math.atan2(y - cy, x - cx); const dist = Math.sqrt((y - cy) ** 2 + (x - cx) ** 2);
          apply = Math.sin(angle * 3 + dist * 0.5) > 0.5 - params.patternDensity; break; }
      }
      if (apply) c[y][x] = c[y][x] === 2 ? 3 : 4;
    }
  }
  return c;
}

// --- Animation (simplified: just generate base frame + 3 variants) ---
function generateFrames(base, hints, prng) {
  const frames = [base];
  for (let f = 0; f < 3; f++) {
    const frame = base.map(r => [...r]);
    // Blink on frame 2
    if (f === 1) {
      for (const [ey, ex] of hints.eyePositions) {
        if (frame[ey]?.[ex] !== undefined) frame[ey][ex] = 1;
      }
    }
    // Shimmer on frame 3
    if (f === 2 && hints.shimmerPixels.length > 0) {
      const count = Math.max(1, Math.floor(hints.shimmerPixels.length * 0.05));
      for (let i = 0; i < count; i++) {
        const idx = Math.floor(prng() * hints.shimmerPixels.length);
        const [sy, sx] = hints.shimmerPixels[idx];
        if (frame[sy]?.[sx] !== undefined && frame[sy][sx] === 2) frame[sy][sx] = 4;
      }
    }
    frames.push(frame);
  }
  return frames;
}

// --- Full pipeline ---
function generateCreature(seed, traits, depth, style, progress, canvasW, canvasH) {
  const prng = createPrng(seed);
  const pixelH = canvasH * 2;
  const rawParams = deriveCreatureParams(traits, depth, style, prng);
  const params = adjustParamsForProgress(rawParams, progress);
  const palette = generatePalette(traits, depth, style, createPrng(seed));
  // Need separate prng for palette since we consumed the first one
  // Re-seed for deterministic silhouette
  const prng2 = createPrng(sha256(seed + "body"));
  const { widthMap, headBounds, bodyBounds } = generateSilhouette(params, canvasW, pixelH, progress);
  let canvas = rasterizeSilhouette(widthMap, canvasW, pixelH);
  const { canvas: featuredCanvas, hints } = placeFeatures(canvas, widthMap, params, headBounds, bodyBounds, prng2);
  canvas = applyPattern(featuredCanvas, widthMap, params, bodyBounds, prng2);
  const frames = generateFrames(canvas, hints, prng2);
  return { frames, palette, params, rawParams };
}

// --- HTML Renderer ---
function pixelToHtml(frames, palette, canvasW, pixelH, animationId) {
  // Convert palette ANSI 256 indices to CSS rgb()
  const cssColors = palette.colors.map(idx => {
    if (idx === 0) return "transparent";
    const [r, g, b] = ansi256ToRgb(idx);
    return `rgb(${r},${g},${b})`;
  });

  // Render using half-block technique in HTML
  // Each text row = 2 pixel rows
  let html = "";

  // Create frames for animation
  for (let fi = 0; fi < frames.length; fi++) {
    const frame = frames[fi];
    const display = fi === 0 ? "block" : "none";
    html += `<div class="frame" data-anim="${animationId}" data-frame="${fi}" style="display:${display}">`;
    for (let row = 0; row < pixelH; row += 2) {
      html += '<div class="row">';
      for (let col = 0; col < canvasW; col++) {
        const top = frame[row]?.[col] ?? 0;
        const bot = frame[row + 1]?.[col] ?? 0;
        if (top === 0 && bot === 0) {
          html += '<span class="px">\u00A0</span>';
        } else if (top === bot) {
          html += `<span class="px" style="color:${cssColors[top]}">\u2588</span>`;
        } else if (top === 0) {
          html += `<span class="px" style="color:${cssColors[bot]}">\u2584</span>`;
        } else if (bot === 0) {
          html += `<span class="px" style="color:${cssColors[top]}">\u2580</span>`;
        } else {
          html += `<span class="px" style="color:${cssColors[top]};background:${cssColors[bot]}">\u2580</span>`;
        }
      }
      html += "</div>\n";
    }
    html += "</div>\n";
  }
  return html;
}

// --- Generate 5 random creatures ---
const CANVAS_W = 32;
const CANVAS_H = 16;

const creatures = [
  {
    name: "Heavy Builder",
    seed: sha256(randomBytes(16).toString("hex")),
    traits: { builder: 70, fixer: 20, refiner: 5, scholar: 5, scribe: 0, architect: 0, operator: 0, guardian: 0 },
    depth: { editTestLoopCount: 12, repeatEditSameFileCount: 8, phaseSwitchCount: 20, totalSessions: 10 },
    style: { bulletRatio: 0.1, questionRatio: 0.01, codeblockRatio: 0.3, avgMessageLen: 300, messageLenStd: 80, headingRatio: 0.02 },
    progress: 0.85,
  },
  {
    name: "Curious Scholar",
    seed: sha256(randomBytes(16).toString("hex")),
    traits: { builder: 10, fixer: 5, refiner: 5, scholar: 55, scribe: 15, architect: 5, operator: 3, guardian: 2 },
    depth: { editTestLoopCount: 2, repeatEditSameFileCount: 1, phaseSwitchCount: 30, totalSessions: 15 },
    style: { bulletRatio: 0.4, questionRatio: 0.05, codeblockRatio: 0.05, avgMessageLen: 150, messageLenStd: 40, headingRatio: 0.1 },
    progress: 0.6,
  },
  {
    name: "Stealthy Guardian",
    seed: sha256(randomBytes(16).toString("hex")),
    traits: { builder: 5, fixer: 15, refiner: 10, scholar: 5, scribe: 0, architect: 10, operator: 5, guardian: 50 },
    depth: { editTestLoopCount: 6, repeatEditSameFileCount: 4, phaseSwitchCount: 15, totalSessions: 8 },
    style: { bulletRatio: 0.2, questionRatio: 0.02, codeblockRatio: 0.2, avgMessageLen: 250, messageLenStd: 60, headingRatio: 0.05 },
    progress: 1.0,
  },
  {
    name: "Baby Refiner",
    seed: sha256(randomBytes(16).toString("hex")),
    traits: { builder: 10, fixer: 10, refiner: 45, scholar: 10, scribe: 10, architect: 5, operator: 5, guardian: 5 },
    depth: { editTestLoopCount: 0, repeatEditSameFileCount: 0, phaseSwitchCount: 5, totalSessions: 3 },
    style: { bulletRatio: 0.05, questionRatio: 0.03, codeblockRatio: 0.1, avgMessageLen: 100, messageLenStd: 30, headingRatio: 0.01 },
    progress: 0.15,
  },
  {
    name: "Balanced Operator",
    seed: sha256(randomBytes(16).toString("hex")),
    traits: { builder: 15, fixer: 15, refiner: 10, scholar: 10, scribe: 10, architect: 10, operator: 20, guardian: 10 },
    depth: { editTestLoopCount: 8, repeatEditSameFileCount: 5, phaseSwitchCount: 25, totalSessions: 12 },
    style: { bulletRatio: 0.3, questionRatio: 0.04, codeblockRatio: 0.15, avgMessageLen: 200, messageLenStd: 50, headingRatio: 0.06 },
    progress: 0.5,
  },
];

// Generate
const generated = creatures.map((c, i) => {
  const result = generateCreature(c.seed, c.traits, c.depth, c.style, c.progress, CANVAS_W, CANVAS_H);
  return { ...c, ...result, id: i };
});

// Build HTML
const topTrait = (traits) => Object.entries(traits).sort(([, a], [, b]) => b - a)[0][0];

let cardsHtml = "";
for (const g of generated) {
  const paletteSwatches = g.palette.colors.slice(1).map((idx, i) => {
    const [r, b2, b] = ansi256ToRgb(idx);
    return `<span class="swatch" style="background:rgb(${r},${b2},${b})" title="Slot ${i + 1}"></span>`;
  }).join("");

  const traitBars = Object.entries(g.traits)
    .sort(([, a], [, b]) => b - a)
    .map(([name, val]) => `<div class="trait"><span class="trait-name">${name}</span><div class="trait-bar"><div class="trait-fill" style="width:${val}%"></div></div><span class="trait-val">${val}</span></div>`)
    .join("");

  const featureList = [];
  if (g.params.hasEars) featureList.push("ears");
  if (g.params.hasHorns) featureList.push("horns");
  if (g.params.hasTail) featureList.push("tail");
  if (g.params.hasWings) featureList.push("wings");
  if (g.params.hasArms) featureList.push("arms");
  if (g.params.hasLegs) featureList.push("legs");
  const patternNames = ["none", "stripes", "spots", "gradient", "checker", "swirl"];

  cardsHtml += `
    <div class="card">
      <div class="card-header">
        <h2>${g.name}</h2>
        <span class="badge">${topTrait(g.traits)}</span>
        <span class="progress-badge">Progress: ${Math.round(g.progress * 100)}%</span>
      </div>
      <div class="card-body">
        <div class="creature-display">
          ${pixelToHtml(g.frames, g.palette, CANVAS_W, CANVAS_H * 2, g.id)}
        </div>
        <div class="card-info">
          <div class="traits-section">
            <h3>Traits</h3>
            ${traitBars}
          </div>
          <div class="details-section">
            <h3>Features</h3>
            <p>${featureList.length > 0 ? featureList.join(", ") : "none yet"}</p>
            <p>Pattern: ${patternNames[g.params.patternType]}</p>
            <h3>Palette</h3>
            <div class="palette">${paletteSwatches}</div>
            <h3>Seed</h3>
            <code class="seed">${g.seed.slice(0, 16)}...</code>
          </div>
        </div>
      </div>
    </div>`;
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tomotoken - 5 Parametric Creatures Preview</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0d1117;
    color: #e6edf3;
    padding: 2rem;
  }
  h1 {
    text-align: center;
    margin-bottom: 0.5rem;
    font-size: 2rem;
    background: linear-gradient(90deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3, #54a0ff);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .subtitle {
    text-align: center;
    color: #8b949e;
    margin-bottom: 2rem;
    font-size: 0.95rem;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
    gap: 1.5rem;
    max-width: 1200px;
    margin: 0 auto;
  }
  .card {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 12px;
    overflow: hidden;
    transition: transform 0.2s;
  }
  .card:hover { transform: translateY(-2px); border-color: #58a6ff; }
  .card-header {
    padding: 1rem 1.2rem;
    border-bottom: 1px solid #21262d;
    display: flex;
    align-items: center;
    gap: 0.7rem;
  }
  .card-header h2 { font-size: 1.1rem; flex: 1; }
  .badge {
    background: #238636;
    color: #fff;
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }
  .progress-badge {
    background: #1f6feb;
    color: #fff;
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .card-body {
    padding: 1.2rem;
    display: flex;
    gap: 1.2rem;
  }
  .creature-display {
    background: #0d1117;
    border-radius: 8px;
    padding: 8px;
    flex-shrink: 0;
    cursor: pointer;
    position: relative;
    line-height: 1;
  }
  .creature-display::after {
    content: "click to animate";
    position: absolute;
    bottom: 2px;
    right: 6px;
    font-size: 0.6rem;
    color: #484f58;
  }
  .row {
    white-space: pre;
    height: 1.05em;
    line-height: 1.05;
  }
  .px {
    font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
    font-size: 14px;
    letter-spacing: 0;
  }
  .card-info { flex: 1; min-width: 0; }
  .card-info h3 {
    font-size: 0.8rem;
    color: #8b949e;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0.8rem 0 0.4rem;
  }
  .card-info h3:first-child { margin-top: 0; }
  .trait {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 3px 0;
    font-size: 0.8rem;
  }
  .trait-name {
    width: 65px;
    text-align: right;
    color: #8b949e;
  }
  .trait-bar {
    flex: 1;
    height: 6px;
    background: #21262d;
    border-radius: 3px;
    overflow: hidden;
  }
  .trait-fill {
    height: 100%;
    background: linear-gradient(90deg, #238636, #3fb950);
    border-radius: 3px;
    transition: width 0.5s;
  }
  .trait-val {
    width: 25px;
    font-size: 0.75rem;
    color: #8b949e;
  }
  .palette {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .swatch {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: 1px solid #30363d;
    display: inline-block;
  }
  .details-section p {
    font-size: 0.85rem;
    color: #c9d1d9;
    margin: 2px 0;
  }
  .seed {
    font-size: 0.7rem;
    color: #58a6ff;
    background: #0d1117;
    padding: 2px 6px;
    border-radius: 4px;
  }
  @media (max-width: 600px) {
    .card-body { flex-direction: column; }
    .grid { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
<h1>Tomotoken Parametric Creatures</h1>
<p class="subtitle">5 randomly generated creatures &mdash; each unique from trait scores (30%) + PRNG seed (70%)</p>
<div class="grid">
${cardsHtml}
</div>

<script>
// Simple click-to-animate
document.querySelectorAll('.creature-display').forEach(display => {
  let frame = 0;
  const frames = display.querySelectorAll('.frame');
  if (frames.length <= 1) return;
  let interval = null;
  display.addEventListener('click', () => {
    if (interval) { clearInterval(interval); interval = null; frames.forEach((f, i) => f.style.display = i === 0 ? 'block' : 'none'); frame = 0; return; }
    interval = setInterval(() => {
      frames[frame].style.display = 'none';
      frame = (frame + 1) % frames.length;
      frames[frame].style.display = 'block';
    }, 400);
  });
});
</script>
</body>
</html>`;

writeFileSync("5creatures-preview.html", html);
console.log("Generated 5creatures-preview.html with 5 parametric creatures!");
for (const g of generated) {
  console.log(`  ${g.name}: seed=${g.seed.slice(0, 12)}... progress=${g.progress} top-trait=${topTrait(g.traits)}`);
}
