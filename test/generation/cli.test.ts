import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppState } from "../../src/store/types.js";
import type { CreatureDesign } from "../../src/generation/schema.js";
import type { Customization } from "../../src/generation/templates/types.js";

// Mock store module
const mockLoadState = vi.fn<() => AppState | null>();
const mockSaveState = vi.fn();
vi.mock("../../src/store/store.js", () => ({
  loadState: () => mockLoadState(),
  saveState: (...args: unknown[]) => mockSaveState(...args),
  updatePetInState: (state: AppState, update: Partial<AppState["currentPet"]>) => ({
    ...state,
    currentPet: { ...state.currentPet, ...update },
  }),
}));

// Mock runFull to bootstrap state when loadState returns null
const mockRunFull = vi.fn<() => Promise<{ state: AppState }>>();
vi.mock("../../src/index.js", () => ({
  runFull: () => mockRunFull(),
}));

import { getDesignContext, saveDesign } from "../../src/generation/cli.js";

const validCustomization: Customization = {
  bodyColor: "#4a6741",
  accentColor: "#8faa7e",
  eyeColor: "#1a1a2e",
  accessoryColor: "#8b6914",
  showAccessories: [],
  animationStyle: "calm",
  expressions: {
    default: { eyes: { shape: "round" }, mouth: { shape: "flat" } },
    happy: { eyes: { shape: "happy" }, mouth: { shape: "smile" } },
    sleepy: { eyes: { shape: "sleepy" }, mouth: { shape: "flat" } },
    focused: { eyes: { shape: "sparkle" }, mouth: { shape: "flat" } },
  },
  personality: { name: "Gearsworth", quirk: "Loves fixing things" },
};

// Keep validDesign for previousParts / existing designs references
const validDesign: CreatureDesign = {
  parts: [{
    name: "body",
    primitive: "sphere",
    position: [0, 0.5, 0],
    rotation: [0, 0, 0],
    scale: [0.5, 0.6, 0.4],
    color: "#ff8844",
    material: { roughness: 0.7, metalness: 0.05, flatShading: true },
  }],
  expressions: {
    default: { eyes: { shape: "round" }, mouth: { shape: "smile" } },
  },
  personality: { name: "Patches", quirk: "always curious" },
};

function createTestState(overrides: Partial<AppState["currentPet"]> = {}): AppState {
  return {
    version: 2,
    calibration: { t0: 10000, monthlyEstimate: 50000, calibratedAt: "2026-01-01T00:00:00Z" },
    spawnIndexCurrentMonth: 0,
    currentMonth: "2026-01",
    currentPet: {
      petId: "test-pet-abc",
      spawnedAt: "2026-01-15T00:00:00Z",
      requiredTokens: 10000,
      consumedTokens: 5000,   // progress = 0.5 → stage 3
      spawnIndex: 0,
      personalitySnapshot: {
        usageMix: { impl: 40, debug: 20, refactor: 10, research: 15, docs: 5, planning: 5, ops: 3, security: 2 },
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

describe("getDesignContext", () => {
  beforeEach(() => {
    mockLoadState.mockReset();
    mockRunFull.mockReset();
    mockSaveState.mockReset();
  });

  it("returns context with correct stage, templateId, and prompt", async () => {
    const state = createTestState();
    mockLoadState.mockReturnValue(state);

    const ctx = await getDesignContext();

    expect(ctx.stage).toBe(3);
    expect(ctx.petId).toBe("test-pet-abc");
    expect(ctx.templateId).toBe("humanoid");
    expect(ctx.prompt).toContain("アーキタイプ: architect");
    expect(ctx.prompt).toContain("builder寄り");
    expect(ctx.stageDescription).toContain("3");
    expect(ctx.existingStages).toEqual([]);
    expect(ctx.previousParts).toBeNull();
    expect(ctx.customizationHint).toContain("bodyColor");
  });

  it("bootstraps state via runFull when loadState returns null", async () => {
    const state = createTestState();
    mockLoadState.mockReturnValue(null);
    mockRunFull.mockResolvedValue({ state });

    const ctx = await getDesignContext();

    expect(mockRunFull).toHaveBeenCalledOnce();
    expect(ctx.stage).toBe(3);
  });

  it("throws when personalitySnapshot is null", async () => {
    const state = createTestState({ personalitySnapshot: null });
    mockLoadState.mockReturnValue(state);

    await expect(getDesignContext()).rejects.toThrow(/personality/i);
  });

  it("includes previousParts from prior stage design", async () => {
    const state = createTestState({
      generatedDesigns: { 2: validDesign },
    });
    mockLoadState.mockReturnValue(state);

    const ctx = await getDesignContext();

    // stage is 3 (progress=0.5), so previousParts from stage 2
    expect(ctx.previousParts).toEqual(validDesign.parts);
  });

  it("lists existing stages in context", async () => {
    const state = createTestState({
      generatedDesigns: { 1: validDesign, 2: validDesign },
    });
    mockLoadState.mockReturnValue(state);

    const ctx = await getDesignContext();

    expect(ctx.existingStages).toEqual([1, 2]);
  });

  it("computes stage 0 for very low progress", async () => {
    const state = createTestState({ consumedTokens: 500 }); // 500/10000 = 0.05 → stage 0
    mockLoadState.mockReturnValue(state);

    const ctx = await getDesignContext();

    expect(ctx.stage).toBe(0);
    expect(ctx.previousParts).toBeNull();
  });

  it("computes stage 5 for completed pet", async () => {
    const state = createTestState({ consumedTokens: 10000 }); // 10000/10000 = 1.0 → stage 5
    mockLoadState.mockReturnValue(state);

    const ctx = await getDesignContext();

    expect(ctx.stage).toBe(5);
  });
});

describe("saveDesign", () => {
  beforeEach(() => {
    mockLoadState.mockReset();
    mockRunFull.mockReset();
    mockSaveState.mockReset();
  });

  it("validates Customization, applies template, and saves CreatureDesign", async () => {
    const state = createTestState();
    mockLoadState.mockReturnValue(state);

    const result = await saveDesign(JSON.stringify(validCustomization));

    // Result should be a full CreatureDesign (from applyCustomization)
    expect(result.personality.name).toBe("Gearsworth");
    expect(result.parts.length).toBeGreaterThan(1); // template produces many parts
    expect(result.parts.find(p => p.name === "body")).toBeTruthy();
    expect(mockSaveState).toHaveBeenCalledOnce();

    const savedState = mockSaveState.mock.calls[0][0] as AppState;
    expect(savedState.currentPet.generatedDesigns?.[3]).toEqual(result);
  });

  it("throws on invalid JSON", async () => {
    await expect(saveDesign("not json")).rejects.toThrow();
  });

  it("throws on invalid Customization (missing bodyColor)", async () => {
    const state = createTestState();
    mockLoadState.mockReturnValue(state);

    const invalid = { accentColor: "#aabbcc" };
    await expect(saveDesign(JSON.stringify(invalid))).rejects.toThrow();
  });

  it("throws when loadState returns null", async () => {
    mockLoadState.mockReturnValue(null);

    await expect(saveDesign(JSON.stringify(validCustomization))).rejects.toThrow(/state/i);
  });

  it("merges with existing generatedDesigns", async () => {
    const existingDesign: CreatureDesign = {
      parts: [{ name: "egg", primitive: "sphere", position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: "#aabbcc", material: { roughness: 0.5, metalness: 0, flatShading: true } }],
      expressions: { default: {} },
      personality: { name: "Eggy", quirk: "round" },
    };
    const state = createTestState({ generatedDesigns: { 0: existingDesign } });
    mockLoadState.mockReturnValue(state);

    const result = await saveDesign(JSON.stringify(validCustomization));

    const savedState = mockSaveState.mock.calls[0][0] as AppState;
    // Should keep stage 0 and add stage 3
    expect(savedState.currentPet.generatedDesigns?.[0]).toEqual(existingDesign);
    expect(savedState.currentPet.generatedDesigns?.[3]).toEqual(result);
  });
});
