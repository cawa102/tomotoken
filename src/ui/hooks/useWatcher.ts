import { useState, useEffect, useRef, useCallback } from "react";
import { LogWatcher } from "../../ingestion/watcher.js";
import { runIngestion, runCalibration, runProgression, runPersonality } from "../../index.js";
import {
  saveState, saveCollection, addCompletedPet, updatePetInState,
  type AppState, type Collection, type CompletedPet,
} from "../../store/index.js";
import type { Config } from "../../config/schema.js";
import { expandHome } from "../../utils/index.js";
import { CLAUDE_PROJECTS_DIR } from "../../config/constants.js";

interface WatcherState {
  readonly state: AppState;
  readonly collection: Collection;
  readonly newlyCompleted: readonly CompletedPet[];
  readonly updateCount: number;
}

interface CycleResult {
  readonly state: AppState;
  readonly collection: Collection;
  readonly completed: readonly CompletedPet[];
}

export const POLL_INTERVAL_MS = 5_000;
const COMPLETION_DISPLAY_MS = 10_000;

/**
 * Pure function: runs one ingestion→calibration→personality→progression cycle.
 * Returns null when there is nothing new to process.
 */
export async function executeCycle(
  config: Config,
  currentState: AppState,
  currentCollection: Collection,
): Promise<CycleResult | null> {
  // 1. Ingest new log data
  const { state: postIngest, sessionMetrics } = runIngestion(config, currentState);
  if (sessionMetrics.length === 0) return null;

  // 2. Recalibrate if needed
  let state = postIngest;
  if (!state.calibration) {
    state = runCalibration(state, config);
    if (state.calibration) {
      const t0 = state.calibration.t0;
      state = updatePetInState(state, {
        requiredTokens: Math.ceil(t0 * Math.pow(config.growth.g, state.spawnIndexCurrentMonth)),
      });
    }
  }

  // 3. Personality
  state = runPersonality(state, sessionMetrics);

  // 4. Progression
  const newTokens = sessionMetrics.reduce((sum, m) => sum + m.totalTokens, 0);
  const { state: postProgress, completed } = runProgression(state, newTokens, config);
  state = postProgress;

  // 5. Accumulate completed pets
  const finalCollection = completed.reduce(
    (acc, pet) => addCompletedPet(acc, pet),
    currentCollection,
  );

  return { state, collection: finalCollection, completed };
}

export function useWatcher(
  config: Config,
  initialState: AppState,
  initialCollection: Collection,
): WatcherState {
  const [appState, setAppState] = useState<AppState>(initialState);
  const [collection, setCollection] = useState<Collection>(initialCollection);
  const [newlyCompleted, setNewlyCompleted] = useState<readonly CompletedPet[]>([]);
  const [updateCount, setUpdateCount] = useState(0);
  const dirtyRef = useRef(true);
  const stateRef = useRef(appState);
  const collectionRef = useRef(collection);
  const runningRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => { stateRef.current = appState; }, [appState]);
  useEffect(() => { collectionRef.current = collection; }, [collection]);

  // Auto-clear completion banner after timeout
  useEffect(() => {
    if (newlyCompleted.length === 0) return;
    const timer = setTimeout(() => setNewlyCompleted([]), COMPLETION_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [newlyCompleted]);

  const runCycle = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      const result = await executeCycle(config, stateRef.current, collectionRef.current);
      if (!result) return;

      // Persist to disk
      saveState(result.state);
      saveCollection(result.collection);

      // Update React state
      setAppState(result.state);
      setCollection(result.collection);
      if (result.completed.length > 0) {
        setNewlyCompleted(result.completed);
      }
      setUpdateCount((prev) => prev + 1);
    } finally {
      runningRef.current = false;
    }
  }, [config]);

  useEffect(() => {
    const logDir = config.logPath ? expandHome(config.logPath) : CLAUDE_PROJECTS_DIR;

    // Start fs.watch
    const watcher = new LogWatcher();
    watcher.start([logDir]);
    watcher.on("change", () => {
      dirtyRef.current = true;
    });

    // Poll interval: only run cycle when dirty flag is set
    const interval = setInterval(() => {
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      runCycle().catch(() => {
        // Ingestion errors are non-fatal in watch mode
      });
    }, POLL_INTERVAL_MS);

    // Run initial cycle immediately if dirty
    if (dirtyRef.current) {
      dirtyRef.current = false;
      runCycle().catch(() => {
        // Non-fatal
      });
    }

    return () => {
      watcher.stop();
      clearInterval(interval);
    };
  }, [config, runCycle]);

  return { state: appState, collection, newlyCompleted, updateCount };
}
