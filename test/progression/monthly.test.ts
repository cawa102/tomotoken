import { describe, it, expect } from "vitest";
import { detectMonthChange, handleMonthChange } from "../../src/progression/monthly.js";
import type { AppState } from "../../src/store/types.js";

describe("detectMonthChange", () => {
  it("returns false within same month", () => {
    expect(detectMonthChange("2026-01", new Date("2026-01-15"))).toBe(false);
  });

  it("returns true when month changes", () => {
    expect(detectMonthChange("2026-01", new Date("2026-02-01"))).toBe(true);
  });
});

describe("handleMonthChange", () => {
  it("resets spawn index and updates month", () => {
    const state: AppState = {
      version: 1,
      calibration: null,
      spawnIndexCurrentMonth: 5,
      currentMonth: "2026-01",
      currentPet: {
        petId: "p1",
        spawnedAt: "2026-01-20T00:00:00Z",
        requiredTokens: 5000,
        consumedTokens: 3000,
        spawnIndex: 5,
        personalitySnapshot: null,
      },
      ingestionState: { files: {} },
      globalStats: {
        totalTokensAllTime: 100000,
        totalSessionsIngested: 50,
        earliestTimestamp: "2026-01-01T00:00:00Z",
        latestTimestamp: "2026-01-31T00:00:00Z",
      },
    };

    const updated = handleMonthChange(state, new Date("2026-02-01"));
    expect(updated.spawnIndexCurrentMonth).toBe(0);
    expect(updated.currentMonth).toBe("2026-02");
    // Current pet unchanged
    expect(updated.currentPet.consumedTokens).toBe(3000);
    expect(updated.currentPet.requiredTokens).toBe(5000);
  });
});
