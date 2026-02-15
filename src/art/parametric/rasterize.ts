import type { MutablePixelCanvas } from "../pixel/types.js";
import type { WidthMap } from "./types.js";

/**
 * Converts a silhouette width map into a pixel canvas with outline (1) and fill (2).
 */
export function rasterizeSilhouette(
  widthMap: WidthMap,
  canvasW: number,
  pixelH: number,
): MutablePixelCanvas {
  const canvas: MutablePixelCanvas = [];
  for (let r = 0; r < pixelH; r++) {
    const row: number[] = new Array(canvasW).fill(0);
    canvas.push(row);
  }

  // Find topmost and bottommost filled rows
  let topRow = -1;
  let bottomRow = -1;
  for (let r = 0; r < widthMap.length; r++) {
    const entry = widthMap[r];
    if (entry !== null) {
      if (topRow === -1) topRow = r;
      bottomRow = r;
    }
  }

  if (topRow === -1) return canvas;

  for (let r = 0; r < widthMap.length; r++) {
    const entry = widthMap[r];
    if (entry === null) continue;

    const left = Math.max(0, Math.min(canvasW - 1, entry.left));
    const right = Math.max(0, Math.min(canvasW - 1, entry.right));

    if (r === topRow || r === bottomRow) {
      // Top and bottom edges: all outline
      for (let c = left; c <= right; c++) {
        canvas[r][c] = 1;
      }
    } else {
      // Side edges: outline on left and right, fill in between
      canvas[r][left] = 1;
      canvas[r][right] = 1;
      for (let c = left + 1; c < right; c++) {
        canvas[r][c] = 2;
      }
    }
  }

  return canvas;
}
