import type { ItemParams, Richness } from "./item-types.js";

export interface ItemPixelResult {
  readonly pixels: readonly (readonly number[])[];
  readonly anchorRow: number;
  readonly anchorCol: number;
}

function makeGrid(h: number, w: number): number[][] {
  return Array.from({ length: h }, () => Array(w).fill(0));
}

function applyRichness(
  grid: number[][],
  richness: Richness,
  prng: () => number,
): number[][] {
  const result = grid.map((row) => [...row]);
  if (richness === "modest") return result;

  // Standard: add palette 8 decoration pixels
  for (let r = 0; r < result.length; r++) {
    for (let c = 0; c < result[r].length; c++) {
      if (result[r][c] !== 0 && prng() < 0.15) {
        result[r][c] = 8;
      }
    }
  }

  if (richness === "lavish") {
    // Lavish: add palette 9 sparkle on empty adjacent pixels
    const h = result.length;
    const w = result[0].length;
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        if (result[r][c] === 0 && prng() < 0.1) {
          const hasNeighbor =
            (r > 0 && result[r - 1][c] !== 0) ||
            (r < h - 1 && result[r + 1][c] !== 0) ||
            (c > 0 && result[r][c - 1] !== 0) ||
            (c < w - 1 && result[r][c + 1] !== 0);
          if (hasNeighbor) {
            result[r][c] = 9;
          }
        }
      }
    }
  }

  return result;
}

function generateBlade(params: ItemParams, prng: () => number): ItemPixelResult {
  const h = params.length + 2; // taller than wide
  const w = params.width;
  const grid = makeGrid(h, w);

  // Blade body: fill from handle (bottom) to tip (top) with taper
  for (let r = 0; r < h; r++) {
    const progress = r / (h - 1); // 0 = top (tip), 1 = bottom (handle)
    const taperFactor = 1 - params.taper * (1 - progress);
    const rowWidth = Math.max(1, Math.round(w * taperFactor));
    const offset = Math.floor((w - rowWidth) / 2);
    for (let c = offset; c < offset + rowWidth; c++) {
      if (c >= 0 && c < w) {
        grid[r][c] = r < 2 ? 7 : 2; // tip = palette 7, body = palette 2
      }
    }
  }

  // Handle (bottom 1-2 rows)
  const handleRow = h - 1;
  for (let c = 0; c < w; c++) {
    if (grid[handleRow][c] !== 0) grid[handleRow][c] = 3;
  }

  // Cross piece (guard)
  if (params.crossPiece && h > 3) {
    const guardRow = h - 2;
    const guardWidth = Math.min(w + 2, w + 1);
    const newGrid = makeGrid(h, Math.max(w, guardWidth));
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const offset = Math.max(0, Math.floor((guardWidth - w) / 2));
        newGrid[r][c + offset] = grid[r][c];
      }
    }
    const offset = Math.max(0, Math.floor((guardWidth - w) / 2));
    for (let c = 0; c < guardWidth; c++) {
      newGrid[guardRow][c] = 3;
    }
    const pixels = applyRichness(newGrid, params.richness, prng);
    return { pixels, anchorRow: h - 1, anchorCol: Math.floor(guardWidth / 2) };
  }

  const pixels = applyRichness(grid, params.richness, prng);
  return { pixels, anchorRow: h - 1, anchorCol: Math.floor(w / 2) };
}

function generateStaff(params: ItemParams, prng: () => number): ItemPixelResult {
  const h = params.length + 3; // tall uniform column
  const w = Math.max(1, Math.min(2, params.width));
  const grid = makeGrid(h, w);

  // Uniform shaft
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      grid[r][c] = 2;
    }
  }

  // Orb/gem at top
  if (w >= 1) {
    grid[0][0] = 7;
    if (w > 1) grid[0][1] = 7;
  }

  const pixels = applyRichness(grid, params.richness, prng);
  return { pixels, anchorRow: h - 1, anchorCol: Math.floor(w / 2) };
}

function generateShield(params: ItemParams, prng: () => number): ItemPixelResult {
  const h = params.length;
  const w = params.width + 2; // wider than tall
  const grid = makeGrid(h, w);

  // Fill rounded rectangle
  for (let r = 0; r < h; r++) {
    const progress = r / Math.max(1, h - 1);
    // Rounded edges at top and bottom
    const shrink = (r === 0 || r === h - 1) ? 1 : 0;
    for (let c = shrink; c < w - shrink; c++) {
      grid[r][c] = 2;
    }
  }

  // Border (palette 1)
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (grid[r][c] !== 0) {
        const isBorder =
          r === 0 || r === h - 1 ||
          c === 0 || c === w - 1 ||
          (r > 0 && grid[r - 1][c] === 0) ||
          (c > 0 && grid[r][c - 1] === 0);
        if (isBorder) grid[r][c] = 1;
      }
    }
  }

  // Center emblem
  const midR = Math.floor(h / 2);
  const midC = Math.floor(w / 2);
  if (midR >= 0 && midR < h && midC >= 0 && midC < w) {
    grid[midR][midC] = 7;
  }

  const pixels = applyRichness(grid, params.richness, prng);
  return { pixels, anchorRow: Math.floor(h / 2), anchorCol: 0 };
}

function generateTool(params: ItemParams, prng: () => number): ItemPixelResult {
  const shaftH = params.length + 1;
  const headW = Math.max(2, params.width + 1);
  const headH = 2;
  const totalH = shaftH + headH;
  const w = Math.max(headW, 2);
  const grid = makeGrid(totalH, w);

  // Tool head (top) — L-shape
  for (let r = 0; r < headH; r++) {
    for (let c = 0; c < headW; c++) {
      grid[r][c] = 7;
    }
  }

  // Shaft (centered, 1px wide)
  const shaftCol = Math.floor(headW / 2);
  for (let r = headH; r < totalH; r++) {
    grid[r][shaftCol] = 2;
  }

  const pixels = applyRichness(grid, params.richness, prng);
  return { pixels, anchorRow: totalH - 1, anchorCol: shaftCol };
}

function generateOrb(params: ItemParams, prng: () => number): ItemPixelResult {
  const size = Math.max(2, Math.min(params.length, params.width));
  const h = size;
  const w = size;
  const grid = makeGrid(h, w);

  // Circle/diamond shape
  const mid = Math.floor(size / 2);
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const dr = Math.abs(r - mid);
      const dc = Math.abs(c - mid);
      const dist = dr + dc; // manhattan distance for diamond
      if (dist <= mid) {
        grid[r][c] = dist === mid ? 7 : 2;
      }
    }
  }

  // Center highlight
  if (mid >= 0 && mid < h && mid < w) {
    grid[mid][mid] = 4;
  }

  const pixels = applyRichness(grid, params.richness, prng);
  return { pixels, anchorRow: mid, anchorCol: 0 };
}

const GENERATORS: Record<string, (params: ItemParams, prng: () => number) => ItemPixelResult> = {
  blade: generateBlade,
  staff: generateStaff,
  shield: generateShield,
  tool: generateTool,
  orb: generateOrb,
};

export function generateItemPixels(
  params: ItemParams,
  prng: () => number,
): ItemPixelResult {
  const generator = GENERATORS[params.family] ?? generateBlade;
  return generator(params, prng);
}
