import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createInitialState, loadState, saveState,
  createInitialCollection, loadCollection, saveCollection, addCompletedPet,
  updateGlobalStats, updatePetInState, updateIngestionFile,
  acquireLock, releaseLock,
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

  it("updateIngestionFile creates new state with file entry", () => {
    const state = createInitialState(5000);
    const updated = updateIngestionFile(state, "/path/to/file.jsonl", 1024, "2026-01-01T00:00:00Z");
    expect(updated.ingestionState.files["/path/to/file.jsonl"]).toEqual({
      byteOffset: 1024,
      lastLineTimestamp: "2026-01-01T00:00:00Z",
    });
    expect(state.ingestionState.files["/path/to/file.jsonl"]).toBeUndefined();
  });
});

describe("version migration", () => {
  it("migrates v1 state to v2", () => {
    const v1State = {
      version: 1,
      calibration: { t0: 10000, monthlyEstimate: 50000, calibratedAt: "2026-01-01T00:00:00Z" },
      spawnIndexCurrentMonth: 3,
      currentMonth: "2026-02",
      currentPet: {
        petId: "old-pet-id",
        spawnedAt: "2026-02-01T00:00:00Z",
        requiredTokens: 10000,
        consumedTokens: 5000,
        spawnIndex: 2,
        personalitySnapshot: { archetype: "builder", subtype: "fixer", traits: {} },
      },
      ingestionState: { files: { "/some/file.jsonl": { byteOffset: 100, lastLineTimestamp: null } } },
      globalStats: {
        totalTokensAllTime: 5000,
        totalSessionsIngested: 3,
        earliestTimestamp: "2026-01-01T00:00:00Z",
        latestTimestamp: "2026-02-01T00:00:00Z",
      },
    };
    const path = join(TMP, "v1state.json");
    writeFileSync(path, JSON.stringify(v1State));
    const loaded = loadState(path);
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(2);
    expect(loaded!.currentPet.personalitySnapshot).toBeNull();
    expect(loaded!.currentPet.spawnIndex).toBe(0);
    expect(loaded!.calibration).toEqual(v1State.calibration);
    expect(loaded!.ingestionState).toEqual(v1State.ingestionState);
  });

  it("migrates v1 collection to empty v2", () => {
    const v1Collection = {
      version: 1,
      pets: [{ petId: "old", archetype: "builder" }],
    };
    const path = join(TMP, "v1col.json");
    writeFileSync(path, JSON.stringify(v1Collection));
    const loaded = loadCollection(path);
    expect(loaded.version).toBe(2);
    expect(loaded.pets).toHaveLength(0);
  });

  it("returns null for corrupted state JSON", () => {
    const path = join(TMP, "bad.json");
    writeFileSync(path, "not json{{{");
    expect(loadState(path)).toBeNull();
  });

  it("returns default collection for corrupted JSON", () => {
    const path = join(TMP, "badcol.json");
    writeFileSync(path, "corrupted");
    const loaded = loadCollection(path);
    expect(loaded.version).toBe(2);
    expect(loaded.pets).toHaveLength(0);
  });
});

describe("lock management", () => {
  it("acquires and releases lock", () => {
    const lockPath = join(TMP, "test.lock");
    expect(acquireLock(lockPath)).toBe(true);
    releaseLock(lockPath);
  });

  it("blocks concurrent lock from same process", () => {
    const lockPath = join(TMP, "test2.lock");
    expect(acquireLock(lockPath)).toBe(true);
    // Same PID, fresh lock → should block
    expect(acquireLock(lockPath)).toBe(false);
    releaseLock(lockPath);
  });

  it("takes over stale lock from dead process", () => {
    const lockPath = join(TMP, "stale.lock");
    // Write lock with non-existent PID
    writeFileSync(lockPath, JSON.stringify({ pid: 999999999, timestamp: Date.now() }));
    expect(acquireLock(lockPath)).toBe(true);
    releaseLock(lockPath);
  });

  it("takes over corrupted lock file", () => {
    const lockPath = join(TMP, "corrupt.lock");
    writeFileSync(lockPath, "not json");
    expect(acquireLock(lockPath)).toBe(true);
    releaseLock(lockPath);
  });

  it("releaseLock is safe on non-existent file", () => {
    expect(() => releaseLock(join(TMP, "nofile.lock"))).not.toThrow();
  });
});
