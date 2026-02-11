import type { SessionMetrics } from "../ingestion/types.js";
import type { DepthMetrics } from "../store/types.js";

export function computeDepthMetrics(sessions: readonly SessionMetrics[]): DepthMetrics {
  let editTestLoopCount = 0;
  let repeatEditSameFileCount = 0;
  let phaseSwitchCount = 0;

  for (const session of sessions) {
    const transitions = session.toolTransitions;
    for (let i = 0; i < transitions.length - 1; i++) {
      const a = transitions[i];
      const b = transitions[i + 1];
      if ((a === "Edit" || a === "Write") && b === "Bash") editTestLoopCount++;
      if (a === b && (a === "Edit" || a === "Write")) repeatEditSameFileCount++;
      if (a !== b) phaseSwitchCount++;
    }
  }

  return { editTestLoopCount, repeatEditSameFileCount, phaseSwitchCount, totalSessions: sessions.length };
}
