/**
 * Generate 3 completed creatures (progress=1.0) and output an HTML preview.
 * Usage: npx tsx generate-3complete.mjs
 */
import { writeFileSync } from "node:fs";
import { renderArt } from "./src/art/renderer.js";
import { generateSeed } from "./src/art/seed.js";

// ANSI 256 → RGB conversion
function ansi256ToRgb(idx) {
  if (idx < 16) {
    const basic = [
      [0,0,0],[128,0,0],[0,128,0],[128,128,0],[0,0,128],[128,0,128],[0,128,128],[192,192,192],
      [128,128,128],[255,0,0],[0,255,0],[255,255,0],[0,0,255],[255,0,255],[0,255,255],[255,255,255],
    ];
    return basic[idx];
  }
  if (idx < 232) {
    const i = idx - 16;
    const vals = [0, 95, 135, 175, 215, 255];
    return [vals[Math.floor(i / 36)], vals[Math.floor((i % 36) / 6)], vals[i % 6]];
  }
  const gray = 8 + (idx - 232) * 10;
  return [gray, gray, gray];
}

const CANVAS_W = 32;
const CANVAS_H = 16;
const PIXEL_H = CANVAS_H * 2;

const creatures = [
  {
    name: "Builder",
    sub: "blade holder",
    seed: generateSeed("preview-machine", "creature-alpha"),
    traits: { builder: 90, fixer: 30, refiner: 20, scholar: 40, scribe: 10, architect: 50, operator: 15, guardian: 60 },
    depth: { editTestLoopCount: 40, repeatEditSameFileCount: 25, phaseSwitchCount: 15, totalSessions: 10 },
    style: { bulletRatio: 0.2, questionRatio: 0.1, codeblockRatio: 0.4, avgMessageLen: 120, messageLenStd: 30, headingRatio: 0.1 },
    usageMix: { impl: 0.5, fix: 0.2, refactor: 0.1, test: 0.1, docs: 0.1 },
    tokenRatio: 1.5,
  },
  {
    name: "Scholar",
    sub: "orb holder",
    seed: generateSeed("preview-machine", "creature-beta"),
    traits: { builder: 20, fixer: 15, refiner: 70, scholar: 95, scribe: 80, architect: 30, operator: 10, guardian: 10 },
    depth: { editTestLoopCount: 5, repeatEditSameFileCount: 3, phaseSwitchCount: 2, totalSessions: 8 },
    style: { bulletRatio: 0.4, questionRatio: 0.3, codeblockRatio: 0.1, avgMessageLen: 200, messageLenStd: 60, headingRatio: 0.3 },
    usageMix: { docs: 0.6, impl: 0.1, fix: 0.05, refactor: 0.15, test: 0.1 },
    tokenRatio: 0.3,
  },
  {
    name: "Guardian",
    sub: "shield holder",
    seed: generateSeed("preview-machine", "creature-gamma"),
    traits: { builder: 40, fixer: 60, refiner: 30, scholar: 20, scribe: 25, architect: 70, operator: 50, guardian: 95 },
    depth: { editTestLoopCount: 20, repeatEditSameFileCount: 15, phaseSwitchCount: 8, totalSessions: 12 },
    style: { bulletRatio: 0.15, questionRatio: 0.05, codeblockRatio: 0.3, avgMessageLen: 80, messageLenStd: 20, headingRatio: 0.05 },
    usageMix: { fix: 0.4, impl: 0.3, test: 0.2, refactor: 0.05, docs: 0.05 },
    tokenRatio: 1.0,
  },
];

// Render all creatures
const results = creatures.map((c) => {
  const art = renderArt({
    seed: c.seed,
    progress: 1.0,
    traits: c.traits,
    depthMetrics: c.depth,
    styleMetrics: c.style,
    canvasWidth: CANVAS_W,
    canvasHeight: CANVAS_H,
    usageMix: c.usageMix,
    tokenRatio: c.tokenRatio,
  });
  return { ...c, art };
});

// Build pixel-art HTML for each frame using half-block rendering
function renderPixelHtml(pixelCanvas, palette, canvasW, pixelH) {
  const cssColors = palette.colors.map((idx) => {
    if (idx === 0) return "transparent";
    const [r, g, b] = ansi256ToRgb(idx);
    return `rgb(${r},${g},${b})`;
  });

  let html = "";
  for (let row = 0; row < pixelH; row += 2) {
    html += '<div class="row">';
    for (let col = 0; col < canvasW; col++) {
      const top = pixelCanvas[row]?.[col] ?? 0;
      const bot = pixelCanvas[row + 1]?.[col] ?? 0;
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
  return html;
}

// Build cards
let cardsHtml = "";
for (const r of results) {
  const { art, name, sub, traits } = r;

  // Palette swatches
  const swatches = art.palette.colors.slice(1).map((idx, i) => {
    const [rv, gv, bv] = ansi256ToRgb(idx);
    return `<span class="swatch" style="background:rgb(${rv},${gv},${bv})" title="Slot ${i + 1}"></span>`;
  }).join("");

  // Trait bars (sorted descending)
  const traitBars = Object.entries(traits)
    .sort(([, a], [, b]) => b - a)
    .map(([tid, val]) =>
      `<div class="trait"><span class="tn">${tid}</span><div class="tb"><div class="tf" style="width:${val}%"></div></div><span class="tv">${val}</span></div>`
    ).join("");

  // Pixel rendering
  const pixelHtml = renderPixelHtml(art.basePixelCanvas, art.palette, CANVAS_W, PIXEL_H);

  cardsHtml += `
    <div class="card">
      <div class="card-head">
        <div>
          <h2>${name}</h2>
          <span class="sub">${sub}</span>
        </div>
        <span class="badge stage">Stage ${art.limbStage}</span>
        <span class="badge complete">COMPLETE</span>
      </div>
      <div class="card-body">
        <div class="creature">${pixelHtml}</div>
        <div class="info">
          <h3>Traits</h3>
          ${traitBars}
          <h3>Palette</h3>
          <div class="palette">${swatches}</div>
          <h3>Seed</h3>
          <code class="seed">${r.seed.slice(0, 20)}...</code>
        </div>
      </div>
    </div>`;
}

const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tomotoken - 3 Completed Creatures</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0d1117;
    color: #e6edf3;
    padding: 2rem;
    min-height: 100vh;
  }
  h1 {
    text-align: center;
    font-size: 2.2rem;
    margin-bottom: 0.3rem;
    background: linear-gradient(135deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .subtitle {
    text-align: center;
    color: #8b949e;
    margin-bottom: 2.5rem;
    font-size: 0.9rem;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(460px, 1fr));
    gap: 1.5rem;
    max-width: 1500px;
    margin: 0 auto;
  }
  .card {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 14px;
    overflow: hidden;
    transition: transform 0.2s, border-color 0.2s;
  }
  .card:hover { transform: translateY(-3px); border-color: #58a6ff; }
  .card-head {
    padding: 1rem 1.3rem;
    border-bottom: 1px solid #21262d;
    display: flex;
    align-items: center;
    gap: 0.8rem;
  }
  .card-head > div { flex: 1; }
  .card-head h2 { font-size: 1.15rem; margin-bottom: 2px; }
  .sub { font-size: 0.8rem; color: #8b949e; }
  .badge {
    padding: 3px 12px;
    border-radius: 14px;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .stage { background: #1f6feb; color: #fff; }
  .complete { background: #238636; color: #fff; }
  .card-body {
    padding: 1.3rem;
    display: flex;
    gap: 1.3rem;
  }
  .creature {
    background: #0d1117;
    border-radius: 10px;
    padding: 10px 12px;
    flex-shrink: 0;
    line-height: 1;
    border: 1px solid #21262d;
  }
  .row { white-space: pre; height: 1.08em; line-height: 1.08; }
  .px {
    font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
    font-size: 14px;
    letter-spacing: 0;
  }
  .info { flex: 1; min-width: 0; }
  .info h3 {
    font-size: 0.75rem;
    color: #8b949e;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 1rem 0 0.4rem;
  }
  .info h3:first-child { margin-top: 0; }
  .trait {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 3px 0;
    font-size: 0.78rem;
  }
  .tn { width: 62px; text-align: right; color: #8b949e; }
  .tb {
    flex: 1;
    height: 7px;
    background: #21262d;
    border-radius: 4px;
    overflow: hidden;
  }
  .tf {
    height: 100%;
    background: linear-gradient(90deg, #238636, #3fb950);
    border-radius: 4px;
  }
  .tv { width: 24px; font-size: 0.72rem; color: #8b949e; }
  .palette { display: flex; gap: 5px; flex-wrap: wrap; }
  .swatch {
    width: 22px;
    height: 22px;
    border-radius: 5px;
    border: 1px solid #30363d;
    display: inline-block;
  }
  .seed {
    font-size: 0.7rem;
    color: #58a6ff;
    background: #0d1117;
    padding: 3px 8px;
    border-radius: 4px;
  }
  @media (max-width: 600px) {
    .card-body { flex-direction: column; }
    .grid { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
<h1>Tomotoken Completed Creatures</h1>
<p class="subtitle">3 fully-grown creatures (progress = 100%) with smooth outlines and visible legs</p>
<div class="grid">
${cardsHtml}
</div>
</body>
</html>`;

writeFileSync("3complete-preview.html", html);
console.log("Generated: 3complete-preview.html");
