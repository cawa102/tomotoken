import { describe, it, expect } from "vitest";
import { extractRecentTokens } from "../../src/first-run/recent-ingestion.js";
import type { SessionMetrics } from "../../src/ingestion/types.js";

function makeSession(
  id: string,
  tokens: number,
  timestamp: string,
): SessionMetrics {
  return {
    sessionId: id,
    totalTokens: tokens,
    inputTokens: tokens / 2,
    outputTokens: tokens / 2,
    cacheTokens: 0,
    toolUseCounts: {},
    toolTransitions: [],
    editedExtensions: [],
    bashCommands: [],
    userMessageTexts: [],
    entryCount: 1,
    firstTimestamp: timestamp,
    lastTimestamp: timestamp,
  };
}

describe("extractRecentTokens", () => {
  it("returns all sessions when total < limit", () => {
    const sessions = [
      makeSession("s1", 300_000_000, "2026-01-01T00:00:00Z"),
      makeSession("s2", 200_000_000, "2026-01-02T00:00:00Z"),
    ];
    const result = extractRecentTokens(sessions, 1_000_000_000);
    expect(result).toHaveLength(2);
    expect(result.reduce((sum, s) => sum + s.totalTokens, 0)).toBe(
      500_000_000,
    );
  });

  it("returns only newest sessions up to limit", () => {
    const sessions = [
      makeSession("s1", 600_000_000, "2026-01-01T00:00:00Z"),
      makeSession("s2", 500_000_000, "2026-01-02T00:00:00Z"),
      makeSession("s3", 400_000_000, "2026-01-03T00:00:00Z"),
    ];
    const result = extractRecentTokens(sessions, 1_000_000_000);
    expect(
      result.reduce((sum, s) => sum + s.totalTokens, 0),
    ).toBeLessThanOrEqual(1_000_000_000);
    expect(result.some((s) => s.sessionId === "s3")).toBe(true);
    expect(result.some((s) => s.sessionId === "s2")).toBe(true);
  });

  it("returns empty array when no sessions", () => {
    expect(extractRecentTokens([], 1_000_000_000)).toHaveLength(0);
  });
});
