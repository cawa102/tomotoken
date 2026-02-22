import { describe, it, expect } from "vitest";
import type { CompletedPet } from "../../src/store/types.js";

describe("CompletedPet type has no frames fields", () => {
  it("does not include frames or colorFrames", () => {
    const pet: CompletedPet = {
      petId: "test",
      spawnedAt: "2026-01-01T00:00:00Z",
      completedAt: "2026-01-02T00:00:00Z",
      requiredTokens: 1_000_000_000,
      consumedTokens: 1_000_000_000,
      spawnIndex: 0,
      personality: {
        usageMix: {},
        depthMetrics: { editTestLoopCount: 0, repeatEditSameFileCount: 0, phaseSwitchCount: 0, totalSessions: 0 },
        styleMetrics: { bulletRatio: 0, questionRatio: 0, codeblockRatio: 0, avgMessageLen: 0, messageLenStd: 0, headingRatio: 0 },
        traits: {},
      },
      seed: "abc",
    };
    expect(pet.petId).toBe("test");
    expect("frames" in pet).toBe(false);
    expect("colorFrames" in pet).toBe(false);
  });
});
