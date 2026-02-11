import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseLine } from "../../src/ingestion/parser.js";
import { aggregateSessions } from "../../src/ingestion/aggregator.js";
import type { ParsedLogEntry } from "../../src/ingestion/types.js";

const FIXTURE = join(__dirname, "../fixtures/sample-session.jsonl");

function loadEntries(): ParsedLogEntry[] {
  return readFileSync(FIXTURE, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((line) => parseLine(line))
    .filter((e): e is ParsedLogEntry => e !== null);
}

describe("aggregateSessions", () => {
  it("aggregates entries into session metrics", () => {
    const entries = loadEntries();
    const sessions = aggregateSessions(entries);
    expect(sessions).toHaveLength(1);

    const s = sessions[0];
    expect(s.sessionId).toBe("test-session-1");
    // 650 + 730 + 610 = 1990
    expect(s.totalTokens).toBe(1990);
    expect(s.entryCount).toBe(entries.length);
  });

  it("collects tool transitions", () => {
    const entries = loadEntries();
    const sessions = aggregateSessions(entries);
    expect(sessions[0].toolTransitions).toEqual(["Read", "Edit", "Bash"]);
  });

  it("collects edited file extensions", () => {
    const entries = loadEntries();
    const sessions = aggregateSessions(entries);
    expect(sessions[0].editedExtensions).toContain(".ts");
  });

  it("collects bash commands", () => {
    const entries = loadEntries();
    const sessions = aggregateSessions(entries);
    expect(sessions[0].bashCommands).toContain("npm test");
  });

  it("tracks first and last timestamps", () => {
    const entries = loadEntries();
    const sessions = aggregateSessions(entries);
    expect(sessions[0].firstTimestamp).toBe("2026-01-15T10:00:00.000Z");
    expect(sessions[0].lastTimestamp).toBe("2026-01-15T10:00:40.000Z");
  });
});
