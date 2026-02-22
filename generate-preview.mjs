/**
 * Generate an HTML preview of all 8 archetypes × 5 growth stages.
 * Run: node generate-preview.mjs
 * Output: sprite-preview.html
 */
import fs from 'fs';

// --- ANSI 256 → RGB conversion ---
const ANSI_STANDARD = [
  [0,0,0],[128,0,0],[0,128,0],[128,128,0],[0,0,128],[128,0,128],[0,128,128],[192,192,192],
  [128,128,128],[255,0,0],[0,255,0],[255,255,0],[0,0,255],[255,0,255],[0,255,255],[255,255,255],
];
const CUBE_VALUES = [0, 95, 135, 175, 215, 255];

function ansi256ToRgb(idx) {
  if (idx < 16) return ANSI_STANDARD[idx];
  if (idx < 232) {
    const n = idx - 16;
    const r = Math.floor(n / 36);
    const g = Math.floor((n % 36) / 6);
    const b = n % 6;
    return [CUBE_VALUES[r], CUBE_VALUES[g], CUBE_VALUES[b]];
  }
  const gray = 8 + 10 * (idx - 232);
  return [gray, gray, gray];
}

function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

// --- Parse sprite data from .ts files ---
function parseSpritesFromFile(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');

  // Extract palette colors
  const paletteMatch = content.match(/colors:\s*\[([\d,\s]+)\]/);
  const palette = paletteMatch
    ? paletteMatch[1].split(',').map(s => parseInt(s.trim(), 10))
    : [];

  // Extract all lines arrays (5 stages: EGG, INFANT, CHILD, YOUTH, COMPLETE)
  const stageNames = ['Egg', 'Infant', 'Child', 'Youth', 'Complete'];
  const stages = [];
  const regex = /const\s+(\w+):\s*SpriteDef\s*=\s*\{[\s\S]*?lines:\s*\[([\s\S]*?)\]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const linesBlock = match[2];
    const lines = [...linesBlock.matchAll(/"([^"]*)"/g)].map(m => m[1]);
    stages.push(lines);
  }

  return { palette, stages, stageNames };
}

// --- Render a single stage to HTML pixel grid ---
function renderStage(lines, palette, pixelSize) {
  const height = lines.length;
  const width = lines[0]?.length || 0;

  let html = `<div style="display:inline-grid;grid-template-columns:repeat(${width},${pixelSize}px);gap:0;border:1px solid #333;background:#1a1a2e;">`;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ch = lines[y]?.[x] || '.';
      let color = 'transparent';

      if (ch !== '.' && ch !== ' ' && ch !== '?') {
        const idx = parseInt(ch, 10);
        if (!isNaN(idx) && idx > 0 && idx < palette.length) {
          const ansiColor = palette[idx];
          color = rgbToHex(ansi256ToRgb(ansiColor));
        }
      } else if (ch === '?') {
        // Variant pixel - show as semi-transparent accent
        const ansiColor = palette[8] || 128;
        const [r, g, b] = ansi256ToRgb(ansiColor);
        color = `rgba(${r},${g},${b},0.4)`;
      }

      html += `<div style="width:${pixelSize}px;height:${pixelSize}px;background:${color};"></div>`;
    }
  }

  html += '</div>';
  return html;
}

// --- Main ---
const archetypes = [
  { file: 'builder', name: 'Builder', desc: 'Dwarf — Stocky, Helmet, Hammer, Beard' },
  { file: 'fixer', name: 'Fixer', desc: 'Goblin — Thin, Big Ears, Goggles, Wrench' },
  { file: 'scholar', name: 'Scholar', desc: 'Wizard — Pointy Hat, Robes, Book, Staff' },
  { file: 'guardian', name: 'Guardian', desc: 'Knight — Plumed Helmet, Armor, Shield, Cape' },
  { file: 'refiner', name: 'Refiner', desc: 'Elf — Long Ears, Flowing Cloak, Staff' },
  { file: 'scribe', name: 'Scribe', desc: 'Halfling — Glasses, Curly Hair, Quill, Scroll' },
  { file: 'architect', name: 'Architect', desc: 'Golem — Massive, Stone Cracks, Blueprint' },
  { file: 'operator', name: 'Operator', desc: 'Cyborg — Antenna, Visor, Mech Arm, Gears' },
];

const stageLabels = ['Stage 0: Egg', 'Stage 1: Infant', 'Stage 2: Child', 'Stage 3: Youth', 'Stage 4: Complete'];

let body = '';

for (const arch of archetypes) {
  const filepath = `src/art/pixel/${arch.file}.ts`;
  const { palette, stages } = parseSpritesFromFile(filepath);

  // Convert palette to hex for legend
  const paletteHex = palette.map((ansi, i) => ({
    index: i,
    ansi,
    hex: i === 0 ? 'transparent' : rgbToHex(ansi256ToRgb(ansi)),
  }));

  body += `
    <div class="archetype">
      <h2>${arch.name} <span class="desc">${arch.desc}</span></h2>
      <div class="palette-bar">
        ${paletteHex.map(p => `<div class="palette-swatch" title="[${p.index}] ANSI ${p.ansi}" style="background:${p.hex};${p.index === 0 ? 'border:1px dashed #555;' : ''}"><span>${p.index}</span></div>`).join('')}
      </div>
      <div class="stages">
        ${stages.map((lines, i) => `
          <div class="stage">
            <h3>${stageLabels[i] || 'Stage ' + i}</h3>
            <div class="size-label">${lines[0]?.length || 0}×${lines.length}px</div>
            ${renderStage(lines, palette, i <= 1 ? 8 : i <= 2 ? 6 : i <= 3 ? 5 : 4)}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>Tomotoken Sprite Preview — All Archetypes × 5 Stages</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0d0d1a;
    color: #e0e0e0;
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    padding: 24px;
  }
  h1 {
    text-align: center;
    font-size: 28px;
    margin-bottom: 8px;
    color: #fff;
  }
  .subtitle {
    text-align: center;
    color: #888;
    margin-bottom: 32px;
    font-size: 14px;
  }
  .archetype {
    background: #16162a;
    border: 1px solid #2a2a4a;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 24px;
  }
  .archetype h2 {
    font-size: 20px;
    margin-bottom: 8px;
    color: #ffd700;
  }
  .archetype h2 .desc {
    font-size: 14px;
    color: #888;
    font-weight: normal;
  }
  .palette-bar {
    display: flex;
    gap: 4px;
    margin-bottom: 16px;
  }
  .palette-swatch {
    width: 32px;
    height: 32px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: #fff;
    text-shadow: 0 0 2px #000, 0 0 4px #000;
    cursor: default;
  }
  .stages {
    display: flex;
    gap: 24px;
    align-items: flex-end;
    overflow-x: auto;
    padding-bottom: 8px;
  }
  .stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
  }
  .stage h3 {
    font-size: 12px;
    color: #aaa;
    margin-bottom: 4px;
  }
  .size-label {
    font-size: 10px;
    color: #666;
    margin-bottom: 6px;
  }
</style>
</head>
<body>
  <h1>Tomotoken Sprite Preview</h1>
  <p class="subtitle">8 Archetypes × 5 Growth Stages — 32×32 Pixel Art (ANSI 256 Palette)</p>
  ${body}
</body>
</html>`;

fs.writeFileSync('sprite-preview.html', html);
console.log('Generated: sprite-preview.html');
