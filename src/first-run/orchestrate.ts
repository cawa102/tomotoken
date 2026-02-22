import { v4 as uuidv4 } from "uuid";
import { hostname } from "node:os";
import type { SessionMetrics } from "../ingestion/types.js";
import type {
  AppState,
  CompletedPet,
  PersonalitySnapshot,
} from "../store/types.js";
import { createInitialState } from "../store/store.js";
import {
  classifySession,
  computeDepthMetrics,
  computeStyleMetrics,
  computeTraits,
} from "../personality/index.js";
import { extractRecentTokens } from "./recent-ingestion.js";
import { generateSeed } from "../utils/seed.js";
import { TOKENS_PER_PET } from "../config/constants.js";

interface FirstRunResult {
  readonly completedPet: CompletedPet;
  readonly nextPetState: AppState;
}

export function buildFirstRunState(
  allSessions: readonly SessionMetrics[],
): FirstRunResult {
  const recentSessions = extractRecentTokens(allSessions, TOKENS_PER_PET);

  const allSignals = recentSessions.map((m) => ({
    editedExtensions: m.editedExtensions,
    toolTransitions: m.toolTransitions,
    bashCommands: m.bashCommands,
    toolUseCounts: m.toolUseCounts,
  }));

  const merged = {
    editedExtensions: allSignals.flatMap((s) => s.editedExtensions),
    toolTransitions: allSignals.flatMap((s) => s.toolTransitions),
    bashCommands: allSignals.flatMap((s) => s.bashCommands),
    toolUseCounts: allSignals.reduce(
      (acc, s) => {
        for (const [k, v] of Object.entries(s.toolUseCounts))
          acc[k] = (acc[k] ?? 0) + v;
        return acc;
      },
      {} as Record<string, number>,
    ),
  };

  const classification = classifySession(merged);
  const depth = computeDepthMetrics(recentSessions);
  const style = computeStyleMetrics(
    recentSessions.flatMap((m) => m.userMessageTexts),
  );
  const traits = computeTraits(classification.scores, depth, style);

  const personality: PersonalitySnapshot = {
    usageMix: classification.scores,
    depthMetrics: depth,
    styleMetrics: style,
    traits,
  };

  const totalTokens = recentSessions.reduce(
    (sum, s) => sum + s.totalTokens,
    0,
  );
  const petId = uuidv4();
  const now = new Date().toISOString();
  const seed = generateSeed(hostname(), petId);

  const completedPet: CompletedPet = {
    petId,
    spawnedAt: now,
    completedAt: now,
    requiredTokens: Math.max(totalTokens, TOKENS_PER_PET),
    consumedTokens: Math.max(totalTokens, TOKENS_PER_PET),
    spawnIndex: 0,
    personality,
    seed,
  };

  const baseState = createInitialState();
  const nextPetState: AppState = {
    ...baseState,
    currentPet: {
      ...baseState.currentPet,
      spawnIndex: 1,
    },
    globalStats: {
      totalTokensAllTime: totalTokens,
      totalSessionsIngested: recentSessions.length,
      earliestTimestamp:
        recentSessions.length > 0
          ? recentSessions.reduce(
              (e, s) => (s.firstTimestamp < e ? s.firstTimestamp : e),
              recentSessions[0].firstTimestamp,
            )
          : null,
      latestTimestamp:
        recentSessions.length > 0
          ? recentSessions.reduce(
              (l, s) => (s.lastTimestamp > l ? s.lastTimestamp : l),
              recentSessions[0].lastTimestamp,
            )
          : null,
    },
  };

  return { completedPet, nextPetState };
}
