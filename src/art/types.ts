export interface ArtParams {
  readonly seed: string;
  readonly progress: number;
  readonly archetype: string;
  readonly subtype: string;
  readonly traits: Record<string, number>;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
}

export type Canvas = string[][];

export interface Frame {
  readonly lines: readonly string[];
}

export interface ArtOutput {
  readonly frames: readonly string[][];
  readonly colorFrames: readonly string[][];
}
