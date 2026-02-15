import { describe, it, expect } from "vitest";
import { computeDepthMetrics } from "../../src/personality/depth.js";
import type { SessionMetrics } from "../../src/ingestion/types.js";

function makeSession(transitions: string[]): SessionMetrics {
  return {
    totalTokens: 100,
    editedExtensions: [],
    toolTransitions: transitions,
    bashCommands: [],
    toolUseCounts: {},
    userMessageTexts: [],
    firstTimestamp: "",
    lastTimestamp: "",
  };
}

describe("computeDepthMetrics", () => {
  it("returns zeros for empty sessions", () => {
    const result = computeDepthMetrics([]);
    expect(result).toEqual({
      editTestLoopCount: 0,
      repeatEditSameFileCount: 0,
      phaseSwitchCount: 0,
      totalSessions: 0,
    });
  });

  it("counts edit→bash as editTestLoop", () => {
    const session = makeSession(["Edit", "Bash"]);
    const result = computeDepthMetrics([session]);
    expect(result.editTestLoopCount).toBe(1);
  });

  it("counts write→bash as editTestLoop", () => {
    const session = makeSession(["Write", "Bash"]);
    const result = computeDepthMetrics([session]);
    expect(result.editTestLoopCount).toBe(1);
  });

  it("counts consecutive same edits as repeatEditSameFile", () => {
    const session = makeSession(["Edit", "Edit", "Write", "Write"]);
    const result = computeDepthMetrics([session]);
    expect(result.repeatEditSameFileCount).toBe(2);
  });

  it("counts different consecutive tools as phaseSwitch", () => {
    const session = makeSession(["Edit", "Bash", "Read", "Edit"]);
    const result = computeDepthMetrics([session]);
    expect(result.phaseSwitchCount).toBe(3);
  });

  it("tracks totalSessions", () => {
    const sessions = [makeSession(["Edit"]), makeSession(["Bash"])];
    const result = computeDepthMetrics(sessions);
    expect(result.totalSessions).toBe(2);
  });

  it("accumulates across multiple sessions", () => {
    const s1 = makeSession(["Edit", "Bash", "Edit", "Bash"]);
    const s2 = makeSession(["Write", "Bash"]);
    const result = computeDepthMetrics([s1, s2]);
    expect(result.editTestLoopCount).toBe(3);
    expect(result.totalSessions).toBe(2);
  });
});
