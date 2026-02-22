/**
 * Generate 3 pets per archetype (8 archetypes × 3 = 24 total)
 * at final form (progress=1.0) and render to HTML.
 *
 * Usage: node generate-all-archetypes.mjs
 * Output: all-archetypes-preview.html
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

// ─── PRNG ────────────────────────────────────────────────────
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
  if (idx === 0) return null;
  if (idx < 16) {
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
    return [r ? r * 40 + 55 : 0, g ? g * 40 + 55 : 0, b ? b * 40 + 55 : 0];
  }
  const v = (idx - 232) * 10 + 8;
  return [v, v, v];
}

// ─── All 8 archetypes: Complete stage + palette ──────────────
const ARCHETYPES = {
  builder: {
    name: "Builder",
    desc: "Dwarf — helmet, hammer, braided beard",
    palette: { colors: [0, 136, 208, 214, 220, 255, 16, 204, 178, 130] },
    complete: {
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
        { pixels: [{ x: 10, y: 11, value: 8 }, { x: 11, y: 12, value: 8 }, { x: 15, y: 11, value: 8 }, { x: 16, y: 12, value: 8 }] },
        { pixels: [{ x: 11, y: 11, value: 3 }, { x: 12, y: 12, value: 3 }, { x: 14, y: 11, value: 3 }, { x: 15, y: 12, value: 3 }] },
      ],
      eyePositions: [[7, 7], [7, 16], [8, 7], [8, 16]],
      gesturePixels: [[17, 5], [17, 25], [18, 4], [18, 26], [17, 27], [17, 28], [18, 27]],
    },
  },
  fixer: {
    name: "Fixer",
    desc: "Goblin Engineer — big ears, goggles, wrench",
    palette: { colors: [0, 52, 196, 160, 124, 255, 16, 204, 88, 247] },
    complete: {
      lines: [
        "............111111111...........",
        "...........188888881............",
        "..........18822288281...........",
        ".........1122222222211..........",
        "........11222222222221..........",
        ".......1122222222222211.........",
        "...33311122556222556211.........",
        "...333112222772222221?..........",
        "....11222222222222221?..........",
        "....12222222222222221?..333.....",
        ".....1222222222221?11..3333.....",
        ".....12223232221?11.............",
        "......12222222211...............",
        ".....122222222221?..............",
        ".....129999999221.9.............",
        ".....122222222221.9.............",
        ".....122222222221.9.............",
        ".....122222222221.9.............",
        "......1222222221..9.............",
        "......12222222119...............",
        ".....112222221199...............",
        ".....112..1221199...............",
        "......11...111.9................",
        "....1111....1111................",
        "....11........11................",
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
      ],
      variants: [
        { pixels: [{ x: 10, y: 7, value: 7 }, { x: 11, y: 7, value: 7 }, { x: 10, y: 11, value: 4 }, { x: 11, y: 11, value: 4 }] },
        { pixels: [{ x: 9, y: 7, value: 7 }, { x: 12, y: 7, value: 7 }, { x: 10, y: 11, value: 3 }, { x: 11, y: 11, value: 3 }] },
      ],
      eyePositions: [[6, 9], [6, 14]],
      gesturePixels: [[14, 18], [15, 18], [16, 18], [17, 18], [13, 5], [14, 5]],
    },
  },
  refiner: {
    name: "Refiner",
    desc: "Elf — tall, slender, pointed ears, cloak, staff",
    palette: { colors: [0, 141, 177, 213, 147, 255, 16, 204, 183, 220] },
    complete: {
      lines: [
        "..............1111..............",
        ".............122221.............",
        "............1222222?............",
        "...........122222221............",
        "..........12222222221...........",
        ".........1222222222221..........",
        "........112222222222221.........",
        "4......1122556222255621.........",
        "..4...112222227722222211........",
        "......12222222222222221?........",
        ".......12222222222222211........",
        "........1122222222222211........",
        ".........12222222222211.........",
        "........812232232218?...........",
        "........81222222221899..........",
        ".......881222222218..99.........",
        "......888122222221888.99........",
        "......881222222222188..99.......",
        ".....8881222222222188..99.......",
        ".....888122222222218...9........",
        "......88812222222218..9.........",
        ".......88112222211889...........",
        ".........11222211889............",
        "..........11..118...............",
        ".........11....11...............",
        "........11......11..............",
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
      ],
      variants: [
        { pixels: [{ x: 10, y: 13, value: 3 }, { x: 13, y: 13, value: 3 }, { x: 6, y: 16, value: 8 }, { x: 7, y: 17, value: 8 }] },
        { pixels: [{ x: 11, y: 13, value: 4 }, { x: 12, y: 13, value: 4 }, { x: 5, y: 18, value: 8 }, { x: 6, y: 19, value: 8 }] },
      ],
      eyePositions: [[7, 7], [7, 16]],
      gesturePixels: [[15, 6], [15, 20], [16, 5], [16, 19], [14, 21], [14, 22], [15, 23], [16, 24], [17, 25], [18, 25], [19, 24]],
    },
  },
  scholar: {
    name: "Scholar",
    desc: "Wizard — pointy hat with stars, robes, open book",
    palette: { colors: [0, 33, 39, 75, 111, 255, 16, 204, 69, 220] },
    complete: {
      lines: [
        "...............91...............",
        "..............1221..............",
        ".............122221.............",
        "............12222221............",
        "...........1229922221...........",
        "..........122222222221..........",
        ".........12292222292221.........",
        "........1222222222222221........",
        ".......122922222222922221.......",
        "......12222222222222222221......",
        ".....1222222222222222222221.....",
        "....192222222222222222222291....",
        "......12222222222222222221......",
        "......12225552222225552221......",
        "......12225652222225652221......",
        "......12225552222225552221......",
        "......12222222277222222221......",
        "......12222222222222222221......",
        ".......122222222222222221.......",
        ".......123322222222233221.......",
        "......12332222333222222221......",
        ".....1223322233322222222221.....",
        ".....1222322233222288222221.....",
        "....122232223322228882222221....",
        "....122222223322228882222221....",
        "....122222222222228882222221....",
        "....122222222222222222222221....",
        ".....1222222222222222222221.....",
        ".....1122222222222222222211.....",
        "......11222222222222222211......",
        ".......11222222..22222211.......",
        "........11............11........",
      ],
      variants: [
        { pixels: [{ x: 12, y: 4, value: 9 }, { x: 13, y: 4, value: 9 }, { x: 11, y: 6, value: 9 }, { x: 19, y: 6, value: 9 }] },
        { pixels: [{ x: 16, y: 4, value: 9 }, { x: 17, y: 4, value: 9 }, { x: 13, y: 8, value: 9 }, { x: 15, y: 8, value: 9 }] },
      ],
      eyePositions: [[14, 11], [14, 20]],
      gesturePixels: [[20, 7], [20, 24], [21, 6], [21, 25], [23, 18], [23, 19], [23, 20], [24, 18], [24, 19], [24, 20]],
    },
  },
  scribe: {
    name: "Scribe",
    desc: "Halfling — round, glasses, quill pen, scroll",
    palette: { colors: [0, 42, 114, 150, 186, 255, 16, 204, 78, 220] },
    complete: {
      lines: [
        "..........11111.................",
        ".........144441?................",
        "........144444?1................",
        "........144444441...............",
        ".......12222222221..............",
        "......1222222222221.............",
        ".....1228856228856?.............",
        ".....1228856228856199...........",
        ".....12222277222219.9...........",
        "......1222222222211.99..........",
        "......1222222222211.............",
        ".....12222332222219.99..........",
        ".....12222222222219.99..........",
        ".....12222222222219.99..........",
        ".....12222222222219.9...........",
        ".....1222222222221.99...........",
        "......1122222222119..9..........",
        "......1122..22211..99...........",
        "......112....2211...............",
        "......111....1111...............",
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
      ],
      variants: [
        { pixels: [{ x: 6, y: 1, value: 4 }, { x: 7, y: 1, value: 4 }, { x: 5, y: 2, value: 4 }, { x: 11, y: 2, value: 4 }] },
        { pixels: [{ x: 7, y: 1, value: 3 }, { x: 8, y: 1, value: 4 }, { x: 6, y: 2, value: 3 }, { x: 10, y: 2, value: 4 }] },
      ],
      eyePositions: [[6, 6], [6, 12], [7, 6], [7, 12]],
      gesturePixels: [[8, 17], [8, 18], [11, 18], [12, 18], [13, 18], [14, 18], [11, 19], [12, 19], [13, 19], [14, 19], [15, 18], [15, 19]],
    },
  },
  architect: {
    name: "Architect",
    desc: "Golem — massive boxy body, stone cracks, blueprint",
    palette: { colors: [0, 148, 226, 220, 184, 255, 16, 190, 148, 39] },
    complete: {
      lines: [
        "........1111111111..............",
        ".......12223232232?.............",
        "......122232222322321...........",
        "......122222222222221...........",
        ".....1222222222222221...........",
        "....12222562222562221...........",
        "....12222226772222221...........",
        "....12222222222222221...........",
        ".....12222222222222211..........",
        "....1123223223223211?...........",
        "...12223222322232222211.........",
        "..122232223222232222221.........",
        ".1222322232222322322221.........",
        ".1222232222232222232221.........",
        ".1222223222222322222221.9.......",
        ".1222222232222223222221.99......",
        ".1222222222322222232221.99......",
        ".1222222222223222222221.99......",
        ".1222222222222232222221.99......",
        ".1222232222222222322221.9.......",
        "..12222222222222222221..........",
        "..11222222222222222211..........",
        "..11222222211222222211..........",
        "..11222222111222222211..........",
        "..11111111111111111111..........",
        "..1111111111.111111111..........",
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
      ],
      variants: [
        { pixels: [{ x: 9, y: 9, value: 8 }, { x: 13, y: 9, value: 8 }, { x: 11, y: 12, value: 8 }, { x: 15, y: 13, value: 8 }] },
        { pixels: [{ x: 10, y: 9, value: 8 }, { x: 14, y: 9, value: 8 }, { x: 12, y: 12, value: 8 }, { x: 14, y: 13, value: 8 }] },
      ],
      eyePositions: [[5, 6], [5, 14]],
      gesturePixels: [[14, 24], [15, 24], [15, 25], [16, 24], [16, 25], [17, 24], [17, 25], [18, 24], [18, 25], [12, 1], [13, 1]],
    },
  },
  operator: {
    name: "Operator",
    desc: "Cyborg — antenna, glowing visor, mechanical arm",
    palette: { colors: [0, 241, 247, 250, 253, 255, 39, 244, 33, 196] },
    complete: {
      lines: [
        "...........9911.................",
        "..........199911................",
        ".........111111111..............",
        "........12222222221.............",
        ".......1222222222221............",
        "......122244444222211...........",
        "......122256666522211...........",
        "......122266666622211...........",
        "......122222772222211...........",
        "......122222222222211...........",
        ".......12222222222211...........",
        "......1122222222228811..........",
        ".....1222233222288188?1.........",
        ".....1229999992288?888?.........",
        ".....1222233222288?888?.........",
        ".....1222233222288?888?.........",
        ".....12222222222888881..........",
        "......1222222221188811..........",
        "......11222221111.8811..........",
        "......112..2111..18811..........",
        ".....1111..1111..11111..........",
        ".....111....111...1111..........",
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
      ],
      variants: [
        { pixels: [{ x: 9, y: 8, value: 7 }, { x: 10, y: 8, value: 7 }, { x: 14, y: 13, value: 9 }, { x: 15, y: 14, value: 9 }] },
        { pixels: [{ x: 8, y: 8, value: 7 }, { x: 11, y: 8, value: 7 }, { x: 15, y: 13, value: 9 }, { x: 14, y: 14, value: 9 }] },
      ],
      eyePositions: [[6, 7], [7, 7]],
      gesturePixels: [[12, 5], [13, 5], [11, 22], [12, 23], [13, 24], [14, 24], [15, 24]],
    },
  },
  guardian: {
    name: "Guardian",
    desc: "Knight — plate armor, plumed helmet, shield",
    palette: { colors: [0, 24, 30, 66, 102, 255, 16, 138, 220, 196] },
    complete: {
      lines: [
        "...........9999.................",
        "..........999991................",
        ".........91333311...............",
        "........113333331?..............",
        "........1333733331..............",
        "........1333333331..............",
        "........13333333331.............",
        ".......1222222222221............",
        "......12225622225621............",
        "......12227777222221............",
        "......12222222222221............",
        ".......12222222221..............",
        "......12233333221?..............",
        ".....122333333322?1.............",
        ".....122233333222211............",
        "....1222233332222.1188..........",
        "....1222222222222.18881.........",
        "....1222222222222.18881.........",
        "....1222222222222.18881.........",
        ".....12222222222211881..........",
        ".....112222211222211............",
        ".....1112221..1222211...........",
        ".....1111111..11111111..........",
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
      ],
      variants: [
        { pixels: [{ x: 9, y: 4, value: 3 }, { x: 10, y: 4, value: 7 }, { x: 11, y: 12, value: 4 }, { x: 12, y: 13, value: 4 }] },
        { pixels: [{ x: 10, y: 4, value: 7 }, { x: 11, y: 4, value: 3 }, { x: 12, y: 12, value: 4 }, { x: 13, y: 13, value: 4 }] },
      ],
      eyePositions: [[8, 6], [8, 14]],
      gesturePixels: [[16, 1], [17, 1], [18, 1], [19, 1], [15, 18], [16, 18], [17, 18], [18, 18], [0, 11], [0, 12], [0, 13], [1, 10], [1, 11]],
    },
  },
};

// ─── Sprite resolution (port of resolve.ts) ──────────────────
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

function resolveAndRender(archetypeKey, seed, canvasWidth, canvasHeight) {
  const prng = createPrng(seed);
  const pixelHeight = canvasHeight * 2;
  const arch = ARCHETYPES[archetypeKey];
  const parsed = parseLines(arch.complete.lines);
  const { canvas: varied, palette: adjustedPalette } = applyVariants(
    parsed, arch.complete, prng, arch.palette,
  );
  const centered = centerCanvas(varied, canvasWidth, pixelHeight);
  const motifed = applyMotifs(centered, prng, 1.0);
  return { pixels: motifed, palette: adjustedPalette };
}

// ─── Generate ────────────────────────────────────────────────
const CANVAS_W = 32;
const CANVAS_H = 16;
const PIXEL_SIZE = 6;
const PETS_PER_ARCH = 3;

const results = [];
for (const [key, arch] of Object.entries(ARCHETYPES)) {
  const pets = [];
  for (let i = 0; i < PETS_PER_ARCH; i++) {
    const petId = `${key}-pet-${i + 1}`;
    const seed = sha256(`myhost:${petId}:variation-${i}`);
    const { pixels, palette } = resolveAndRender(key, seed, CANVAS_W, CANVAS_H);
    pets.push({ petId, seed: seed.slice(0, 8), pixels, palette });
  }
  results.push({ key, name: arch.name, desc: arch.desc, basePalette: arch.palette, pets });
}

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

let html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>Tomotoken - 全8種族 × 3体 比較</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0f0f1a;
    color: #e0e0e0;
    font-family: 'Courier New', monospace;
    padding: 32px;
  }
  h1 {
    text-align: center;
    font-size: 22px;
    margin-bottom: 6px;
    color: #ffd700;
  }
  .subtitle {
    text-align: center;
    font-size: 13px;
    color: #666;
    margin-bottom: 32px;
  }
  .archetype-section {
    margin-bottom: 36px;
    background: #141428;
    border: 1px solid #222;
    border-radius: 12px;
    padding: 20px;
  }
  .archetype-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
  }
  .archetype-header h2 {
    font-size: 16px;
    color: #e8e8ff;
    margin: 0;
  }
  .archetype-header .desc {
    font-size: 12px;
    color: #888;
  }
  .palette-row {
    display: flex;
    gap: 3px;
    margin-left: auto;
  }
  .palette-swatch {
    width: 14px;
    height: 14px;
    border-radius: 2px;
    border: 1px solid #333;
  }
  .pets-row {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
  }
  .pet-card {
    text-align: center;
  }
  .pet-card .pixel-art {
    background: #0a0a16;
    border-radius: 8px;
    padding: 6px;
    display: inline-block;
  }
  .pet-card .label {
    font-size: 9px;
    color: #555;
    margin-top: 6px;
  }
  .pet-palette {
    display: flex;
    gap: 2px;
    justify-content: center;
    margin-top: 4px;
  }
  .pet-palette .ps {
    width: 10px;
    height: 10px;
    border-radius: 1px;
    border: 1px solid #222;
  }
  .summary {
    text-align: center;
    margin-top: 36px;
    padding: 20px;
    background: #141428;
    border: 1px solid #222;
    border-radius: 10px;
    max-width: 900px;
    margin-left: auto;
    margin-right: auto;
  }
  .summary h2 { font-size: 15px; color: #ffd700; margin-bottom: 10px; }
  .summary p { font-size: 12px; color: #999; line-height: 1.7; }
  .hl { color: #ff6b6b; font-weight: bold; }
  .hl2 { color: #6bf; font-weight: bold; }
</style>
</head>
<body>

<h1>Tomotoken: All Archetypes Preview</h1>
<p class="subtitle">8 archetypes x 3 seeds each | progress = 1.0 (complete) | procedural generation</p>
`;

for (const arch of results) {
  const basePaletteHtml = arch.basePalette.colors.map((c, i) => {
    const rgb = ansi256ToRgb(c);
    const bg = rgb ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` : "transparent";
    return `<div class="palette-swatch" style="background:${bg};" title="[${i}] ANSI ${c}"></div>`;
  }).join("");

  html += `
<div class="archetype-section">
  <div class="archetype-header">
    <h2>${arch.name}</h2>
    <span class="desc">${arch.desc}</span>
    <div class="palette-row">${basePaletteHtml}</div>
  </div>
  <div class="pets-row">
`;

  for (const pet of arch.pets) {
    const petPaletteHtml = pet.palette.colors.slice(8, 10).map((c, i) => {
      const rgb = ansi256ToRgb(c);
      const bg = rgb ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` : "transparent";
      return `<div class="ps" style="background:${bg};" title="accent[${i + 8}] ANSI ${c}"></div>`;
    }).join("");

    html += `
    <div class="pet-card">
      <div class="pixel-art">
        ${renderPixelGrid(pet.pixels, pet.palette, PIXEL_SIZE)}
      </div>
      <div class="label">${pet.seed}...</div>
      <div class="pet-palette">${petPaletteHtml}</div>
    </div>
`;
  }

  html += `
  </div>
</div>
`;
}

html += `
<div class="summary">
  <h2>Observations</h2>
  <p>
    <span class="hl">Same archetype = same silhouette.</span>
    Each row of 3 pets shares identical body shape. Seed-driven variation is limited to:
    minor accent color shifts (palette[8], [9] offset by ANSI ±6),
    variant pixel positions (2 options), '?' pixel fills (50% chance),
    and motif overlays (10% body pixel swap).
  </p>
  <p style="margin-top: 8px;">
    <span class="hl2">Cross-archetype diversity is good</span> — 8 distinct silhouettes.
    But within each archetype, the visual difference is minimal.
    A user who consistently gets "builder" will see nearly identical pets every time.
  </p>
  <p style="margin-top: 8px;">
    This is the problem that <span class="hl">LLM sprite generation</span> solves:
    by passing personality traits as natural language to Claude Haiku,
    every pet gets a unique silhouette while still fitting the archetype theme.
  </p>
</div>

</body>
</html>`;

writeFileSync("all-archetypes-preview.html", html, "utf-8");
console.log("Written: all-archetypes-preview.html");
console.log(`Generated ${results.length} archetypes × ${PETS_PER_ARCH} pets = ${results.length * PETS_PER_ARCH} total`);
for (const arch of results) {
  const accents = arch.pets.map(p => `[${p.palette.colors[8]},${p.palette.colors[9]}]`).join(" ");
  console.log(`  ${arch.name.padEnd(10)} ${accents}`);
}
