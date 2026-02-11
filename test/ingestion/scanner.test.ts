import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { scanLogFiles } from "../../src/ingestion/scanner.js";

const TMP = join(__dirname, "../tmp-scanner");

beforeEach(() => {
  mkdirSync(join(TMP, "proj-a"), { recursive: true });
  mkdirSync(join(TMP, "proj-b", "sess-uuid", "subagents"), { recursive: true });
  writeFileSync(join(TMP, "proj-a", "session1.jsonl"), "{}");
  writeFileSync(join(TMP, "proj-b", "session2.jsonl"), "{}");
  writeFileSync(join(TMP, "proj-b", "sess-uuid", "subagents", "agent-abc.jsonl"), "{}");
});

afterEach(() => rmSync(TMP, { recursive: true, force: true }));

describe("scanLogFiles", () => {
  it("finds .jsonl files recursively", () => {
    const results = scanLogFiles(TMP);
    const paths = results.map((r) => r.filePath);
    expect(paths).toHaveLength(3);
    expect(paths.some((p) => p.endsWith("session1.jsonl"))).toBe(true);
    expect(paths.some((p) => p.endsWith("agent-abc.jsonl"))).toBe(true);
  });

  it("returns file sizes", () => {
    const results = scanLogFiles(TMP);
    for (const r of results) {
      expect(r.sizeBytes).toBeGreaterThanOrEqual(0);
    }
  });
});
