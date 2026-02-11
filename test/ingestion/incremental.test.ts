import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { readIncremental } from "../../src/ingestion/incremental.js";

const TMP = join(__dirname, "../tmp-incremental");
const FILE = join(TMP, "test.jsonl");

beforeEach(() => {
  mkdirSync(TMP, { recursive: true });
  const lines = [
    '{"type":"assistant","sessionId":"s1","timestamp":"2026-01-01T00:00:00Z","uuid":"1","message":{"usage":{"input_tokens":10,"output_tokens":5,"cache_creation_input_tokens":0,"cache_read_input_tokens":0},"content":[],"model":"test"}}',
    '{"type":"user","sessionId":"s1","timestamp":"2026-01-01T00:01:00Z","uuid":"2","message":{"role":"user","content":"hi"}}',
  ];
  writeFileSync(FILE, lines.join("\n") + "\n");
});

afterEach(() => rmSync(TMP, { recursive: true, force: true }));

describe("readIncremental", () => {
  it("reads all lines from offset 0", () => {
    const result = readIncremental(FILE, 0);
    expect(result.entries).toHaveLength(2);
    expect(result.newByteOffset).toBeGreaterThan(0);
  });

  it("reads only new lines from previous offset", () => {
    const first = readIncremental(FILE, 0);
    // Append a new line
    const newLine = '{"type":"assistant","sessionId":"s1","timestamp":"2026-01-01T00:02:00Z","uuid":"3","message":{"usage":{"input_tokens":20,"output_tokens":10,"cache_creation_input_tokens":0,"cache_read_input_tokens":0},"content":[],"model":"test"}}';
    writeFileSync(FILE, newLine + "\n", { flag: "a" });

    const second = readIncremental(FILE, first.newByteOffset);
    expect(second.entries).toHaveLength(1);
    expect(second.entries[0].usage?.inputTokens).toBe(20);
  });
});
