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

export function createInitialPet(spawnIndex: number, requiredTokens: number): PetRecord {
  return {
    petId: uuidv4(),
    spawnedAt: new Date().toISOString(),
    requiredTokens,
    consumedTokens: 0,
    spawnIndex,
    personalitySnapshot: null,
  };
}

function currentMonthString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function createInitialState(requiredTokens: number): AppState {
  return {
    version: 1,
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
  };
}

export function loadState(path: string = STATE_PATH): AppState | null {
  return readJson<AppState>(path);
}

export function saveState(state: AppState, path: string = STATE_PATH): void {
  atomicWrite(path, state);
}

export function createInitialCollection(): Collection {
  return {
    version: 1,
    pets: [],
  };
}

export function loadCollection(path: string = COLLECTION_PATH): Collection {
  return readJson<Collection>(path) ?? createInitialCollection();
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
