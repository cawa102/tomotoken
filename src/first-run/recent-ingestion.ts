import type { SessionMetrics } from "../ingestion/types.js";

export function extractRecentTokens(
  sessions: readonly SessionMetrics[],
  tokenLimit: number,
): SessionMetrics[] {
  const sorted = [...sessions].sort((a, b) =>
    b.lastTimestamp.localeCompare(a.lastTimestamp),
  );

  const result: SessionMetrics[] = [];
  let accumulated = 0;

  for (const session of sorted) {
    if (accumulated + session.totalTokens > tokenLimit && result.length > 0) {
      break;
    }
    result.push(session);
    accumulated += session.totalTokens;
  }

  return result;
}
