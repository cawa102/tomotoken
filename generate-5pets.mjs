/**
 * Generate 5 "builder" archetype pets at final form (progress=1.0)
 * with different seeds, and render to HTML.
 *
 * Usage: node generate-5pets.mjs
 * Output: 5pets-preview.html
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

// ─── PRNG (mulberry32) ───────────────────────────────────────
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

// ─── ANSI 256 → CSS RGB ─────────────────────────────────────
function ansi256ToRgb(idx) {
  if (idx === 0) return null; // transparent
  if (idx < 16) {
    // System colors (basic 16)
    const basic = [
      [0,0,0],[128,0,0],[0,128,0],[128,128,0],[0,0,128],[128,0,128],[0,128,128],[192,192,192],
      [128,128,128],[255,0,0],[0,255,0],[255,255,0],[0,0,255],[255,0,255],[0,255,255],[255,255,255],
    ];
    return basic[idx];
  }
  if (idx < 232) {
    // Color cube 6×6×6
    const i = idx - 16;
    const r = Math.floor(i / 36);
    const g = Math.floor((i % 36) / 6);
    const b = i % 6;
    return [r ? r * 40 + 55 : 0, g ? g * 40 + 55 : 0, b ? b * 40 + 55 : 0];
  }
  // Grayscale ramp 232-255
  const v = (idx - 232) * 10 + 8;
  return [v, v, v];
}

// ─── Builder Sprites (complete stage only) ───────────────────
const builderComplete = {
  lines: [
    "...........1111111111...........",
    "..........19999999991...........",
    ".........1999999999991..........",
    ".........1999449944991..........",
    ".........1999999999991..........",
    "........122222222222221.........",
    ".......1222232222232221.........",
    "......12222556222556221.........",
    "......12222256222256221?........",
    "......12222227722272221.........",
    "......12228888888888221.........",
    ".....122288888888882211.........",
    ".....122288888888882211.........",
    "......12228888888882211.........",
    "......11228888882222211.........",
    ".......112222222222211..........",
    "......1122222222222222?.........",
    ".....12222222222222222211..44...",
    ".....12222223322222222211.44....",
    ".....12222223322222222211.4.....",
    ".....12299999999999999221.......",
    ".....12222222222222222221.......",
    ".....12222233222233222221.......",
    "......1222222222222222221.......",
    "......1222222222222222221.......",
    ".......12222211..12222221.......",
    ".......11222211..11222211.......",
    "......111111111..111111111......",
    "......11..............1111......",
    "................................",
    "................................",
    "................................",
  ],
  variants: [
    { pixels: [
      { x: 10, y: 11, value: 8 }, { x: 11, y: 12, value: 8 },
      { x: 15, y: 11, value: 8 }, { x: 16, y: 12, value: 8 },
    ]},
    { pixels: [
      { x: 11, y: 11, value: 3 }, { x: 12, y: 12, value: 3 },
      { x: 14, y: 11, value: 3 }, { x: 15, y: 12, value: 3 },
    ]},
  ],
  eyePositions: [[7, 7], [7, 16], [8, 7], [8, 16]],
  gesturePixels: [
    [17, 5], [17, 25], [18, 4], [18, 26],
    [17, 27], [17, 28], [18, 27],
  ],
};

const builderPalette = {
  colors: [0, 136, 208, 214, 220, 255, 16, 204, 178, 130],
};

// ─── Resolve sprite (port of resolve.ts) ─────────────────────
function parseLines(lines) {
  return lines.map((line) =>
    Array.from(line, (ch) => {
      if (ch === "." || ch === " ") return 0;
      if (ch === "?") return 0;
      const n = parseInt(ch, 10);
      return Number.isNaN(n) ? 0 : n;
    }),
  );
}

function shiftColor(base, prng) {
  if (base < 16 || base > 231) return base;
  const offset = Math.floor(prng() * 3) - 1;
  const shifted = base + offset * 6;
  if (shifted < 16 || shifted > 231) return base;
  return shifted;
}

function applyVariants(canvas, sprite, prng, palette) {
  if (sprite.variants.length > 0) {
    const variantIdx = Math.floor(prng() * sprite.variants.length);
    const variant = sprite.variants[variantIdx];
    for (const px of variant.pixels) {
      if (px.y >= 0 && px.y < canvas.length && px.x >= 0 && px.x < canvas[px.y].length) {
        canvas[px.y][px.x] = px.value;
      }
    }
  }
  for (let y = 0; y < sprite.lines.length; y++) {
    for (let x = 0; x < sprite.lines[y].length; x++) {
      if (sprite.lines[y][x] === "?") {
        if (prng() > 0.5) {
          canvas[y][x] = prng() > 0.5 ? 8 : 9;
        }
      }
    }
  }
  const mutableColors = [...palette.colors];
  if (mutableColors.length > 8) mutableColors[8] = shiftColor(palette.colors[8], prng);
  if (mutableColors.length > 9) mutableColors[9] = shiftColor(palette.colors[9], prng);
  return { canvas, palette: { colors: mutableColors } };
}

function centerCanvas(source, targetWidth, targetHeight) {
  const srcH = source.length;
  const srcW = srcH > 0 ? source[0].length : 0;
  const offsetY = Math.max(0, Math.floor((targetHeight - srcH) / 2));
  const offsetX = Math.max(0, Math.floor((targetWidth - srcW) / 2));
  const result = Array.from({ length: targetHeight }, () =>
    Array.from({ length: targetWidth }, () => 0),
  );
  for (let y = 0; y < srcH; y++) {
    for (let x = 0; x < srcW; x++) {
      const ty = y + offsetY;
      const tx = x + offsetX;
      if (ty < targetHeight && tx < targetWidth) {
        result[ty][tx] = source[y][x];
      }
    }
  }
  return result;
}

function applyMotifs(canvas, prng, progress) {
  const result = canvas.map((row) => [...row]);
  const intensity = progress * 0.10;
  for (let y = 0; y < result.length; y++) {
    for (let x = 0; x < result[y].length; x++) {
      const val = result[y][x];
      if ((val === 2 || val === 3) && prng() < intensity) {
        result[y][x] = prng() > 0.5 ? 8 : 9;
      }
    }
  }
  return result;
}

function resolveAndRender(seed, canvasWidth, canvasHeight) {
  const prng = createPrng(seed);
  const pixelHeight = canvasHeight * 2;

  const parsed = parseLines(builderComplete.lines);
  const { canvas: varied, palette: adjustedPalette } = applyVariants(
    parsed, builderComplete, prng, builderPalette,
  );
  const centered = centerCanvas(varied, canvasWidth, pixelHeight);
  const motifed = applyMotifs(centered, prng, 1.0);

  return { pixels: motifed, palette: adjustedPalette };
}

// ─── Generate 5 pets ─────────────────────────────────────────
const CANVAS_W = 32;
const CANVAS_H = 16;
const PIXEL_SIZE = 8; // CSS pixels per pixel

const petIds = [
  "pet-alpha-001",
  "pet-beta-002",
  "pet-gamma-003",
  "pet-delta-004",
  "pet-epsilon-005",
];

const pets = petIds.map((petId) => {
  const seed = sha256(`myhost:${petId}`);
  const { pixels, palette } = resolveAndRender(seed, CANVAS_W, CANVAS_H);
  return { petId, seed: seed.slice(0, 12), pixels, palette };
});

// ─── Render HTML ─────────────────────────────────────────────
function renderPixelGrid(pixels, palette, pixelSize) {
  let html = `<div style="display:inline-grid;grid-template-columns:repeat(${pixels[0].length},${pixelSize}px);gap:0;line-height:0;">`;
  for (let y = 0; y < pixels.length; y++) {
    for (let x = 0; x < pixels[y].length; x++) {
      const val = pixels[y][x];
      const rgb = ansi256ToRgb(palette.colors[val]);
      const color = rgb ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` : "transparent";
      html += `<div style="width:${pixelSize}px;height:${pixelSize}px;background:${color};"></div>`;
    }
  }
  html += `</div>`;
  return html;
}

let htmlContent = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>Tomotoken - 同パラメータ5体比較</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #1a1a2e;
    color: #e0e0e0;
    font-family: 'Courier New', monospace;
    padding: 40px;
  }
  h1 {
    text-align: center;
    font-size: 24px;
    margin-bottom: 8px;
    color: #ffd700;
  }
  .subtitle {
    text-align: center;
    font-size: 14px;
    color: #888;
    margin-bottom: 40px;
  }
  .pet-grid {
    display: flex;
    justify-content: center;
    gap: 32px;
    flex-wrap: wrap;
  }
  .pet-card {
    background: #16213e;
    border: 1px solid #333;
    border-radius: 12px;
    padding: 20px;
    text-align: center;
    width: ${CANVAS_W * PIXEL_SIZE + 40}px;
  }
  .pet-card h3 {
    font-size: 13px;
    color: #aaa;
    margin-bottom: 12px;
  }
  .pixel-art {
    display: flex;
    justify-content: center;
    margin-bottom: 12px;
    background: #0f0f23;
    border-radius: 8px;
    padding: 8px;
  }
  .pet-card .seed {
    font-size: 10px;
    color: #555;
    word-break: break-all;
  }
  .info {
    text-align: center;
    margin-top: 40px;
    padding: 20px;
    background: #16213e;
    border-radius: 8px;
    max-width: 800px;
    margin-left: auto;
    margin-right: auto;
  }
  .info h2 { font-size: 16px; color: #ffd700; margin-bottom: 12px; }
  .info p { font-size: 13px; color: #aaa; line-height: 1.6; }
  .info .highlight { color: #ff6b6b; font-weight: bold; }
  .palette-row {
    display: flex;
    justify-content: center;
    gap: 4px;
    margin-top: 8px;
  }
  .palette-swatch {
    width: 16px;
    height: 16px;
    border-radius: 2px;
    border: 1px solid #333;
  }
</style>
</head>
<body>

<h1>Tomotoken: Same Archetype, Different Seeds</h1>
<p class="subtitle">archetype = "builder" | progress = 1.0 (complete) | canvas = ${CANVAS_W}x${CANVAS_H * 2}px</p>

<div class="pet-grid">
`;

for (const pet of pets) {
  const paletteSwatches = pet.palette.colors.map((c, i) => {
    const rgb = ansi256ToRgb(c);
    const bg = rgb ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` : "transparent";
    return `<div class="palette-swatch" style="background:${bg};" title="[${i}] ANSI ${c}"></div>`;
  }).join("");

  htmlContent += `
  <div class="pet-card">
    <h3>${pet.petId}</h3>
    <div class="pixel-art">
      ${renderPixelGrid(pet.pixels, pet.palette, PIXEL_SIZE)}
    </div>
    <div class="palette-row">${paletteSwatches}</div>
    <p class="seed">seed: ${pet.seed}...</p>
  </div>
`;
}

htmlContent += `
</div>

<div class="info">
  <h2>What You're Seeing</h2>
  <p>
    All 5 pets share the <span class="highlight">same archetype (builder)</span>,
    <span class="highlight">same progress (1.0 / complete)</span>, and
    <span class="highlight">same personality parameters</span>.
    The only difference is the pet ID, which produces a different SHA-256 seed.
  </p>
  <p style="margin-top: 12px;">
    The PRNG seed drives: variant selection (beard detail positions),
    '?' pixel fill (50% chance), accent color shifts (ANSI ±6),
    and motif overlays (10% body pixel accent swap).
  </p>
  <p style="margin-top: 12px;">
    Notice: the <span class="highlight">overall silhouette is identical</span> across all 5.
    Variations are limited to minor color shifts and small pixel detail differences.
    This is the diversity problem that LLM generation addresses.
  </p>
</div>

</body>
</html>`;

writeFileSync("5pets-preview.html", htmlContent, "utf-8");
console.log("Written: 5pets-preview.html");
console.log(`Generated ${pets.length} builder pets at progress=1.0`);
for (const pet of pets) {
  console.log(`  ${pet.petId} → seed=${pet.seed}... palette[8]=${pet.palette.colors[8]} palette[9]=${pet.palette.colors[9]}`);
}
