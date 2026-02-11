import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  createInitialState, loadState, saveState,
  createInitialCollection, loadCollection, saveCollection, addCompletedPet,
  updateGlobalStats, updatePetInState,
} from "../../src/store/store.js";

const TMP = join(__dirname, "../tmp-store");

beforeEach(() => mkdirSync(TMP, { recursive: true }));
afterEach(() => rmSync(TMP, { recursive: true, force: true }));

describe("state persistence", () => {
  it("round-trips state through save/load", () => {
    const path = join(TMP, "state.json");
    const state = createInitialState(5000);
    saveState(state, path);
    const loaded = loadState(path);
    expect(loaded).toEqual(state);
  });

  it("returns null for missing file", () => {
    expect(loadState(join(TMP, "nonexistent.json"))).toBeNull();
  });
});

describe("collection persistence", () => {
  it("round-trips collection", () => {
    const path = join(TMP, "collection.json");
    const col = createInitialCollection();
    saveCollection(col, path);
    expect(loadCollection(path)).toEqual(col);
  });
});

describe("immutable updates", () => {
  it("updateGlobalStats creates new state", () => {
    const state = createInitialState(5000);
    const updated = updateGlobalStats(state, 1000, 1, "2026-01-01T00:00:00Z");
    expect(updated).not.toBe(state);
    expect(updated.globalStats.totalTokensAllTime).toBe(1000);
    expect(state.globalStats.totalTokensAllTime).toBe(0);
  });

  it("updatePetInState creates new state", () => {
    const state = createInitialState(5000);
    const updated = updatePetInState(state, { consumedTokens: 2500 });
    expect(updated.currentPet.consumedTokens).toBe(2500);
    expect(state.currentPet.consumedTokens).toBe(0);
  });
});
