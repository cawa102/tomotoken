import { clamp } from "../utils/clamp.js";

type Prng = () => number;
type Canvas = string[][];

const BODY_CHARS = ".oO@#*+=~";
const DETAIL_CHARS = ".:;!|/\\{}[]<>";

function createCanvas(w: number, h: number): Canvas {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => " "));
}

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function fillEllipse(canvas: Canvas, cx: number, cy: number, rx: number, ry: number, prng: Prng, density: number): void {
  for (let y = cy - ry; y <= cy + ry; y++) {
    for (let x = cx - rx; x <= cx + rx; x++) {
      if (y < 0 || y >= canvas.length || x < 0 || x >= canvas[0].length) continue;
      const dx = (x - cx) / (rx || 1);
      const dy = (y - cy) / (ry || 1);
      if (dx * dx + dy * dy <= 1.0) {
        if (prng() < density) {
          canvas[y][x] = BODY_CHARS[Math.floor(prng() * BODY_CHARS.length)];
        } else if (canvas[y][x] === " ") {
          canvas[y][x] = ".";
        }
      }
    }
  }
}

function fillRect(canvas: Canvas, x1: number, y1: number, x2: number, y2: number, prng: Prng, density: number): void {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      if (y < 0 || y >= canvas.length || x < 0 || x >= canvas[0].length) continue;
      if (prng() < density) {
        canvas[y][x] = BODY_CHARS[Math.floor(prng() * BODY_CHARS.length)];
      } else if (canvas[y][x] === " ") {
        canvas[y][x] = ".";
      }
    }
  }
}

function fillTriangle(canvas: Canvas, cx: number, top: number, bottom: number, halfBase: number, prng: Prng, density: number): void {
  const height = bottom - top;
  for (let y = top; y <= bottom; y++) {
    if (y < 0 || y >= canvas.length) continue;
    const rowFraction = height > 0 ? (y - top) / height : 1;
    const halfWidth = Math.round(halfBase * rowFraction);
    for (let x = cx - halfWidth; x <= cx + halfWidth; x++) {
      if (x < 0 || x >= canvas[0].length) continue;
      if (prng() < density) {
        canvas[y][x] = BODY_CHARS[Math.floor(prng() * BODY_CHARS.length)];
      } else if (canvas[y][x] === " ") {
        canvas[y][x] = ".";
      }
    }
  }
}

function addEyes(canvas: Canvas, cx: number, cy: number, _prng: Prng): void {
  const eyeY = Math.max(0, cy - 1);
  if (eyeY >= canvas.length) return;
  const lx = Math.max(0, cx - 1);
  const rx = Math.min(canvas[0].length - 1, cx + 1);
  if (lx < canvas[0].length) canvas[eyeY][lx] = "o";
  if (rx < canvas[0].length) canvas[eyeY][rx] = "o";
}

function addDetails(canvas: Canvas, prng: Prng, detailDensity: number): void {
  for (let y = 0; y < canvas.length; y++) {
    for (let x = 0; x < canvas[0].length; x++) {
      if (canvas[y][x] !== " " && canvas[y][x] !== "." && prng() < detailDensity * 0.3) {
        canvas[y][x] = DETAIL_CHARS[Math.floor(prng() * DETAIL_CHARS.length)];
      }
    }
  }
}

const GENERATORS: Record<string, (canvas: Canvas, prng: Prng, bw: number, bh: number, cx: number, cy: number, density: number) => void> = {
  builder: (c, p, bw, bh, cx, cy, d) => {
    fillRect(c, cx - Math.floor(bw / 2), cy - Math.floor(bh / 2), cx + Math.floor(bw / 2), cy + Math.floor(bh / 2), p, d);
    addEyes(c, cx, cy - Math.floor(bh / 4), p);
  },
  fixer: (c, p, bw, bh, cx, cy, d) => {
    fillEllipse(c, cx, cy, Math.floor(bw / 2), Math.floor(bh / 3), p, d);
    fillRect(c, cx - 1, cy + Math.floor(bh / 3), cx + 1, cy + Math.floor(bh / 2), p, d);
    addEyes(c, cx, cy - Math.floor(bh / 4), p);
  },
  refiner: (c, p, bw, bh, cx, cy, d) => {
    fillTriangle(c, cx, cy - Math.floor(bh / 2), cy, Math.floor(bw / 2), p, d);
    fillTriangle(c, cx, cy, cy + Math.floor(bh / 3), Math.floor(bw / 3), p, d);
    addEyes(c, cx, cy - Math.floor(bh / 4), p);
  },
  scholar: (c, p, bw, bh, cx, cy, d) => {
    fillEllipse(c, cx, cy, Math.floor(bw / 2), Math.floor(bh / 2), p, d);
    addEyes(c, cx, cy - Math.floor(bh / 4), p);
  },
  scribe: (c, p, bw, bh, cx, cy, d) => {
    const hw = Math.max(1, Math.floor(bw / 3));
    fillRect(c, cx - hw, cy - Math.floor(bh / 2), cx + hw, cy + Math.floor(bh / 2), p, d);
    addEyes(c, cx, cy - Math.floor(bh / 3), p);
  },
  architect: (c, p, bw, bh, cx, cy, d) => {
    fillTriangle(c, cx, cy - Math.floor(bh / 2), cy + Math.floor(bh / 2), Math.floor(bw / 2), p, d);
    addEyes(c, cx, cy - Math.floor(bh / 4), p);
  },
  operator: (c, p, bw, bh, cx, cy, d) => {
    fillEllipse(c, cx, cy, Math.floor(bw / 2), Math.floor(bh / 2), p, d);
    const r = Math.floor(bw / 2);
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const nx = cx + Math.round(Math.cos(angle) * r);
      const ny = cy + Math.round(Math.sin(angle) * (Math.floor(bh / 2)));
      if (ny >= 0 && ny < c.length && nx >= 0 && nx < c[0].length) c[ny][nx] = "+";
    }
    addEyes(c, cx, cy - Math.floor(bh / 4), p);
  },
  guardian: (c, p, bw, bh, cx, cy, d) => {
    const halfW = Math.floor(bw / 2);
    const midY = cy + Math.floor(bh / 4);
    fillRect(c, cx - halfW, cy - Math.floor(bh / 2), cx + halfW, midY, p, d);
    fillTriangle(c, cx, midY, cy + Math.floor(bh / 2), halfW, p, d);
    addEyes(c, cx, cy - Math.floor(bh / 3), p);
  },
};

export function generateBody(prng: Prng, progress: number, archetype: string, maxW: number, maxH: number): Canvas {
  const canvas = createCanvas(maxW, maxH);
  const p = clamp(0, 1, progress);

  const sizeFactor = Math.min(1, p * 2);
  const bw = lerp(3, Math.floor(maxW * 0.6), sizeFactor);
  const bh = lerp(2, Math.floor(maxH * 0.7), sizeFactor);
  const detailDensity = p > 0.5 ? (p - 0.5) * 2 : 0;

  const cx = Math.floor(maxW / 2);
  const cy = Math.floor(maxH / 2);
  const density = 0.4 + sizeFactor * 0.4;

  const gen = GENERATORS[archetype] ?? GENERATORS["builder"];
  gen(canvas, prng, bw, bh, cx, cy, density);

  if (detailDensity > 0) {
    addDetails(canvas, prng, detailDensity);
  }

  return canvas;
}
