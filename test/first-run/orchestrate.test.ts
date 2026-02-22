import { describe, it, expect } from "vitest";
import { buildFirstRunState } from "../../src/first-run/orchestrate.js";
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
    toolUseCounts: { Write: 5, Read: 3 },
    toolTransitions: ["Write→Read"],
    editedExtensions: [".ts"],
    bashCommands: ["npm test"],
    userMessageTexts: ["fix the bug"],
    entryCount: 10,
    firstTimestamp: timestamp,
    lastTimestamp: timestamp,
  };
}

describe("buildFirstRunState", () => {
  it("creates completed pet from sessions with personality", () => {
    const sessions = [
      makeSession("s1", 600_000_000, "2026-01-15T00:00:00Z"),
      makeSession("s2", 500_000_000, "2026-02-01T00:00:00Z"),
    ];
    const result = buildFirstRunState(sessions);

    expect(result.completedPet).toBeDefined();
    expect(result.completedPet.consumedTokens).toBe(
      result.completedPet.requiredTokens,
    );
    expect(result.completedPet.personality.traits).toBeDefined();
    expect(result.nextPetState.currentPet.consumedTokens).toBe(0);
    expect(result.nextPetState.currentPet.spawnIndex).toBe(1);
  });

  it("caps recent sessions to TOKENS_PER_PET via extractRecentTokens", () => {
    const sessions = [
      makeSession("s1", 600_000_000, "2026-01-15T00:00:00Z"),
      makeSession("s2", 600_000_000, "2026-02-01T00:00:00Z"),
    ];
    const result = buildFirstRunState(sessions);

    // extractRecentTokens takes only the most recent session (600M)
    // Math.max(600M, 1B) = 1B
    expect(result.completedPet.requiredTokens).toBe(1_000_000_000);
    expect(result.completedPet.consumedTokens).toBe(1_000_000_000);
    expect(result.nextPetState.globalStats.totalTokensAllTime).toBe(600_000_000);
  });
});
