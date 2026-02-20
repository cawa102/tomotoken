import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  unlinkSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import {
  STATE_PATH,
  COLLECTION_PATH,
  TOMOTOKEN_DIR,
  LOCK_PATH,
} from "../config/constants.js";
import type { AppState, Collection, PetRecord, CompletedPet } from "./types.js";

const LOCK_STALE_MS = 5 * 60 * 1000; // 5 minutes

export function acquireLock(lockPath: string = LOCK_PATH): boolean {
  ensureDir(lockPath);
  if (existsSync(lockPath)) {
    try {
      const raw = readFileSync(lockPath, "utf-8");
      const { pid, timestamp } = JSON.parse(raw) as { pid: number; timestamp: number };
      const age = Date.now() - timestamp;
      // Check if lock is stale (process dead or too old)
      try {
        process.kill(pid, 0); // Test if process exists
        if (age < LOCK_STALE_MS) return false; // Process alive and lock is fresh
      } catch {
        // Process doesn't exist — stale lock, take over
      }
    } catch {
      // Corrupted lock file — take over
    }
  }
  writeFileSync(lockPath, JSON.stringify({ pid: process.pid, timestamp: Date.now() }), { encoding: "utf-8", mode: 0o600 });
  return true;
}

export function releaseLock(lockPath: string = LOCK_PATH): void {
  try {
    if (existsSync(lockPath)) {
      unlinkSync(lockPath);
    }
  } catch {
    // Best-effort cleanup
  }
}

function ensureDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

function atomicWrite(filePath: string, data: unknown): void {
  ensureDir(filePath);
  const suffix = randomBytes(6).toString("hex");
  const tmpPath = `${filePath}.${suffix}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(data, null, 2), { encoding: "utf-8", mode: 0o600 });
  renameSync(tmpPath, filePath);
}

function readJson<T>(filePath: string): T | null {
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function createInitialPet(spawnIndex: number, requiredTokens: number): PetRecord {
  return {
    petId: uuidv4(),
    spawnedAt: new Date().toISOString(),
    requiredTokens,
    consumedTokens: 0,
    spawnIndex,
    personalitySnapshot: null,
    generatedDesigns: null,
  };
}

function currentMonthString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function createInitialState(requiredTokens: number): AppState {
  return {
    version: 2,
    calibration: null,
    spawnIndexCurrentMonth: 0,
    currentMonth: currentMonthString(),
    currentPet: createInitialPet(0, requiredTokens),
    ingestionState: { files: {} },
    globalStats: {
      totalTokensAllTime: 0,
      totalSessionsIngested: 0,
      earliestTimestamp: null,
      latestTimestamp: null,
    },
    lastEncouragementShownAt: null,
  };
}

export function loadState(path: string = STATE_PATH): AppState | null {
  const raw = readJson<Record<string, unknown>>(path);
  if (!raw) return null;

  // Version migration: v1 → v2 (reset pet, keep calibration/ingestion)
  if ((raw as { version?: number }).version === 1) {
    // Use unknown-based access for v1 data since types have changed
    const v1 = raw as Record<string, unknown>;
    const v1Pet = v1.currentPet as Record<string, unknown>;
    return {
      version: 2,
      calibration: v1.calibration as AppState["calibration"],
      spawnIndexCurrentMonth: 0,
      currentMonth: v1.currentMonth as string,
      currentPet: {
        petId: v1Pet.petId as string,
        spawnedAt: v1Pet.spawnedAt as string,
        requiredTokens: v1Pet.requiredTokens as number,
        consumedTokens: v1Pet.consumedTokens as number,
        spawnIndex: 0,
        personalitySnapshot: null,
        generatedDesigns: null,
      },
      ingestionState: v1.ingestionState as AppState["ingestionState"],
      globalStats: v1.globalStats as AppState["globalStats"],
      lastEncouragementShownAt: null,
    };
  }

  // Backfill lastEncouragementShownAt for pre-encouragement states
  let state = raw as unknown as AppState;
  if (!("lastEncouragementShownAt" in raw)) {
    state = { ...state, lastEncouragementShownAt: null };
  }
  // Backfill generatedDesigns for pre-LLM states
  const pet = raw.currentPet as Record<string, unknown> | undefined;
  if (pet && !("generatedDesigns" in pet)) {
    state = { ...state, currentPet: { ...state.currentPet, generatedDesigns: null } };
  }
  return state;
}

export function saveState(state: AppState, path: string = STATE_PATH): void {
  atomicWrite(path, state);
}

export function createInitialCollection(): Collection {
  return {
    version: 2,
    pets: [],
  };
}

export function loadCollection(path: string = COLLECTION_PATH): Collection {
  const raw = readJson<Record<string, unknown>>(path);
  if (!raw) return createInitialCollection();

  if ((raw as { version?: number }).version === 1) {
    return createInitialCollection(); // v1 → v2: reset collection
  }

  return raw as unknown as Collection;
}

export function saveCollection(
  collection: Collection,
  path: string = COLLECTION_PATH,
): void {
  atomicWrite(path, collection);
}

export function addCompletedPet(
  collection: Collection,
  pet: CompletedPet,
): Collection {
  return {
    ...collection,
    pets: [...collection.pets, pet],
  };
}

export function updatePetInState(
  state: AppState,
  petUpdate: Partial<PetRecord>,
): AppState {
  return {
    ...state,
    currentPet: { ...state.currentPet, ...petUpdate },
  };
}

export function updateIngestionFile(
  state: AppState,
  filePath: string,
  byteOffset: number,
  lastLineTimestamp: string | null,
): AppState {
  return {
    ...state,
    ingestionState: {
      ...state.ingestionState,
      files: {
        ...state.ingestionState.files,
        [filePath]: { byteOffset, lastLineTimestamp },
      },
    },
  };
}

export function updateEncouragementTimestamp(
  state: AppState,
  timestamp: string,
): AppState {
  return { ...state, lastEncouragementShownAt: timestamp };
}

export function updateGlobalStats(
  state: AppState,
  tokensDelta: number,
  sessionsDelta: number,
  timestamp: string,
): AppState {
  const prev = state.globalStats;
  return {
    ...state,
    globalStats: {
      totalTokensAllTime: prev.totalTokensAllTime + tokensDelta,
      totalSessionsIngested: prev.totalSessionsIngested + sessionsDelta,
      earliestTimestamp:
        prev.earliestTimestamp === null || timestamp < prev.earliestTimestamp
          ? timestamp
          : prev.earliestTimestamp,
      latestTimestamp:
        prev.latestTimestamp === null || timestamp > prev.latestTimestamp
          ? timestamp
          : prev.latestTimestamp,
    },
  };
}
