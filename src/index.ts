import { loadConfig, ensureDataDir, type Config, CLAUDE_PROJECTS_DIR } from "./config/index.js";
import {
  loadState, saveState, loadCollection, saveCollection,
  createInitialState, addCompletedPet, updateGlobalStats, updateIngestionFile, updatePetInState,
  acquireLock, releaseLock,
  type AppState, type Collection, type CompletedPet,
} from "./store/index.js";
import { scanLogFiles, readIncremental, aggregateSessions, type SessionMetrics } from "./ingestion/index.js";
import { advancePet, detectMonthChange, handleMonthChange } from "./progression/index.js";
import { classifySession, computeDepthMetrics, computeStyleMetrics, computeTraits } from "./personality/index.js";
import { generateSeed } from "./utils/seed.js";
import { expandHome } from "./utils/index.js";
import { hostname } from "node:os";
import { isFirstRun } from "./first-run/detect.js";
import { buildFirstRunState } from "./first-run/orchestrate.js";

export interface RunResult {
  readonly state: AppState;
  readonly collection: Collection;
  readonly newlyCompleted: readonly CompletedPet[];
}

export function runIngestion(config: Config, state: AppState): { state: AppState; sessionMetrics: SessionMetrics[] } {
  const logDir = config.logPath ? expandHome(config.logPath) : CLAUDE_PROJECTS_DIR;
  const files = scanLogFiles(logDir);
  let current = state;
  const allMetrics: SessionMetrics[] = [];

  for (const file of files) {
    const prev = current.ingestionState.files[file.filePath];
    const offset = prev?.byteOffset ?? 0;
    if (offset >= file.sizeBytes) continue;

    const { entries, newByteOffset } = readIncremental(file.filePath, offset);
    if (entries.length === 0) continue;

    const metrics = aggregateSessions(entries);
    allMetrics.push(...metrics);

    let totalNewTokens = 0;
    let earliest = "";
    let latest = "";
    for (const m of metrics) {
      totalNewTokens += m.totalTokens;
      if (!earliest || m.firstTimestamp < earliest) earliest = m.firstTimestamp;
      if (!latest || m.lastTimestamp > latest) latest = m.lastTimestamp;
    }

    if (totalNewTokens > 0) {
      current = updateGlobalStats(current, totalNewTokens, metrics.length, earliest || latest);
    }
    current = updateIngestionFile(current, file.filePath, newByteOffset, latest || null);
  }

  return { state: current, sessionMetrics: allMetrics };
}

export function runProgression(state: AppState, newTokens: number): { state: AppState; completed: CompletedPet[] } {
  if (newTokens === 0) return { state, completed: [] };

  let current = state;

  if (detectMonthChange(current.currentMonth)) {
    current = handleMonthChange(current);
  }

  const result = advancePet(current.currentPet, newTokens);

  const completedWithArt: CompletedPet[] = [];
  for (const pet of result.completedPets) {
    const seed = generateSeed(hostname(), pet.petId);
    completedWithArt.push({
      ...pet,
      seed,
    });
  }

  current = {
    ...current,
    currentPet: result.updatedPet,
  };

  return { state: current, completed: completedWithArt };
}

export function runPersonality(state: AppState, sessionMetrics: readonly SessionMetrics[]): AppState {
  if (sessionMetrics.length === 0) return state;

  const allSignals = sessionMetrics.map((m) => ({
    editedExtensions: m.editedExtensions,
    toolTransitions: m.toolTransitions,
    bashCommands: m.bashCommands,
    toolUseCounts: m.toolUseCounts,
  }));

  const merged = {
    editedExtensions: allSignals.flatMap((s) => s.editedExtensions),
    toolTransitions: allSignals.flatMap((s) => s.toolTransitions),
    bashCommands: allSignals.flatMap((s) => s.bashCommands),
    toolUseCounts: allSignals.reduce((acc, s) => {
      for (const [k, v] of Object.entries(s.toolUseCounts)) acc[k] = (acc[k] ?? 0) + v;
      return acc;
    }, {} as Record<string, number>),
  };

  const classification = classifySession(merged);
  const depth = computeDepthMetrics(sessionMetrics);
  const style = computeStyleMetrics(sessionMetrics.flatMap((m) => m.userMessageTexts));

  const traits = computeTraits(classification.scores, depth, style);

  return updatePetInState(state, {
    personalitySnapshot: {
      usageMix: classification.scores,
      depthMetrics: depth,
      styleMetrics: style,
      traits,
    },
  });
}

export async function runFull(config?: Config): Promise<RunResult> {
  const cfg = config ?? loadConfig();
  ensureDataDir();

  if (!acquireLock()) {
    throw new Error("Another tomotoken process is running. If this is stale, delete ~/.tomotoken/tomotoken.lock");
  }

  try {
    let state = loadState() ?? createInitialState();
    let collection = loadCollection();

    // First-run: generate initial pet from recent history
    if (isFirstRun(state, collection)) {
      const { state: postIngest, sessionMetrics } = runIngestion(cfg, state);
      state = postIngest;
      if (sessionMetrics.length > 0) {
        const firstRun = buildFirstRunState(sessionMetrics);
        collection = addCompletedPet(collection, firstRun.completedPet);
        state = {
          ...firstRun.nextPetState,
          ingestionState: state.ingestionState,  // Preserve byte offsets
        };
        saveState(state);
        saveCollection(collection);
        return { state, collection, newlyCompleted: [firstRun.completedPet] };
      }
      // No logs found on first run — save state to avoid re-entering first-run check
      saveState(state);
      saveCollection(collection);
      return { state, collection, newlyCompleted: [] };
    }

    // 1. Ingest
    const { state: postIngest, sessionMetrics } = runIngestion(cfg, state);
    state = postIngest;

    // 2. Personality
    state = runPersonality(state, sessionMetrics);

    // 3. Progress
    const newTokens = sessionMetrics.reduce((sum, m) => sum + m.totalTokens, 0);
    const { state: postProgress, completed } = runProgression(state, newTokens);
    state = postProgress;

    // 4. Save completed pets
    for (const pet of completed) {
      collection = addCompletedPet(collection, pet);
    }

    saveState(state);
    saveCollection(collection);

    return { state, collection, newlyCompleted: completed };
  } finally {
    releaseLock();
  }
}
