export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheCreationInputTokens: number;
  readonly cacheReadInputTokens: number;
}

export interface ToolUseEvent {
  readonly name: string;
  readonly id: string;
}

export interface ParsedLogEntry {
  readonly type: "assistant" | "user" | "progress" | "summary" | "file-history-snapshot";
  readonly timestamp: string;
  readonly sessionId: string;
  readonly uuid: string;
  readonly parentUuid: string | null;
  readonly model: string | null;
  readonly usage: TokenUsage | null;
  readonly toolUses: readonly ToolUseEvent[];
  readonly hasToolResult: boolean;
  readonly textContent: string | null;
  readonly editedFiles: readonly string[];
  readonly bashCommands: readonly string[];
}

export interface SessionMetrics {
  readonly sessionId: string;
  readonly totalTokens: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheTokens: number;
  readonly toolUseCounts: Record<string, number>;
  readonly toolTransitions: readonly string[];
  readonly editedExtensions: readonly string[];
  readonly bashCommands: readonly string[];
  readonly userMessageTexts: readonly string[];
  readonly entryCount: number;
  readonly firstTimestamp: string;
  readonly lastTimestamp: string;
}

export interface ScanResult {
  readonly filePath: string;
  readonly sizeBytes: number;
}

export interface IngestDelta {
  readonly newTokens: number;
  readonly newSessions: number;
  readonly sessionMetrics: readonly SessionMetrics[];
  readonly earliestTimestamp: string | null;
  readonly latestTimestamp: string | null;
}
