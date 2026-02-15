/** Pattern type: 0=none, 1=stripes, 2=spots, 3=gradient, 4=checker, 5=swirl */
export type PatternType = 0 | 1 | 2 | 3 | 4 | 5;

export interface CreatureParams {
  readonly headRatio: number; // 0.20-0.45
  readonly bodyWidthRatio: number; // 0.30-0.80
  readonly roundness: number; // 0.0-1.0
  readonly topHeavy: number; // 0.0-1.0
  readonly eyeSize: 1 | 2 | 3;
  readonly eyeSpacing: number; // 0.3-0.7
  readonly hasEars: boolean;
  readonly hasHorns: boolean;
  readonly hasTail: boolean;
  readonly hasWings: boolean;
  readonly hasArms: boolean;
  readonly hasLegs: boolean;
  readonly patternType: PatternType;
  readonly patternDensity: number; // 0.0-1.0
  readonly neckWidth: number; // 0.3-0.8
  readonly legLength: number; // 0.1-0.3
  readonly armLength: number; // 0.1-0.3
  readonly tailLength: number; // 0.1-0.4
  readonly wingSize: number; // 0.1-0.4
  readonly earSize: number; // 0.1-0.3
  readonly hornSize: number; // 0.1-0.3
  readonly bodyTaper: number; // 0.0-1.0 how much body narrows at bottom
  readonly asymmetry: number; // 0.0-0.2 slight left/right differences
}

export interface WidthMapEntry {
  readonly left: number;
  readonly right: number;
}

export type WidthMap = readonly (WidthMapEntry | null)[];

export interface Bounds {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}
