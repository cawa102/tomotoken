import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/store/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/store/index.js")>();
  return { ...actual, saveState: vi.fn() };
});

import { shouldTriggerEncouragement, computeEncouragementState } from "../../../src/ui/hooks/useEncouragement.js";
import type { AppState } from "../../../src/store/types.js";
import { createDefaultConfig } from "../../../src/config/schema.js";
import type { TokenEvent } from "../../../src/encouragement/rate.js";

function createTestState(overrides?: Partial<AppState>): AppState {
  return {
    version: 2,
    calibration: null,
    spawnIndexCurrentMonth: 0,
    currentMonth: "2026-02",
    currentPet: {
      petId: "test-pet",
      spawnedAt: "2026-02-01T00:00:00.000Z",
      requiredTokens: 10_000,
      consumedTokens: 3_000,
      spawnIndex: 0,
      personalitySnapshot: null,
      generatedDesigns: null,
    },
    ingestionState: { files: {} },
    globalStats: {
      totalTokensAllTime: 3_000,
      totalSessionsIngested: 1,
      earliestTimestamp: null,
      latestTimestamp: null,
    },
    lastEncouragementShownAt: null,
    ...overrides,
  };
}

describe("shouldTriggerEncouragement", () => {
  it("returns true when tokens exceed threshold and cooldown elapsed", () => {
    const config = createDefaultConfig();
    const events: TokenEvent[] = [
      { tokens: 60_000, timestamp: new Date().toISOString() },
    ];
    const state = createTestState();
    expect(shouldTriggerEncouragement(config, state, events)).toBe(true);
  });

  it("returns false when encouragement is disabled", () => {
    const config = {
      ...createDefaultConfig(),
      encouragement: { enabled: false, tokensPerHourThreshold: 50_000, cooldownHours: 3 },
    };
    const events: TokenEvent[] = [
      { tokens: 60_000, timestamp: new Date().toISOString() },
    ];
    expect(shouldTriggerEncouragement(config, createTestState(), events)).toBe(false);
  });

  it("returns false when tokens below threshold", () => {
    const config = createDefaultConfig();
    const events: TokenEvent[] = [
      { tokens: 100, timestamp: new Date().toISOString() },
    ];
    expect(shouldTriggerEncouragement(config, createTestState(), events)).toBe(false);
  });

  it("returns false when cooldown not elapsed", () => {
    const config = createDefaultConfig();
    const events: TokenEvent[] = [
      { tokens: 60_000, timestamp: new Date().toISOString() },
    ];
    const state = createTestState({ lastEncouragementShownAt: new Date().toISOString() });
    expect(shouldTriggerEncouragement(config, state, events)).toBe(false);
  });
});

describe("computeEncouragementState", () => {
  it("returns visible message when triggered", () => {
    const config = createDefaultConfig();
    const events: TokenEvent[] = [
      { tokens: 60_000, timestamp: new Date().toISOString() },
    ];
    const state = createTestState();
    const result = computeEncouragementState(config, state, events);
    expect(result.visible).toBe(true);
    expect(result.message).toBeTruthy();
  });

  it("returns invisible when not triggered", () => {
    const config = createDefaultConfig();
    const result = computeEncouragementState(config, createTestState(), []);
    expect(result.visible).toBe(false);
    expect(result.message).toBeNull();
  });
});
