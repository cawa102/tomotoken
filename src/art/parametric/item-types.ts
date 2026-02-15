export type ItemFamily = "blade" | "staff" | "shield" | "tool" | "orb";
export type Richness = "modest" | "standard" | "lavish";

export interface ItemParams {
  readonly family: ItemFamily;
  readonly length: number;      // 2-6
  readonly width: number;       // 1-4
  readonly taper: number;       // 0.0-1.0
  readonly curvature: number;   // 0.0-1.0
  readonly crossPiece: boolean;
  readonly richness: Richness;
  readonly dominantCategory: string; // for decoration direction
}
