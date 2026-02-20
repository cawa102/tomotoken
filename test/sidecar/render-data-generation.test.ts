import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AppState } from "../../src/store/types.js";
import type { CreatureDesign } from "../../src/generation/schema.js";

// Mock generateCreatureDesign
const mockGenerate = vi.fn();
vi.mock("../../src/generation/designer.js", () => ({
  generateCreatureDesign: (...args: unknown[]) => mockGenerate(...args),
}));

// Mock saveState to capture state writes
const mockSaveState = vi.fn();
vi.mock("../../src/store/store.js", () => ({
  saveState: (...args: unknown[]) => mockSaveState(...args),
  updatePetInState: (state: any, update: any) => ({
    ...state,
    currentPet: { ...state.currentPet, ...update },
  }),
}));

import { triggerGenerationIfNeeded } from "../../src/sidecar/generation-trigger.js";

function createTestState(overrides: Partial<AppState["currentPet"]> = {}): AppState {
  return {
    version: 2,
    calibration: { t0: 10000, monthlyEstimate: 50000, calibratedAt: "2026-01-01T00:00:00Z" },
    spawnIndexCurrentMonth: 0,
    currentMonth: "2026-01",
    currentPet: {
      petId: "test-pet",
      spawnedAt: "2026-01-15T00:00:00Z",
      requiredTokens: 10000,
      consumedTokens: 5000,
      spawnIndex: 0,
      personalitySnapshot: {
        usageMix: {},
        depthMetrics: { editTestLoopCount: 5, repeatEditSameFileCount: 2, phaseSwitchCount: 3, totalSessions: 10 },
        styleMetrics: { bulletRatio: 0.3, questionRatio: 0.1, codeblockRatio: 0.4, avgMessageLen: 120, messageLenStd: 40, headingRatio: 0.2 },
        traits: { builder: 50, fixer: 30, refiner: 20, scholar: 40, scribe: 10, architect: 60, operator: 25, guardian: 35 },
      },
      generatedDesigns: null,
      ...overrides,
    },
    ingestionState: { files: {} },
    globalStats: { totalTokensAllTime: 50000, totalSessionsIngested: 10, earliestTimestamp: "2026-01-01", latestTimestamp: "2026-01-20" },
    lastEncouragementShownAt: null,
  };
}

const mockDesign: CreatureDesign = {
  parts: [{
    name: "body",
    primitive: "sphere",
    position: [0, 0.5, 0],
    rotation: [0, 0, 0],
    scale: [0.5, 0.6, 0.4],
    color: "#ff8844",
    material: { roughness: 0.7, metalness: 0.05, flatShading: true },
  }],
  expressions: { default: {} },
  personality: { name: "Patches", quirk: "curious" },
};

describe("triggerGenerationIfNeeded", () => {
  const originalEnv = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    mockGenerate.mockReset();
    mockSaveState.mockReset();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ANTHROPIC_API_KEY = originalEnv;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it("triggers generation when API key is set and no design exists for stage", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    mockGenerate.mockResolvedValue(mockDesign);

    const state = createTestState();
    const result = await triggerGenerationIfNeeded(state);

    expect(mockGenerate).toHaveBeenCalledOnce();
    expect(result.currentPet.generatedDesigns).toBeDefined();
    expect(result.currentPet.generatedDesigns?.[3]).toEqual(mockDesign);
    expect(mockSaveState).toHaveBeenCalledOnce();
  });

  it("does not trigger generation when design already exists for stage", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";

    const state = createTestState({ generatedDesigns: { 3: mockDesign } });
    const result = await triggerGenerationIfNeeded(state);

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(result).toBe(state);
  });

  it("returns state unchanged when API key is not set", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const state = createTestState();
    const result = await triggerGenerationIfNeeded(state);

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(result).toBe(state);
  });

  it("returns state unchanged when API call fails (fallback)", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    mockGenerate.mockRejectedValue(new Error("API error"));

    const state = createTestState();
    const result = await triggerGenerationIfNeeded(state);

    expect(mockGenerate).toHaveBeenCalledOnce();
    expect(result).toBe(state);
  });

  it("returns state unchanged when personalitySnapshot is null", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";

    const state = createTestState({ personalitySnapshot: null });
    const result = await triggerGenerationIfNeeded(state);

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(result).toBe(state);
  });
});
