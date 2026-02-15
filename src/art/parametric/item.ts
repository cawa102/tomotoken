import type { MutablePixelCanvas } from "../pixel/types.js";
import type { Bounds } from "./types.js";
import { deriveItemParams } from "./item-params.js";
import { generateItemPixels } from "./item-shapes.js";

export function placeItemOnCanvas(
  canvas: MutablePixelCanvas,
  bodyBounds: Bounds,
  traits: Record<string, number>,
  usageMix: Record<string, number>,
  tokenRatio: number,
  prng: () => number,
): MutablePixelCanvas {
  const result = canvas.map((row) => [...row]);
  const itemParams = deriveItemParams(traits, usageMix, tokenRatio, prng);
  const { pixels, anchorRow, anchorCol } = generateItemPixels(itemParams, prng);

  // Place item relative to character's hand (right side of body)
  const handRow = bodyBounds.top + Math.round((bodyBounds.bottom - bodyBounds.top) * 0.5);
  const handCol = bodyBounds.right + 2;
  const startRow = handRow - anchorRow;
  const startCol = handCol - anchorCol;

  for (let r = 0; r < pixels.length; r++) {
    for (let c = 0; c < pixels[r].length; c++) {
      if (pixels[r][c] === 0) continue;
      const tr = startRow + r;
      const tc = startCol + c;
      if (tr >= 0 && tr < result.length && tc >= 0 && tc < result[0].length) {
        if (result[tr][tc] === 0) {
          result[tr][tc] = pixels[r][c];
        }
      }
    }
  }

  return result;
}
