import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseLine } from "../../src/ingestion/parser.js";

const FIXTURE = join(__dirname, "../fixtures/sample-session.jsonl");

function loadFixtureLines(): string[] {
  return readFileSync(FIXTURE, "utf-8").split("\n").filter(Boolean);
}

describe("parseLine", () => {
  it("parses assistant entry with usage and tool_use", () => {
    const lines = loadFixtureLines();
    const entry = parseLine(lines[1]); // first assistant line
    expect(entry).not.toBeNull();
    expect(entry!.type).toBe("assistant");
    expect(entry!.sessionId).toBe("test-session-1");
    expect(entry!.usage).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      cacheCreationInputTokens: 200,
      cacheReadInputTokens: 300,
    });
    expect(entry!.toolUses).toEqual([{ name: "Read", id: "tu1" }]);
    expect(entry!.model).toBe("claude-opus-4-6");
  });

  it("extracts edited file paths from Edit tool_use", () => {
    const lines = loadFixtureLines();
    const entry = parseLine(lines[3]); // Edit tool_use
    expect(entry!.editedFiles).toEqual(["/project/src/auth/login.ts"]);
  });

  it("extracts bash commands from Bash tool_use", () => {
    const lines = loadFixtureLines();
    const entry = parseLine(lines[5]); // Bash tool_use
    expect(entry!.bashCommands).toEqual(["npm test"]);
  });

  it("parses user entry with tool result", () => {
    const lines = loadFixtureLines();
    const entry = parseLine(lines[2]); // user with toolUseResult
    expect(entry!.type).toBe("user");
    expect(entry!.hasToolResult).toBe(true);
  });

  it("returns null for corrupt lines", () => {
    expect(parseLine("not json at all")).toBeNull();
    expect(parseLine("")).toBeNull();
  });

  it("handles progress/summary types", () => {
    const lines = loadFixtureLines();
    const progress = parseLine(lines[6]);
    expect(progress!.type).toBe("progress");
    expect(progress!.usage).toBeNull();

    const summary = parseLine(lines[8]);
    expect(summary!.type).toBe("summary");
  });
});
