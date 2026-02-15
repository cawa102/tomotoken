import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock external dependencies before imports
vi.mock("../../src/ingestion/watcher.js", async () => {
  const { EventEmitter } = await import("node:events");
  class MockLogWatcher extends EventEmitter {
    start = vi.fn();
    stop = vi.fn();
  }
  return { LogWatcher: MockLogWatcher };
});

vi.mock("../../src/index.js", () => ({
  runIngestion: vi.fn(),
  runCalibration: vi.fn((s: unknown) => s),
  runProgression: vi.fn(),
  runPersonality: vi.fn((s: unknown) => s),
}));

vi.mock("../../src/store/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/store/index.js")>();
  return {
    ...actual,
    saveState: vi.fn(),
    saveCollection: vi.fn(),
  };
});

vi.mock("../../src/utils/index.js", () => ({
  expandHome: vi.fn((p: string) => p),
}));

import { executeCycle, POLL_INTERVAL_MS } from "../../src/ui/hooks/useWatcher.js";
import { runIngestion, runProgression, runPersonality } from "../../src/index.js";
import { LogWatcher } from "../../src/ingestion/watcher.js";
import type { AppState, Collection } from "../../src/store/types.js";
import type { Config } from "../../src/config/schema.js";
import { createDefaultConfig } from "../../src/config/schema.js";

function createTestState(): AppState {
  return {
    version: 2,
    calibration: { t0: 10_000, monthlyEstimate: 50_000, calibratedAt: "2026-01-01T00:00:00.000Z" },
    spawnIndexCurrentMonth: 0,
    currentMonth: "2026-02",
    currentPet: {
      petId: "test-pet-id",
      spawnedAt: "2026-02-01T00:00:00.000Z",
      requiredTokens: 10_000,
      consumedTokens: 3_000,
      spawnIndex: 0,
      personalitySnapshot: null,
    },
    ingestionState: { files: {} },
    globalStats: {
      totalTokensAllTime: 3_000,
      totalSessionsIngested: 1,
      earliestTimestamp: "2026-01-01T00:00:00.000Z",
      latestTimestamp: "2026-02-01T00:00:00.000Z",
    },
    lastEncouragementShownAt: null,
  };
}

function createTestCollection(): Collection {
  return { version: 2, pets: [] };
}

function createTestConfig(): Config {
  return createDefaultConfig();
}

function mockSessionMetric(totalTokens: number) {
  return {
    totalTokens,
    editedExtensions: [],
    toolTransitions: [],
    bashCommands: [],
    toolUseCounts: {},
    userMessageTexts: [],
    firstTimestamp: "",
    lastTimestamp: "",
  };
}

describe("executeCycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no new session metrics", async () => {
    const config = createTestConfig();
    const state = createTestState();
    const collection = createTestCollection();

    vi.mocked(runIngestion).mockReturnValue({ state, sessionMetrics: [] as never });

    const result = await executeCycle(config, state, collection);
    expect(result).toBeNull();
    expect(runPersonality).not.toHaveBeenCalled();
    expect(runProgression).not.toHaveBeenCalled();
  });

  it("runs full pipeline when new metrics exist", async () => {
    const config = createTestConfig();
    const state = createTestState();
    const collection = createTestCollection();
    const metrics = [mockSessionMetric(500)];

    vi.mocked(runIngestion).mockReturnValue({ state, sessionMetrics: metrics as never });
    vi.mocked(runPersonality).mockReturnValue(state);
    vi.mocked(runProgression).mockReturnValue({ state, completed: [] });

    const result = await executeCycle(config, state, collection);

    expect(result).not.toBeNull();
    expect(result!.state).toEqual(state);
    expect(result!.collection).toEqual(collection);
    expect(result!.completed).toEqual([]);
    expect(runPersonality).toHaveBeenCalledWith(state, metrics);
    expect(runProgression).toHaveBeenCalledWith(state, 500, config);
  });

  it("accumulates tokens from multiple session metrics", async () => {
    const config = createTestConfig();
    const state = createTestState();
    const collection = createTestCollection();
    const metrics = [mockSessionMetric(300), mockSessionMetric(200)];

    vi.mocked(runIngestion).mockReturnValue({ state, sessionMetrics: metrics as never });
    vi.mocked(runPersonality).mockReturnValue(state);
    vi.mocked(runProgression).mockReturnValue({ state, completed: [] });

    await executeCycle(config, state, collection);

    expect(runProgression).toHaveBeenCalledWith(state, 500, config);
  });

  it("returns completed pets in result", async () => {
    const config = createTestConfig();
    const state = createTestState();
    const collection = createTestCollection();
    const metrics = [mockSessionMetric(10_000)];
    const completedPet = {
      petId: "completed-1",
      spawnedAt: "2026-02-01T00:00:00.000Z",
      completedAt: "2026-02-11T00:00:00.000Z",
      requiredTokens: 10_000,
      consumedTokens: 10_000,
      spawnIndex: 0,
      personality: {
        usageMix: {},
        depthMetrics: { editTestLoopCount: 0, repeatEditSameFileCount: 0, phaseSwitchCount: 0, totalSessions: 1 },
        styleMetrics: { bulletRatio: 0, questionRatio: 0, codeblockRatio: 0, avgMessageLen: 0, messageLenStd: 0, headingRatio: 0 },
        traits: {},
      },
      frames: [["frame1"]],
      colorFrames: [["colorframe1"]],
      seed: "abc123",
    };

    vi.mocked(runIngestion).mockReturnValue({ state, sessionMetrics: metrics as never });
    vi.mocked(runPersonality).mockReturnValue(state);
    vi.mocked(runProgression).mockReturnValue({ state, completed: [completedPet] });

    const result = await executeCycle(config, state, collection);

    expect(result).not.toBeNull();
    expect(result!.completed).toHaveLength(1);
    expect(result!.completed[0].petId).toBe("completed-1");
    // Collection should include the completed pet (via addCompletedPet)
    expect(result!.collection.pets).toHaveLength(1);
  });

  it("does not mutate input state or collection", async () => {
    const config = createTestConfig();
    const state = createTestState();
    const collection = createTestCollection();
    const metrics = [mockSessionMetric(500)];

    const stateBefore = JSON.stringify(state);
    const collectionBefore = JSON.stringify(collection);

    vi.mocked(runIngestion).mockReturnValue({ state, sessionMetrics: metrics as never });
    vi.mocked(runPersonality).mockReturnValue(state);
    vi.mocked(runProgression).mockReturnValue({ state, completed: [] });

    await executeCycle(config, state, collection);

    expect(JSON.stringify(state)).toBe(stateBefore);
    expect(JSON.stringify(collection)).toBe(collectionBefore);
  });
});

describe("LogWatcher", () => {
  it("start and stop are callable", () => {
    const watcher = new LogWatcher();
    watcher.start(["/some/dir"]);
    expect(watcher.start).toHaveBeenCalledWith(["/some/dir"]);
    watcher.stop();
    expect(watcher.stop).toHaveBeenCalled();
  });

  it("emits change events", () => {
    const watcher = new LogWatcher();
    const handler = vi.fn();
    watcher.on("change", handler);
    watcher.emit("change", { eventType: "change", filename: "session.jsonl", dir: "/test" });
    expect(handler).toHaveBeenCalledWith({ eventType: "change", filename: "session.jsonl", dir: "/test" });
  });
});

describe("constants", () => {
  it("POLL_INTERVAL_MS is 5 seconds", () => {
    expect(POLL_INTERVAL_MS).toBe(5000);
  });
});
