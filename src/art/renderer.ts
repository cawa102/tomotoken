import { createPrng } from "../utils/hash.js";
import { generateBody } from "./body.js";
import { applyMotifs } from "./motif.js";
import { generateFrames } from "./animator.js";
import { colorizeFrames } from "./color.js";
import type { ArtParams, ArtOutput, Canvas } from "./types.js";

function canvasToStrings(canvas: Canvas, width: number, height: number): string[] {
  const lines: string[] = [];
  for (let y = 0; y < height; y++) {
    if (y < canvas.length) {
      const row = canvas[y].join("").padEnd(width).slice(0, width);
      lines.push(row);
    } else {
      lines.push(" ".repeat(width));
    }
  }
  return lines;
}

export function renderArt(params: ArtParams): ArtOutput {
  const { seed, progress, archetype, subtype: _subtype, traits, canvasWidth, canvasHeight } = params;

  const prng = createPrng(seed);
  const body = generateBody(prng, progress, archetype, canvasWidth, canvasHeight);
  const motifed = applyMotifs(body, archetype, traits, prng, progress);
  const rawFrames = generateFrames(motifed, prng, archetype);

  const frames = rawFrames.map((f) => canvasToStrings(f, canvasWidth, canvasHeight));
  const colorPrng = createPrng(seed + ":color");
  const colorFrames = colorizeFrames(rawFrames, archetype, traits, progress, colorPrng);

  return { frames, colorFrames };
}
