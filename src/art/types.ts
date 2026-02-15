export type { PixelCanvas, Palette, AnimationHints, BodyResult } from "./pixel/types.js";

import type { PixelCanvas, Palette, AnimationHints } from "./pixel/types.js";
import type { LimbStage } from "./parametric/types.js";
import type { DepthMetrics, StyleMetrics } from "../store/types.js";

export interface ArtParams {
  readonly seed: string;
  readonly progress: number;
  readonly traits: Record<string, number>;
  readonly depthMetrics: DepthMetrics;
  readonly styleMetrics: StyleMetrics;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly usageMix?: Record<string, number>;
  readonly tokenRatio?: number;
}

export type Canvas = string[][];

export interface ArtOutput {
  readonly frames: readonly string[][];
  readonly colorFrames: readonly string[][];
  readonly basePixelCanvas: PixelCanvas;
  readonly animationHints: AnimationHints;
  readonly limbStage: LimbStage;
  readonly palette: Palette;
}
