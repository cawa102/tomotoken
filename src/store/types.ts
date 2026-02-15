export interface FileIngestionState {
  readonly byteOffset: number;
  readonly lastLineTimestamp: string | null;
}

export interface Calibration {
  readonly t0: number;
  readonly monthlyEstimate: number;
  readonly calibratedAt: string;
}

export interface PetRecord {
  readonly petId: string;
  readonly spawnedAt: string;
  readonly requiredTokens: number;
  readonly consumedTokens: number;
  readonly spawnIndex: number;
  readonly personalitySnapshot: PersonalitySnapshot | null;
}

export interface PersonalitySnapshot {
  readonly usageMix: Record<string, number>;
  readonly depthMetrics: DepthMetrics;
  readonly styleMetrics: StyleMetrics;
  readonly traits: Record<string, number>;
}

export interface DepthMetrics {
  readonly editTestLoopCount: number;
  readonly repeatEditSameFileCount: number;
  readonly phaseSwitchCount: number;
  readonly totalSessions: number;
}

export interface StyleMetrics {
  readonly bulletRatio: number;
  readonly questionRatio: number;
  readonly codeblockRatio: number;
  readonly avgMessageLen: number;
  readonly messageLenStd: number;
  readonly headingRatio: number;
}

export interface GlobalStats {
  readonly totalTokensAllTime: number;
  readonly totalSessionsIngested: number;
  readonly earliestTimestamp: string | null;
  readonly latestTimestamp: string | null;
}

export interface AppState {
  readonly version: 2;
  readonly calibration: Calibration | null;
  readonly spawnIndexCurrentMonth: number;
  readonly currentMonth: string;
  readonly currentPet: PetRecord;
  readonly ingestionState: {
    readonly files: Record<string, FileIngestionState>;
  };
  readonly globalStats: GlobalStats;
}

export interface CompletedPet {
  readonly petId: string;
  readonly spawnedAt: string;
  readonly completedAt: string;
  readonly requiredTokens: number;
  readonly consumedTokens: number;
  readonly spawnIndex: number;
  readonly personality: PersonalitySnapshot;
  readonly frames: readonly string[][];
  readonly colorFrames: readonly string[][];
  readonly seed: string;
}

export interface Collection {
  readonly version: 2;
  readonly pets: readonly CompletedPet[];
}
