import { describe, it, expect } from "vitest";
import { isFirstRun } from "../../src/first-run/detect.js";
import { createInitialState, createInitialCollection } from "../../src/store/store.js";

describe("first-run integration", () => {
  it("detects first run on fresh state", () => {
    const state = createInitialState();
    const collection = createInitialCollection();
    expect(isFirstRun(state, collection)).toBe(true);
  });

  it("does not detect first run after tokens consumed", () => {
    const state = {
      ...createInitialState(),
      currentPet: {
        ...createInitialState().currentPet,
        consumedTokens: 100_000,
      },
    };
    const collection = createInitialCollection();
    expect(isFirstRun(state, collection)).toBe(false);
  });
});
