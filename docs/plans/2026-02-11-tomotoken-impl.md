# Tomotoken Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a CLI tool that visualizes Claude Code token usage as a growing ASCII pet character.

**Architecture:** 5 domains (ingestion → progression → personality → art → UI) communicate via barrel exports. JSON files for persistence. Ink 5 for TUI rendering. All deterministic, no AI calls.

**Tech Stack:** TypeScript, Node.js 18+, Ink 5, chalk, commander, zod, vitest, tsup

**What's Already Built:** Project scaffold (package.json, tsconfig, vitest.config, tsup.config), src/config/ (constants, schema, loader), src/store/ (types, store with atomic JSON read/write), src/utils/ (hash/sha256/mulberry32 PRNG, clamp, time, path), and all type files for ingestion/progression/personality/art.

---

## Phase 1: Ingestion

- [x] Task 1: Test fixture JSONL file

**Files:**
- Create: `test/fixtures/sample-session.jsonl`

**Step 1: Create realistic JSONL fixture**

```jsonl
{"type":"user","sessionId":"test-session-1","timestamp":"2026-01-15T10:00:00.000Z","uuid":"u1","parentUuid":null,"message":{"role":"user","content":"Fix the login bug"}}
{"type":"assistant","sessionId":"test-session-1","timestamp":"2026-01-15T10:00:05.000Z","uuid":"a1","parentUuid":"u1","cwd":"/project","version":"2.1.39","gitBranch":"main","message":{"model":"claude-opus-4-6","id":"msg_1","type":"message","role":"assistant","content":[{"type":"text","text":"Let me look at the login code."},{"type":"tool_use","id":"tu1","name":"Read","input":{"file_path":"/project/src/auth/login.ts"}}],"stop_reason":"tool_use","usage":{"input_tokens":100,"output_tokens":50,"cache_creation_input_tokens":200,"cache_read_input_tokens":300}}}
{"type":"user","sessionId":"test-session-1","timestamp":"2026-01-15T10:00:10.000Z","uuid":"u2","parentUuid":"a1","toolUseResult":true,"message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"tu1","content":"file contents here"}]}}
{"type":"assistant","sessionId":"test-session-1","timestamp":"2026-01-15T10:00:15.000Z","uuid":"a2","parentUuid":"u2","cwd":"/project","version":"2.1.39","gitBranch":"main","message":{"model":"claude-opus-4-6","id":"msg_2","type":"message","role":"assistant","content":[{"type":"tool_use","id":"tu2","name":"Edit","input":{"file_path":"/project/src/auth/login.ts","old_string":"broken","new_string":"fixed"}}],"stop_reason":"tool_use","usage":{"input_tokens":150,"output_tokens":80,"cache_creation_input_tokens":0,"cache_read_input_tokens":500}}}
{"type":"user","sessionId":"test-session-1","timestamp":"2026-01-15T10:00:20.000Z","uuid":"u3","parentUuid":"a2","toolUseResult":true,"message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"tu2","content":"ok"}]}}
{"type":"assistant","sessionId":"test-session-1","timestamp":"2026-01-15T10:00:25.000Z","uuid":"a3","parentUuid":"u3","cwd":"/project","version":"2.1.39","gitBranch":"main","message":{"model":"claude-opus-4-6","id":"msg_3","type":"message","role":"assistant","content":[{"type":"tool_use","id":"tu3","name":"Bash","input":{"command":"npm test","description":"Run tests"}}],"stop_reason":"tool_use","usage":{"input_tokens":80,"output_tokens":30,"cache_creation_input_tokens":100,"cache_read_input_tokens":400}}}
{"type":"progress","sessionId":"test-session-1","timestamp":"2026-01-15T10:00:30.000Z","uuid":"p1","parentUuid":"a3"}
{"type":"user","sessionId":"test-session-1","timestamp":"2026-01-15T10:00:35.000Z","uuid":"u4","parentUuid":"a3","toolUseResult":true,"message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"tu3","content":"all tests pass"}]}}
{"type":"summary","sessionId":"test-session-1","timestamp":"2026-01-15T10:00:40.000Z","uuid":"s1","parentUuid":"u4"}
```

Token totals for test-session-1:
- Entry a1: 100+50+200+300 = 650
- Entry a2: 150+80+0+500 = 730
- Entry a3: 80+30+100+400 = 610
- Total: 1990

**Step 2: Commit**
```bash
git add test/fixtures/sample-session.jsonl
git commit -m "test: add JSONL fixture for ingestion tests"
```

---

- [x] Task 2: JSONL parser

**Files:**
- Test: `test/ingestion/parser.test.ts`
- Create: `src/ingestion/parser.ts`

**Step 1: Write failing test**

```typescript
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
```

**Step 2: Run test to verify it fails**
```bash
npx vitest run test/ingestion/parser.test.ts
```
Expected: FAIL — module not found

**Step 3: Implement parser**

```typescript
import type { ParsedLogEntry, TokenUsage, ToolUseEvent } from "./types.js";

export function parseLine(line: string): ParsedLogEntry | null {
  if (!line.trim()) return null;

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(line);
  } catch {
    return null;
  }

  const type = raw.type as string;
  if (!type) return null;

  const validTypes = ["assistant", "user", "progress", "summary", "file-history-snapshot"];
  if (!validTypes.includes(type)) return null;

  const timestamp = (raw.timestamp as string) ?? "";
  const sessionId = (raw.sessionId as string) ?? "";
  const uuid = (raw.uuid as string) ?? "";
  const parentUuid = (raw.parentUuid as string) ?? null;

  let model: string | null = null;
  let usage: TokenUsage | null = null;
  const toolUses: ToolUseEvent[] = [];
  const editedFiles: string[] = [];
  const bashCommands: string[] = [];
  let hasToolResult = false;
  let textContent: string | null = null;

  const message = raw.message as Record<string, unknown> | undefined;

  if (type === "assistant" && message) {
    model = (message.model as string) ?? null;

    const rawUsage = message.usage as Record<string, number> | undefined;
    if (rawUsage) {
      usage = {
        inputTokens: rawUsage.input_tokens ?? 0,
        outputTokens: rawUsage.output_tokens ?? 0,
        cacheCreationInputTokens: rawUsage.cache_creation_input_tokens ?? 0,
        cacheReadInputTokens: rawUsage.cache_read_input_tokens ?? 0,
      };
    }

    const content = message.content as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === "tool_use") {
          const name = block.name as string;
          const id = block.id as string;
          toolUses.push({ name, id });

          const input = block.input as Record<string, unknown> | undefined;
          if (input) {
            if (name === "Write" || name === "Edit") {
              const fp = input.file_path as string | undefined;
              if (fp) editedFiles.push(fp);
            } else if (name === "Bash") {
              const cmd = input.command as string | undefined;
              if (cmd) bashCommands.push(cmd);
            }
          }
        } else if (block.type === "text") {
          textContent = block.text as string;
        }
      }
    }
  }

  if (type === "user") {
    hasToolResult = raw.toolUseResult === true;

    if (message) {
      const content = message.content;
      if (typeof content === "string") {
        textContent = content;
      }
    }
  }

  return {
    type: type as ParsedLogEntry["type"],
    timestamp,
    sessionId,
    uuid,
    parentUuid,
    model,
    usage,
    toolUses,
    hasToolResult,
    textContent,
    editedFiles,
    bashCommands,
  };
}
```

**Step 4: Run test to verify it passes**
```bash
npx vitest run test/ingestion/parser.test.ts
```
Expected: ALL PASS

**Step 5: Commit**
```bash
git add src/ingestion/parser.ts test/ingestion/parser.test.ts
git commit -m "feat: add JSONL line parser for Claude Code logs"
```

---

- [x] Task 3: Session aggregator

**Files:**
- Test: `test/ingestion/aggregator.test.ts`
- Create: `src/ingestion/aggregator.ts`

**Step 1: Write failing test**

```typescript
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
```

**Step 2: Run test — expect FAIL**
```bash
npx vitest run test/ingestion/aggregator.test.ts
```

**Step 3: Implement aggregator**

```typescript
import { extname } from "node:path";
import type { ParsedLogEntry, SessionMetrics } from "./types.js";

export function aggregateSessions(entries: readonly ParsedLogEntry[]): SessionMetrics[] {
  const groups = new Map<string, ParsedLogEntry[]>();

  for (const entry of entries) {
    if (!entry.sessionId) continue;
    const list = groups.get(entry.sessionId) ?? [];
    list.push(entry);
    groups.set(entry.sessionId, list);
  }

  const results: SessionMetrics[] = [];

  for (const [sessionId, sessionEntries] of groups) {
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheTokens = 0;
    const toolUseCounts: Record<string, number> = {};
    const toolTransitions: string[] = [];
    const editedExtSet = new Set<string>();
    const bashCmds: string[] = [];
    const userTexts: string[] = [];
    let firstTs = "";
    let lastTs = "";

    for (const entry of sessionEntries) {
      // Track timestamps
      if (!firstTs || entry.timestamp < firstTs) firstTs = entry.timestamp;
      if (!lastTs || entry.timestamp > lastTs) lastTs = entry.timestamp;

      if (entry.usage) {
        inputTokens += entry.usage.inputTokens;
        outputTokens += entry.usage.outputTokens;
        cacheTokens += entry.usage.cacheCreationInputTokens + entry.usage.cacheReadInputTokens;
      }

      for (const tu of entry.toolUses) {
        toolUseCounts[tu.name] = (toolUseCounts[tu.name] ?? 0) + 1;
        const lastTool = toolTransitions[toolTransitions.length - 1];
        if (lastTool !== tu.name) {
          toolTransitions.push(tu.name);
        }
      }

      for (const fp of entry.editedFiles) {
        editedExtSet.add(extname(fp));
      }

      bashCmds.push(...entry.bashCommands);

      if (entry.type === "user" && entry.textContent) {
        userTexts.push(entry.textContent);
      }
    }

    results.push({
      sessionId,
      totalTokens: inputTokens + outputTokens + cacheTokens,
      inputTokens,
      outputTokens,
      cacheTokens,
      toolUseCounts,
      toolTransitions,
      editedExtensions: [...editedExtSet],
      bashCommands: bashCmds,
      userMessageTexts: userTexts,
      entryCount: sessionEntries.length,
      firstTimestamp: firstTs,
      lastTimestamp: lastTs,
    });
  }

  return results;
}
```

**Step 4: Run test — expect PASS**
```bash
npx vitest run test/ingestion/aggregator.test.ts
```

**Step 5: Commit**
```bash
git add src/ingestion/aggregator.ts test/ingestion/aggregator.test.ts
git commit -m "feat: add session aggregator for token metrics"
```

---

- [x] Task 4: Log file scanner

**Files:**
- Create: `src/ingestion/scanner.ts`
- Test: `test/ingestion/scanner.test.ts`

**Step 1: Write failing test**

```typescript
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
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement scanner**

```typescript
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ScanResult } from "./types.js";

export function scanLogFiles(baseDir: string): ScanResult[] {
  const results: ScanResult[] = [];
  walk(baseDir, results);
  return results;
}

function walk(dir: string, results: ScanResult[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const name of entries) {
    const fullPath = join(dir, name);
    let st;
    try {
      st = statSync(fullPath);
    } catch {
      continue;
    }

    if (st.isDirectory()) {
      walk(fullPath, results);
    } else if (name.endsWith(".jsonl")) {
      results.push({ filePath: fullPath, sizeBytes: st.size });
    }
  }
}
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**
```bash
git add src/ingestion/scanner.ts test/ingestion/scanner.test.ts
git commit -m "feat: add recursive JSONL file scanner"
```

---

- [x] Task 5: Incremental reader

**Files:**
- Create: `src/ingestion/incremental.ts`
- Test: `test/ingestion/incremental.test.ts`

**Step 1: Write failing test**

```typescript
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
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement incremental reader**

```typescript
import { openSync, readSync, closeSync, statSync } from "node:fs";
import { parseLine } from "./parser.js";
import type { ParsedLogEntry } from "./types.js";

export interface IncrementalResult {
  readonly entries: readonly ParsedLogEntry[];
  readonly newByteOffset: number;
}

export function readIncremental(filePath: string, fromOffset: number): IncrementalResult {
  const st = statSync(filePath);
  if (fromOffset >= st.size) {
    return { entries: [], newByteOffset: fromOffset };
  }

  const bytesToRead = st.size - fromOffset;
  const buffer = Buffer.alloc(bytesToRead);
  const fd = openSync(filePath, "r");
  try {
    readSync(fd, buffer, 0, bytesToRead, fromOffset);
  } finally {
    closeSync(fd);
  }

  const text = buffer.toString("utf-8");
  const lines = text.split("\n");
  const entries: ParsedLogEntry[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const parsed = parseLine(line);
    if (parsed) entries.push(parsed);
  }

  return { entries, newByteOffset: st.size };
}
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**
```bash
git add src/ingestion/incremental.ts test/ingestion/incremental.test.ts
git commit -m "feat: add incremental JSONL reader with byte offset tracking"
```

---

- [x] Task 6: File watcher + ingestion barrel export

**Files:**
- Create: `src/ingestion/watcher.ts`
- Create: `src/ingestion/index.ts`

**Step 1: Implement watcher** (thin wrapper, tested via integration)

```typescript
import { watch, type FSWatcher } from "node:fs";
import { EventEmitter } from "node:events";

export class LogWatcher extends EventEmitter {
  private watchers: FSWatcher[] = [];

  start(dirs: string[]): void {
    for (const dir of dirs) {
      try {
        const w = watch(dir, { recursive: true }, (eventType, filename) => {
          if (filename && filename.endsWith(".jsonl")) {
            this.emit("change", { eventType, filename, dir });
          }
        });
        this.watchers.push(w);
      } catch {
        // Directory may not exist yet
      }
    }
  }

  stop(): void {
    for (const w of this.watchers) {
      w.close();
    }
    this.watchers = [];
  }
}
```

**Step 2: Create barrel export**

```typescript
// src/ingestion/index.ts
export { parseLine } from "./parser.js";
export { aggregateSessions } from "./aggregator.js";
export { scanLogFiles } from "./scanner.js";
export { readIncremental, type IncrementalResult } from "./incremental.js";
export { LogWatcher } from "./watcher.js";
export type {
  ParsedLogEntry,
  TokenUsage,
  ToolUseEvent,
  SessionMetrics,
  ScanResult,
  IngestDelta,
} from "./types.js";
```

**Step 3: Commit**
```bash
git add src/ingestion/watcher.ts src/ingestion/index.ts
git commit -m "feat: add log file watcher and ingestion barrel export"
```

---

## Phase 2: Progression

- [x] Task 7: Calibration (T0 computation)

**Files:**
- Test: `test/progression/calibration.test.ts`
- Create: `src/progression/calibration.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect } from "vitest";
import { computeCalibration } from "../../src/progression/calibration.js";

describe("computeCalibration", () => {
  it("computes T0 = M / 4.75 with g=1.5", () => {
    // 100k tokens over 10 days → M = (100000/10)*30 = 300000
    // T0 = 300000 / 4.75 = 63157.89... → ceil = 63158
    const result = computeCalibration(
      {
        totalTokensAllTime: 100_000,
        earliestTimestamp: "2026-01-01T00:00:00Z",
        latestTimestamp: "2026-01-10T00:00:00Z",
      },
      1.5,
      "ceil",
    );
    expect(result.monthlyEstimate).toBe(300_000);
    expect(result.t0).toBe(63158);
  });

  it("applies floor rounding", () => {
    const result = computeCalibration(
      {
        totalTokensAllTime: 100_000,
        earliestTimestamp: "2026-01-01T00:00:00Z",
        latestTimestamp: "2026-01-10T00:00:00Z",
      },
      1.5,
      "floor",
    );
    expect(result.t0).toBe(63157);
  });

  it("enforces minimum T0 of 1000", () => {
    const result = computeCalibration(
      {
        totalTokensAllTime: 100,
        earliestTimestamp: "2026-01-01T00:00:00Z",
        latestTimestamp: "2026-01-30T00:00:00Z",
      },
      1.5,
      "ceil",
    );
    expect(result.t0).toBeGreaterThanOrEqual(1000);
  });

  it("handles single-day data", () => {
    // Same day: daysBetween returns 1
    const result = computeCalibration(
      {
        totalTokensAllTime: 50_000,
        earliestTimestamp: "2026-01-15T08:00:00Z",
        latestTimestamp: "2026-01-15T20:00:00Z",
      },
      1.5,
      "ceil",
    );
    // M = (50000/1)*30 = 1500000, T0 = 1500000/4.75 = 315789.47... → 315790
    expect(result.monthlyEstimate).toBe(1_500_000);
    expect(result.t0).toBe(315790);
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement calibration**

```typescript
import { daysBetween } from "../utils/time.js";
import type { CalibrationInput, CalibrationResult } from "./types.js";

const MIN_T0 = 1000;

export function computeCalibration(
  input: CalibrationInput,
  g: number,
  rounding: "ceil" | "floor" | "round",
): CalibrationResult {
  const days = daysBetween(input.earliestTimestamp, input.latestTimestamp);
  const monthlyEstimate = (input.totalTokensAllTime / days) * 30;
  const denominator = 1 + g + g * g;
  const rawT0 = monthlyEstimate / denominator;

  let t0: number;
  switch (rounding) {
    case "ceil":
      t0 = Math.ceil(rawT0);
      break;
    case "floor":
      t0 = Math.floor(rawT0);
      break;
    case "round":
      t0 = Math.round(rawT0);
      break;
  }

  t0 = Math.max(MIN_T0, t0);

  return { monthlyEstimate, t0 };
}
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**
```bash
git add src/progression/calibration.ts test/progression/calibration.test.ts
git commit -m "feat: add T0 calibration from token history"
```

---

- [x] Task 8: Progression engine (pet advancement + overflow)

**Files:**
- Test: `test/progression/engine.test.ts`
- Create: `src/progression/engine.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect } from "vitest";
import { advancePet } from "../../src/progression/engine.js";
import type { PetRecord } from "../../src/store/types.js";

function makePet(overrides: Partial<PetRecord> = {}): PetRecord {
  return {
    petId: "pet-1",
    spawnedAt: "2026-01-01T00:00:00Z",
    requiredTokens: 1000,
    consumedTokens: 0,
    spawnIndex: 0,
    personalitySnapshot: null,
    ...overrides,
  };
}

describe("advancePet", () => {
  it("adds tokens without completing", () => {
    const result = advancePet(makePet(), 500, 1000, 1.5, 0);
    expect(result.updatedPet.consumedTokens).toBe(500);
    expect(result.completedPets).toHaveLength(0);
    expect(result.remainingTokens).toBe(0);
  });

  it("completes pet at exact threshold", () => {
    const result = advancePet(makePet({ consumedTokens: 800 }), 200, 1000, 1.5, 0);
    expect(result.completedPets).toHaveLength(1);
    expect(result.completedPets[0].consumedTokens).toBe(1000);
    expect(result.updatedPet.consumedTokens).toBe(0); // new pet
    expect(result.newSpawnIndex).toBe(1);
  });

  it("handles overflow completing multiple pets", () => {
    // Pet needs 100 more. Delta = 5000. T0=1000, g=1.5
    // Pet 0: needs 100, done. Remaining: 4900. spawn_idx=1
    // Pet 1: needs 1000*1.5^1=1500, done. Remaining: 3400. spawn_idx=2
    // Pet 2: needs 1000*1.5^2=2250, done. Remaining: 1150. spawn_idx=3
    // Pet 3: needs 1000*1.5^3=3375, not done. Consumed: 1150
    const result = advancePet(
      makePet({ consumedTokens: 900, requiredTokens: 1000 }),
      5000,
      1000,
      1.5,
      0,
    );
    expect(result.completedPets).toHaveLength(3);
    expect(result.updatedPet.consumedTokens).toBe(1150);
    expect(result.newSpawnIndex).toBe(3);
  });

  it("carries progress into new pet", () => {
    const result = advancePet(makePet({ consumedTokens: 900 }), 300, 1000, 1.5, 0);
    expect(result.completedPets).toHaveLength(1);
    // Overflow: 300 - 100 = 200 into new pet
    expect(result.updatedPet.consumedTokens).toBe(200);
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement engine**

```typescript
import { v4 as uuidv4 } from "uuid";
import type { PetRecord, CompletedPet, PersonalitySnapshot } from "../store/types.js";

export interface AdvanceResult {
  readonly updatedPet: PetRecord;
  readonly completedPets: readonly CompletedPet[];
  readonly newSpawnIndex: number;
  readonly remainingTokens: number;
}

const EMPTY_PERSONALITY: PersonalitySnapshot = {
  usageMix: {},
  depthMetrics: { editTestLoopCount: 0, repeatEditSameFileCount: 0, phaseSwitchCount: 0, totalSessions: 0 },
  styleMetrics: { bulletRatio: 0, questionRatio: 0, codeblockRatio: 0, avgMessageLen: 0, messageLenStd: 0, headingRatio: 0 },
  traits: {},
  archetype: "builder",
  subtype: "scholar",
};

export function advancePet(
  currentPet: PetRecord,
  deltaTokens: number,
  t0: number,
  g: number,
  spawnIndex: number,
): AdvanceResult {
  let remaining = deltaTokens;
  let pet = currentPet;
  let idx = spawnIndex;
  const completed: CompletedPet[] = [];

  while (remaining > 0) {
    const need = pet.requiredTokens - pet.consumedTokens;

    if (remaining < need) {
      pet = { ...pet, consumedTokens: pet.consumedTokens + remaining };
      remaining = 0;
    } else {
      // Complete this pet
      remaining -= need;
      const completedPet: CompletedPet = {
        petId: pet.petId,
        spawnedAt: pet.spawnedAt,
        completedAt: new Date().toISOString(),
        requiredTokens: pet.requiredTokens,
        consumedTokens: pet.requiredTokens,
        spawnIndex: pet.spawnIndex,
        personality: pet.personalitySnapshot ?? EMPTY_PERSONALITY,
        frames: [],
        colorFrames: [],
        seed: "",
      };
      completed.push(completedPet);

      idx += 1;
      const newRequired = Math.ceil(t0 * Math.pow(g, idx));
      pet = {
        petId: uuidv4(),
        spawnedAt: new Date().toISOString(),
        requiredTokens: newRequired,
        consumedTokens: 0,
        spawnIndex: idx,
        personalitySnapshot: null,
      };
    }
  }

  return {
    updatedPet: pet,
    completedPets: completed,
    newSpawnIndex: idx,
    remainingTokens: remaining,
  };
}
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**
```bash
git add src/progression/engine.ts test/progression/engine.test.ts
git commit -m "feat: add progression engine with overflow handling"
```

---

- [x] Task 9: Monthly reset + progression barrel

**Files:**
- Test: `test/progression/monthly.test.ts`
- Create: `src/progression/monthly.ts`
- Create: `src/progression/index.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect } from "vitest";
import { detectMonthChange, handleMonthChange } from "../../src/progression/monthly.js";
import type { AppState } from "../../src/store/types.js";

describe("detectMonthChange", () => {
  it("returns false within same month", () => {
    expect(detectMonthChange("2026-01", new Date("2026-01-15"))).toBe(false);
  });

  it("returns true when month changes", () => {
    expect(detectMonthChange("2026-01", new Date("2026-02-01"))).toBe(true);
  });
});

describe("handleMonthChange", () => {
  it("resets spawn index and updates month", () => {
    const state: AppState = {
      version: 1,
      calibration: null,
      spawnIndexCurrentMonth: 5,
      currentMonth: "2026-01",
      currentPet: {
        petId: "p1",
        spawnedAt: "2026-01-20T00:00:00Z",
        requiredTokens: 5000,
        consumedTokens: 3000,
        spawnIndex: 5,
        personalitySnapshot: null,
      },
      ingestionState: { files: {} },
      globalStats: {
        totalTokensAllTime: 100000,
        totalSessionsIngested: 50,
        earliestTimestamp: "2026-01-01T00:00:00Z",
        latestTimestamp: "2026-01-31T00:00:00Z",
      },
    };

    const updated = handleMonthChange(state, new Date("2026-02-01"));
    expect(updated.spawnIndexCurrentMonth).toBe(0);
    expect(updated.currentMonth).toBe("2026-02");
    // Current pet unchanged
    expect(updated.currentPet.consumedTokens).toBe(3000);
    expect(updated.currentPet.requiredTokens).toBe(5000);
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement monthly**

```typescript
import { currentMonthString } from "../utils/time.js";
import type { AppState } from "../store/types.js";

export function detectMonthChange(currentMonth: string, now: Date = new Date()): boolean {
  return currentMonthString(now) !== currentMonth;
}

export function handleMonthChange(state: AppState, now: Date = new Date()): AppState {
  return {
    ...state,
    spawnIndexCurrentMonth: 0,
    currentMonth: currentMonthString(now),
  };
}
```

**Step 4: Create barrel export**

```typescript
// src/progression/index.ts
export { computeCalibration } from "./calibration.js";
export { advancePet, type AdvanceResult } from "./engine.js";
export { detectMonthChange, handleMonthChange } from "./monthly.js";
export type { CalibrationInput, CalibrationResult, SpawnConfig } from "./types.js";
```

**Step 5: Run tests — expect PASS**
```bash
npx vitest run test/progression/
```

**Step 6: Commit**
```bash
git add src/progression/monthly.ts src/progression/index.ts test/progression/monthly.test.ts
git commit -m "feat: add monthly reset logic and progression barrel"
```

---

## Phase 3: Personality

- [x] Task 10: Session classifier (8 categories)

**Files:**
- Test: `test/personality/classifier.test.ts`
- Create: `src/personality/classifier.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect } from "vitest";
import { classifySession } from "../../src/personality/classifier.js";

describe("classifySession", () => {
  it("classifies debug session (edit-test loop + test commands)", () => {
    const result = classifySession({
      editedExtensions: [".ts"],
      toolTransitions: ["Read", "Edit", "Bash", "Edit", "Bash"],
      bashCommands: ["npm test", "vitest run"],
      toolUseCounts: { Read: 2, Edit: 3, Bash: 4 },
    });
    expect(result.primaryCategory).toBe("debug");
    expect(result.scores.debug).toBeGreaterThan(0);
  });

  it("classifies research session (read/grep heavy)", () => {
    const result = classifySession({
      editedExtensions: [],
      toolTransitions: ["Read", "Grep", "Read", "Grep", "Read"],
      bashCommands: [],
      toolUseCounts: { Read: 10, Grep: 8, Edit: 0, Bash: 1 },
    });
    expect(result.primaryCategory).toBe("research");
  });

  it("classifies docs session (markdown edits)", () => {
    const result = classifySession({
      editedExtensions: [".md", ".md", ".md"],
      toolTransitions: ["Read", "Edit", "Edit"],
      bashCommands: [],
      toolUseCounts: { Read: 2, Edit: 5 },
    });
    expect(result.primaryCategory).toBe("docs");
  });

  it("classifies ops session (docker/install commands)", () => {
    const result = classifySession({
      editedExtensions: [".yml", ".env"],
      toolTransitions: ["Bash", "Edit", "Bash"],
      bashCommands: ["docker compose up", "npm install express"],
      toolUseCounts: { Bash: 5, Edit: 2 },
    });
    expect(result.primaryCategory).toBe("ops");
  });

  it("normalizes scores to sum=1.0", () => {
    const result = classifySession({
      editedExtensions: [".ts"],
      toolTransitions: ["Edit", "Edit"],
      bashCommands: [],
      toolUseCounts: { Edit: 5 },
    });
    const sum = Object.values(result.scores).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement classifier**

```typescript
import { CATEGORY_IDS } from "../config/constants.js";
import type { CategoryId, ClassificationSignals, SessionClassification, UsageMix } from "./types.js";

const SIGNAL_CAP = 0.3;

const EXT_MAP: Record<string, CategoryId> = {
  ".md": "docs",
  ".mdx": "docs",
  ".txt": "docs",
  ".test.ts": "debug",
  ".test.tsx": "debug",
  ".spec.ts": "debug",
  ".test.js": "debug",
  "_test.go": "debug",
  ".yml": "ops",
  ".yaml": "ops",
  ".env": "ops",
  ".dockerfile": "ops",
};

const CODE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".go", ".py", ".rs", ".java", ".rb", ".c", ".cpp", ".h"]);

const BASH_KEYWORDS: Record<string, CategoryId> = {
  test: "debug", jest: "debug", vitest: "debug", pytest: "debug", "go test": "debug", mocha: "debug",
  lint: "refactor", format: "refactor", prettier: "refactor", eslint: "refactor", "gofmt": "refactor",
  docker: "ops", compose: "ops", kubectl: "ops", "npm install": "ops", "pip install": "ops",
  "go mod": "ops", brew: "ops",
  audit: "security", snyk: "security", gosec: "security", bandit: "security", "npm audit": "security",
};

function scoreExtensions(exts: readonly string[]): Record<CategoryId, number> {
  const scores: Record<string, number> = {};
  for (const ext of exts) {
    // Check compound extensions first
    let matched = false;
    for (const [pattern, cat] of Object.entries(EXT_MAP)) {
      if (ext.endsWith(pattern)) {
        scores[cat] = (scores[cat] ?? 0) + 3;
        matched = true;
        break;
      }
    }
    if (!matched && CODE_EXTS.has(ext)) {
      scores["impl"] = (scores["impl"] ?? 0) + 1;
    }
  }
  return scores as Record<CategoryId, number>;
}

function scoreTransitions(transitions: readonly string[]): Record<CategoryId, number> {
  const scores: Record<string, number> = {};
  for (let i = 0; i < transitions.length - 1; i++) {
    const a = transitions[i];
    const b = transitions[i + 1];
    if ((a === "Edit" || a === "Write") && b === "Bash") scores["debug"] = (scores["debug"] ?? 0) + 2;
    if (a === "Read" && b === "Grep") scores["research"] = (scores["research"] ?? 0) + 2;
    if (a === "Grep" && b === "Read") scores["research"] = (scores["research"] ?? 0) + 2;
    if ((a === "Edit" || a === "Write") && (b === "Edit" || b === "Write")) scores["impl"] = (scores["impl"] ?? 0) + 1;
  }
  return scores as Record<CategoryId, number>;
}

function scoreBashCommands(commands: readonly string[]): Record<CategoryId, number> {
  const scores: Record<string, number> = {};
  for (const cmd of commands) {
    const lower = cmd.toLowerCase();
    for (const [keyword, cat] of Object.entries(BASH_KEYWORDS)) {
      if (lower.includes(keyword)) {
        scores[cat] = (scores[cat] ?? 0) + 2;
        break;
      }
    }
  }
  return scores as Record<CategoryId, number>;
}

function scoreToolDistribution(counts: Record<string, number>): Record<CategoryId, number> {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return {} as Record<CategoryId, number>;

  const scores: Record<string, number> = {};
  const readGrep = (counts["Read"] ?? 0) + (counts["Grep"] ?? 0);
  const editWrite = (counts["Edit"] ?? 0) + (counts["Write"] ?? 0);
  const bash = counts["Bash"] ?? 0;

  if (readGrep / total > 0.5) scores["research"] = (scores["research"] ?? 0) + 3;
  if (editWrite / total > 0.5) scores["impl"] = (scores["impl"] ?? 0) + 3;
  if (bash / total > 0.4) scores["ops"] = (scores["ops"] ?? 0) + 2;

  return scores as Record<CategoryId, number>;
}

function capAndNormalize(signals: Record<CategoryId, number>[]): UsageMix {
  const combined: Record<string, number> = {};
  for (const cat of CATEGORY_IDS) combined[cat] = 0;

  for (const signal of signals) {
    const sigTotal = Object.values(signal).reduce((a, b) => a + b, 0) || 1;
    for (const [cat, val] of Object.entries(signal)) {
      combined[cat] += Math.min(SIGNAL_CAP, val / sigTotal);
    }
  }

  const total = Object.values(combined).reduce((a, b) => a + b, 0) || 1;
  const result: Record<string, number> = {};
  for (const cat of CATEGORY_IDS) {
    result[cat] = combined[cat] / total;
  }
  return result as UsageMix;
}

export function classifySession(signals: ClassificationSignals): SessionClassification {
  const s1 = scoreExtensions(signals.editedExtensions);
  const s2 = scoreTransitions(signals.toolTransitions);
  const s3 = scoreBashCommands(signals.bashCommands);
  const s4 = scoreToolDistribution(signals.toolUseCounts);

  const scores = capAndNormalize([s1, s2, s3, s4]);

  let primaryCategory: CategoryId = "impl";
  let maxScore = 0;
  for (const cat of CATEGORY_IDS) {
    if (scores[cat] > maxScore) {
      maxScore = scores[cat];
      primaryCategory = cat;
    }
  }

  return { scores, primaryCategory };
}
```

**Step 4: Run test — expect PASS**
```bash
npx vitest run test/personality/classifier.test.ts
```

**Step 5: Commit**
```bash
git add src/personality/classifier.ts test/personality/classifier.test.ts
git commit -m "feat: add 8-category session classifier"
```

---

- [x] Task 11: Depth metrics, style metrics, traits + personality barrel

**Files:**
- Create: `src/personality/depth.ts`
- Create: `src/personality/style.ts`
- Create: `src/personality/traits.ts`
- Create: `src/personality/index.ts`
- Test: `test/personality/traits.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect } from "vitest";
import { computeTraits } from "../../src/personality/traits.js";
import type { UsageMix } from "../../src/personality/types.js";
import type { DepthMetrics, StyleMetrics } from "../../src/store/types.js";

const MIX: UsageMix = {
  impl: 0.4, debug: 0.2, refactor: 0.1, research: 0.1,
  docs: 0.05, planning: 0.05, ops: 0.05, security: 0.05,
};

const DEPTH: DepthMetrics = {
  editTestLoopCount: 5, repeatEditSameFileCount: 3,
  phaseSwitchCount: 10, totalSessions: 5,
};

const STYLE: StyleMetrics = {
  bulletRatio: 0.3, questionRatio: 0.02, codeblockRatio: 0.1,
  avgMessageLen: 200, messageLenStd: 50, headingRatio: 0.05,
};

describe("computeTraits", () => {
  it("maps usage_mix to base trait scores", () => {
    const result = computeTraits(MIX, DEPTH, STYLE);
    expect(result.traits.builder).toBeGreaterThanOrEqual(30);
    expect(result.traits.builder).toBeLessThanOrEqual(50);
  });

  it("selects archetype as highest trait", () => {
    const result = computeTraits(MIX, DEPTH, STYLE);
    expect(result.archetype).toBe("builder");
  });

  it("selects subtype as second highest", () => {
    const result = computeTraits(MIX, DEPTH, STYLE);
    expect(result.subtype).toBe("fixer");
  });

  it("clamps all traits to [0, 100]", () => {
    const result = computeTraits(MIX, DEPTH, STYLE);
    for (const val of Object.values(result.traits)) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(100);
    }
  });

  it("trait scores sum is deterministic", () => {
    const r1 = computeTraits(MIX, DEPTH, STYLE);
    const r2 = computeTraits(MIX, DEPTH, STYLE);
    expect(r1).toEqual(r2);
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement depth.ts**

```typescript
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
```

**Step 4: Implement style.ts**

```typescript
import type { StyleMetrics } from "../store/types.js";

export function computeStyleMetrics(messageTexts: readonly string[]): StyleMetrics {
  if (messageTexts.length === 0) {
    return { bulletRatio: 0, questionRatio: 0, codeblockRatio: 0, avgMessageLen: 0, messageLenStd: 0, headingRatio: 0 };
  }

  let totalLines = 0;
  let bulletLines = 0;
  let headingLines = 0;
  let questionCount = 0;
  let codeblockCount = 0;
  let totalChars = 0;
  const lengths: number[] = [];

  for (const text of messageTexts) {
    const lines = text.split("\n");
    totalLines += lines.length;
    lengths.push(text.length);
    totalChars += text.length;

    for (const line of lines) {
      const trimmed = line.trimStart();
      if (/^[-*]\s/.test(trimmed) || /^\d+[.)]\s/.test(trimmed)) bulletLines++;
      if (/^#{1,6}\s/.test(trimmed)) headingLines++;
    }

    questionCount += (text.match(/\?/g) ?? []).length;
    codeblockCount += (text.match(/```/g) ?? []).length;
  }

  const avgLen = totalChars / messageTexts.length;
  const variance = lengths.reduce((sum, l) => sum + (l - avgLen) ** 2, 0) / messageTexts.length;

  return {
    bulletRatio: totalLines > 0 ? bulletLines / totalLines : 0,
    questionRatio: totalChars > 0 ? questionCount / totalChars : 0,
    codeblockRatio: messageTexts.length > 0 ? codeblockCount / messageTexts.length : 0,
    avgMessageLen: avgLen,
    messageLenStd: Math.sqrt(variance),
    headingRatio: totalLines > 0 ? headingLines / totalLines : 0,
  };
}
```

**Step 5: Implement traits.ts**

```typescript
import { CATEGORY_IDS, TRAIT_IDS, CATEGORY_TO_TRAIT } from "../config/constants.js";
import { clamp } from "../utils/clamp.js";
import type { UsageMix, TraitVector, TraitId } from "./types.js";
import type { DepthMetrics, StyleMetrics } from "../store/types.js";

export interface TraitResult {
  readonly traits: TraitVector;
  readonly archetype: TraitId;
  readonly subtype: TraitId;
}

export function computeTraits(
  usageMix: UsageMix,
  depth: DepthMetrics,
  style: StyleMetrics,
): TraitResult {
  const traits: Record<string, number> = {};

  // Base scores from usage_mix
  for (const cat of CATEGORY_IDS) {
    const traitId = CATEGORY_TO_TRAIT[cat];
    traits[traitId] = Math.round((usageMix[cat] ?? 0) * 100);
  }

  // Depth/style adjustments (bounded [-10, +10])
  const normLoops = depth.totalSessions > 0
    ? depth.editTestLoopCount / depth.totalSessions
    : 0;

  traits["fixer"] += Math.min(10, Math.round(normLoops * 2));
  traits["refiner"] += Math.min(10, Math.round(depth.phaseSwitchCount > 20 ? 5 : 0));
  traits["architect"] += Math.min(10, Math.round(
    (style.bulletRatio > 0.2 ? 5 : 0) + (style.headingRatio > 0.05 ? 5 : 0)
  ));
  traits["scholar"] += Math.min(10, Math.round(
    depth.totalSessions > 0 && depth.repeatEditSameFileCount / depth.totalSessions < 0.5 ? 5 : 0
  ));

  // Clamp all to [0, 100]
  for (const t of TRAIT_IDS) {
    traits[t] = clamp(0, 100, traits[t] ?? 0);
  }

  // Find archetype (highest) and subtype (second highest)
  const sorted = [...TRAIT_IDS].sort((a, b) => (traits[b] ?? 0) - (traits[a] ?? 0));

  return {
    traits: traits as TraitVector,
    archetype: sorted[0],
    subtype: sorted[1],
  };
}
```

**Step 6: Create barrel**

```typescript
// src/personality/index.ts
export { classifySession } from "./classifier.js";
export { computeDepthMetrics } from "./depth.js";
export { computeStyleMetrics } from "./style.js";
export { computeTraits, type TraitResult } from "./traits.js";
export type { CategoryId, TraitId, UsageMix, TraitVector, ClassificationSignals, SessionClassification } from "./types.js";
```

**Step 7: Run tests — expect PASS**
```bash
npx vitest run test/personality/
```

**Step 8: Commit**
```bash
git add src/personality/ test/personality/
git commit -m "feat: add personality module (classifier, depth, style, traits)"
```

---

## Phase 4: ASCII Art

- [x] Task 12: Art seed generation

**Files:**
- Test: `test/art/seed.test.ts`
- Create: `src/art/seed.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect } from "vitest";
import { generateSeed } from "../../src/art/seed.js";

describe("generateSeed", () => {
  it("returns a 64-char hex string", () => {
    const seed = generateSeed("machine-1", "pet-abc");
    expect(seed).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for same inputs", () => {
    const a = generateSeed("m1", "p1");
    const b = generateSeed("m1", "p1");
    expect(a).toBe(b);
  });

  it("differs for different inputs", () => {
    const a = generateSeed("m1", "p1");
    const b = generateSeed("m1", "p2");
    expect(a).not.toBe(b);
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement seed.ts**

```typescript
import { hostname } from "node:os";
import { sha256 } from "../utils/hash.js";

export function generateSeed(machineId?: string, petId?: string): string {
  const machine = machineId ?? hostname();
  const pet = petId ?? "default";
  return sha256(`${machine}:${pet}`);
}
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**
```bash
git add src/art/seed.ts test/art/seed.test.ts
git commit -m "feat: add deterministic art seed generation"
```

---

- [x] Task 13: Body generator (8 archetypes)

**Files:**
- Test: `test/art/body.test.ts`
- Create: `src/art/body.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect } from "vitest";
import { generateBody } from "../../src/art/body.js";
import { createPrng } from "../../src/utils/hash.js";

describe("generateBody", () => {
  it("generates canvas within bounds", () => {
    const prng = createPrng("abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234");
    const canvas = generateBody(prng, 0.5, "builder", 24, 12);
    expect(canvas.length).toBeLessThanOrEqual(12);
    for (const row of canvas) {
      expect(row.length).toBeLessThanOrEqual(24);
    }
  });

  it("grows larger with higher progress", () => {
    const prng1 = createPrng("aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111");
    const small = generateBody(prng1, 0.1, "builder", 24, 12);
    const prng2 = createPrng("aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111");
    const large = generateBody(prng2, 0.9, "builder", 24, 12);
    const smallChars = small.flat().join("").replace(/ /g, "").length;
    const largeChars = large.flat().join("").replace(/ /g, "").length;
    expect(largeChars).toBeGreaterThan(smallChars);
  });

  it("is deterministic", () => {
    const prng1 = createPrng("bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222");
    const a = generateBody(prng1, 0.5, "scholar", 24, 12);
    const prng2 = createPrng("bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222");
    const b = generateBody(prng2, 0.5, "scholar", 24, 12);
    expect(a).toEqual(b);
  });

  it("produces different shapes per archetype", () => {
    const prng1 = createPrng("cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333");
    const builder = generateBody(prng1, 0.5, "builder", 24, 12);
    const prng2 = createPrng("cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333");
    const scholar = generateBody(prng2, 0.5, "scholar", 24, 12);
    expect(builder).not.toEqual(scholar);
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement body.ts**

Key approach: Each archetype has a silhouette generator function. Progress 0-0.5 scales body size from ~3x2 to ~12x8 within canvas. Progress 0.5-1.0 fills in detail characters.

The body is a 2D array of single characters. Space = empty. The generator:
1. Computes body width/height from progress
2. Picks a silhouette shape per archetype
3. Fills detail chars based on progress density

```typescript
import { clamp } from "../utils/clamp.js";

type Prng = () => number;
type Canvas = string[][];

const BODY_CHARS = ".oO@#*+=~";
const DETAIL_CHARS = ".:;!|/\\{}[]<>";

function createCanvas(w: number, h: number): Canvas {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => " "));
}

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function fillEllipse(canvas: Canvas, cx: number, cy: number, rx: number, ry: number, prng: Prng, density: number): void {
  for (let y = cy - ry; y <= cy + ry; y++) {
    for (let x = cx - rx; x <= cx + rx; x++) {
      if (y < 0 || y >= canvas.length || x < 0 || x >= canvas[0].length) continue;
      const dx = (x - cx) / (rx || 1);
      const dy = (y - cy) / (ry || 1);
      if (dx * dx + dy * dy <= 1.0) {
        if (prng() < density) {
          canvas[y][x] = BODY_CHARS[Math.floor(prng() * BODY_CHARS.length)];
        } else if (canvas[y][x] === " ") {
          canvas[y][x] = ".";
        }
      }
    }
  }
}

function fillRect(canvas: Canvas, x1: number, y1: number, x2: number, y2: number, prng: Prng, density: number): void {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      if (y < 0 || y >= canvas.length || x < 0 || x >= canvas[0].length) continue;
      if (prng() < density) {
        canvas[y][x] = BODY_CHARS[Math.floor(prng() * BODY_CHARS.length)];
      } else if (canvas[y][x] === " ") {
        canvas[y][x] = ".";
      }
    }
  }
}

function fillTriangle(canvas: Canvas, cx: number, top: number, bottom: number, halfBase: number, prng: Prng, density: number): void {
  const height = bottom - top;
  for (let y = top; y <= bottom; y++) {
    if (y < 0 || y >= canvas.length) continue;
    const rowFraction = height > 0 ? (y - top) / height : 1;
    const halfWidth = Math.round(halfBase * rowFraction);
    for (let x = cx - halfWidth; x <= cx + halfWidth; x++) {
      if (x < 0 || x >= canvas[0].length) continue;
      if (prng() < density) {
        canvas[y][x] = BODY_CHARS[Math.floor(prng() * BODY_CHARS.length)];
      } else if (canvas[y][x] === " ") {
        canvas[y][x] = ".";
      }
    }
  }
}

function addEyes(canvas: Canvas, cx: number, cy: number, _prng: Prng): void {
  const eyeY = Math.max(0, cy - 1);
  if (eyeY >= canvas.length) return;
  const lx = Math.max(0, cx - 1);
  const rx = Math.min(canvas[0].length - 1, cx + 1);
  if (lx < canvas[0].length) canvas[eyeY][lx] = "o";
  if (rx < canvas[0].length) canvas[eyeY][rx] = "o";
}

function addDetails(canvas: Canvas, prng: Prng, detailDensity: number): void {
  for (let y = 0; y < canvas.length; y++) {
    for (let x = 0; x < canvas[0].length; x++) {
      if (canvas[y][x] !== " " && canvas[y][x] !== "." && prng() < detailDensity * 0.3) {
        canvas[y][x] = DETAIL_CHARS[Math.floor(prng() * DETAIL_CHARS.length)];
      }
    }
  }
}

const GENERATORS: Record<string, (canvas: Canvas, prng: Prng, bw: number, bh: number, cx: number, cy: number, density: number) => void> = {
  builder: (c, p, bw, bh, cx, cy, d) => {
    fillRect(c, cx - Math.floor(bw / 2), cy - Math.floor(bh / 2), cx + Math.floor(bw / 2), cy + Math.floor(bh / 2), p, d);
    addEyes(c, cx, cy - Math.floor(bh / 4), p);
  },
  fixer: (c, p, bw, bh, cx, cy, d) => {
    fillEllipse(c, cx, cy, Math.floor(bw / 2), Math.floor(bh / 3), p, d);
    fillRect(c, cx - 1, cy + Math.floor(bh / 3), cx + 1, cy + Math.floor(bh / 2), p, d);
    addEyes(c, cx, cy - Math.floor(bh / 4), p);
  },
  refiner: (c, p, bw, bh, cx, cy, d) => {
    // Diamond/gem shape
    fillTriangle(c, cx, cy - Math.floor(bh / 2), cy, Math.floor(bw / 2), p, d);
    fillTriangle(c, cx, cy, cy + Math.floor(bh / 3), Math.floor(bw / 3), p, d);
    addEyes(c, cx, cy - Math.floor(bh / 4), p);
  },
  scholar: (c, p, bw, bh, cx, cy, d) => {
    fillEllipse(c, cx, cy, Math.floor(bw / 2), Math.floor(bh / 2), p, d);
    addEyes(c, cx, cy - Math.floor(bh / 4), p);
  },
  scribe: (c, p, bw, bh, cx, cy, d) => {
    const hw = Math.max(1, Math.floor(bw / 3));
    fillRect(c, cx - hw, cy - Math.floor(bh / 2), cx + hw, cy + Math.floor(bh / 2), p, d);
    addEyes(c, cx, cy - Math.floor(bh / 3), p);
  },
  architect: (c, p, bw, bh, cx, cy, d) => {
    fillTriangle(c, cx, cy - Math.floor(bh / 2), cy + Math.floor(bh / 2), Math.floor(bw / 2), p, d);
    addEyes(c, cx, cy - Math.floor(bh / 4), p);
  },
  operator: (c, p, bw, bh, cx, cy, d) => {
    fillEllipse(c, cx, cy, Math.floor(bw / 2), Math.floor(bh / 2), p, d);
    // Gear notches
    const r = Math.floor(bw / 2);
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const nx = cx + Math.round(Math.cos(angle) * r);
      const ny = cy + Math.round(Math.sin(angle) * (Math.floor(bh / 2)));
      if (ny >= 0 && ny < c.length && nx >= 0 && nx < c[0].length) c[ny][nx] = "+";
    }
    addEyes(c, cx, cy - Math.floor(bh / 4), p);
  },
  guardian: (c, p, bw, bh, cx, cy, d) => {
    // Shield shape: rect top, tapered bottom
    const halfW = Math.floor(bw / 2);
    const midY = cy + Math.floor(bh / 4);
    fillRect(c, cx - halfW, cy - Math.floor(bh / 2), cx + halfW, midY, p, d);
    fillTriangle(c, cx, midY, cy + Math.floor(bh / 2), halfW, p, d);
    addEyes(c, cx, cy - Math.floor(bh / 3), p);
  },
};

export function generateBody(prng: Prng, progress: number, archetype: string, maxW: number, maxH: number): Canvas {
  const canvas = createCanvas(maxW, maxH);
  const p = clamp(0, 1, progress);

  // Size scaling: progress 0-0.5 grows body, 0.5-1.0 adds detail
  const sizeFactor = Math.min(1, p * 2); // 0→0, 0.5→1, 1→1
  const bw = lerp(3, Math.floor(maxW * 0.6), sizeFactor);
  const bh = lerp(2, Math.floor(maxH * 0.7), sizeFactor);
  const detailDensity = p > 0.5 ? (p - 0.5) * 2 : 0; // 0 at 0.5, 1 at 1.0

  const cx = Math.floor(maxW / 2);
  const cy = Math.floor(maxH / 2);
  const density = 0.4 + sizeFactor * 0.4;

  const gen = GENERATORS[archetype] ?? GENERATORS["builder"];
  gen(canvas, prng, bw, bh, cx, cy, density);

  if (detailDensity > 0) {
    addDetails(canvas, prng, detailDensity);
  }

  return canvas;
}
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**
```bash
git add src/art/body.ts test/art/body.test.ts
git commit -m "feat: add procedural body generator for 8 archetypes"
```

---

- [x] Task 14: Animator + motif + color

**Files:**
- Create: `src/art/motif.ts`
- Create: `src/art/animator.ts`
- Create: `src/art/color.ts`
- Test: `test/art/animator.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect } from "vitest";
import { generateFrames } from "../../src/art/animator.js";
import { generateBody } from "../../src/art/body.js";
import { createPrng } from "../../src/utils/hash.js";

const SEED = "1111222233334444555566667777888811112222333344445555666677778888";

describe("generateFrames", () => {
  it("generates exactly 4 frames", () => {
    const prng = createPrng(SEED);
    const base = generateBody(prng, 0.5, "builder", 24, 12);
    const prng2 = createPrng(SEED);
    const frames = generateFrames(base, prng2, "builder");
    expect(frames).toHaveLength(4);
  });

  it("frames have same dimensions as base", () => {
    const prng = createPrng(SEED);
    const base = generateBody(prng, 0.5, "builder", 24, 12);
    const prng2 = createPrng(SEED);
    const frames = generateFrames(base, prng2, "builder");
    for (const frame of frames) {
      expect(frame.length).toBe(base.length);
      expect(frame[0].length).toBe(base[0].length);
    }
  });

  it("frames are 95%+ similar to base", () => {
    const prng = createPrng(SEED);
    const base = generateBody(prng, 0.7, "scholar", 24, 12);
    const prng2 = createPrng(SEED);
    const frames = generateFrames(base, prng2, "scholar");
    for (const frame of frames) {
      let same = 0;
      let total = 0;
      for (let y = 0; y < base.length; y++) {
        for (let x = 0; x < base[0].length; x++) {
          total++;
          if (frame[y][x] === base[y][x]) same++;
        }
      }
      expect(same / total).toBeGreaterThan(0.90);
    }
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement motif.ts**

```typescript
type Canvas = string[][];
type Prng = () => number;

const ARCHETYPE_MOTIFS: Record<string, string[]> = {
  builder: ["#", "=", "[]"],
  fixer: ["/", "\\", "x"],
  refiner: ["*", "~", "^"],
  scholar: ["?", "!", ";"],
  scribe: ['"', "'", "_"],
  architect: ["|", "-", "+"],
  operator: ["%", "&", "@"],
  guardian: ["[", "]", "#"],
};

export function applyMotifs(canvas: Canvas, archetype: string, traits: Record<string, number>, prng: Prng, progress: number): Canvas {
  const result = canvas.map((row) => [...row]);
  const motifs = ARCHETYPE_MOTIFS[archetype] ?? ARCHETYPE_MOTIFS["builder"];
  const intensity = progress * 0.15; // max 15% of filled cells get motifs

  for (let y = 0; y < result.length; y++) {
    for (let x = 0; x < result[0].length; x++) {
      if (result[y][x] !== " " && result[y][x] !== "." && prng() < intensity) {
        result[y][x] = motifs[Math.floor(prng() * motifs.length)];
      }
    }
  }

  return result;
}
```

**Step 4: Implement animator.ts**

```typescript
type Canvas = string[][];
type Prng = () => number;

function deepCopy(canvas: Canvas): Canvas {
  return canvas.map((row) => [...row]);
}

function findNonEmpty(canvas: Canvas): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  for (let y = 0; y < canvas.length; y++) {
    for (let x = 0; x < canvas[0].length; x++) {
      if (canvas[y][x] !== " ") points.push([y, x]);
    }
  }
  return points;
}

function blink(base: Canvas, prng: Prng): Canvas {
  const frame = deepCopy(base);
  // Find "eyes" (o chars) and close them
  for (let y = 0; y < frame.length; y++) {
    for (let x = 0; x < frame[0].length; x++) {
      if (frame[y][x] === "o") frame[y][x] = "-";
    }
  }
  return frame;
}

function gesture(base: Canvas, prng: Prng): Canvas {
  const frame = deepCopy(base);
  const points = findNonEmpty(frame);
  if (points.length === 0) return frame;

  // Shift 1-3 random edge chars
  const edgeCount = Math.min(3, Math.floor(prng() * 3) + 1);
  for (let i = 0; i < edgeCount; i++) {
    const [y, x] = points[Math.floor(prng() * points.length)];
    const dir = prng() > 0.5 ? 1 : -1;
    const nx = x + dir;
    if (nx >= 0 && nx < frame[0].length && frame[y][nx] === " ") {
      frame[y][nx] = frame[y][x];
      frame[y][x] = " ";
    }
  }
  return frame;
}

function shimmer(base: Canvas, prng: Prng): Canvas {
  const frame = deepCopy(base);
  const points = findNonEmpty(frame);
  const shimmerChars = ".*~+";
  const count = Math.min(3, Math.floor(prng() * 3) + 1);

  for (let i = 0; i < count; i++) {
    if (points.length === 0) break;
    const [y, x] = points[Math.floor(prng() * points.length)];
    frame[y][x] = shimmerChars[Math.floor(prng() * shimmerChars.length)];
  }
  return frame;
}

export function generateFrames(base: Canvas, prng: Prng, _archetype: string): Canvas[] {
  return [
    deepCopy(base),
    blink(base, prng),
    gesture(base, prng),
    shimmer(base, prng),
  ];
}
```

**Step 5: Implement color.ts**

```typescript
import chalk from "chalk";

type Canvas = string[][];

const ARCHETYPE_PALETTE: Record<string, number[]> = {
  builder: [208, 214, 220, 178, 136],  // orange
  fixer: [196, 160, 124, 88, 52],       // red
  refiner: [141, 177, 213, 147, 183],   // purple/lavender
  scholar: [39, 75, 111, 33, 69],       // blue
  scribe: [114, 150, 186, 78, 42],      // green
  architect: [226, 220, 184, 148, 190], // yellow
  operator: [247, 250, 253, 244, 241],  // gray/silver
  guardian: [30, 66, 102, 138, 24],     // teal
};

export function colorize(canvas: Canvas, archetype: string, _traits: Record<string, number>, progress: number): string[] {
  const palette = ARCHETYPE_PALETTE[archetype] ?? ARCHETYPE_PALETTE["builder"];
  return canvas.map((row) =>
    row
      .map((ch) => {
        if (ch === " ") return " ";
        if (ch === "o" || ch === "-") return chalk.ansi256(255)(ch); // eyes = white
        if (ch === ".") return chalk.ansi256(palette[4])(ch);
        const idx = Math.floor(Math.random() * 3); // Use first 3 for body
        return chalk.ansi256(palette[idx])(ch);
      })
      .join(""),
  );
}

export function colorizeFrames(frames: Canvas[], archetype: string, traits: Record<string, number>, progress: number): string[][] {
  return frames.map((frame) => colorize(frame, archetype, traits, progress));
}
```

**Step 6: Run test — expect PASS**
```bash
npx vitest run test/art/
```

**Step 7: Commit**
```bash
git add src/art/motif.ts src/art/animator.ts src/art/color.ts test/art/animator.test.ts
git commit -m "feat: add animation frames, motifs, and ANSI color support"
```

---

- [x] Task 15: Art renderer + barrel export

**Files:**
- Test: `test/art/renderer.test.ts`
- Create: `src/art/renderer.ts`
- Create: `src/art/index.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect } from "vitest";
import { renderArt } from "../../src/art/renderer.js";

describe("renderArt", () => {
  it("produces 4 frames of correct dimensions", () => {
    const output = renderArt({
      seed: "abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234",
      progress: 0.5,
      archetype: "builder",
      subtype: "scholar",
      traits: { builder: 50, fixer: 20, refiner: 10, scholar: 10, scribe: 5, architect: 5, operator: 0, guardian: 0 },
      canvasWidth: 24,
      canvasHeight: 12,
    });
    expect(output.frames).toHaveLength(4);
    expect(output.colorFrames).toHaveLength(4);
    for (const frame of output.frames) {
      expect(frame.length).toBe(12);
      for (const line of frame) {
        expect(line.length).toBe(24);
      }
    }
  });

  it("is deterministic for same seed", () => {
    const params = {
      seed: "dddd4444dddd4444dddd4444dddd4444dddd4444dddd4444dddd4444dddd4444",
      progress: 0.7,
      archetype: "scholar",
      subtype: "fixer",
      traits: { builder: 10, fixer: 30, refiner: 5, scholar: 40, scribe: 5, architect: 5, operator: 3, guardian: 2 },
      canvasWidth: 24,
      canvasHeight: 12,
    };
    const a = renderArt(params);
    const b = renderArt(params);
    expect(a.frames).toEqual(b.frames);
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement renderer.ts**

```typescript
import { createPrng } from "../utils/hash.js";
import { generateBody } from "./body.js";
import { applyMotifs } from "./motif.js";
import { generateFrames } from "./animator.js";
import { colorizeFrames } from "./color.js";
import type { ArtParams, ArtOutput, Canvas } from "./types.js";

function canvasToStrings(canvas: Canvas, width: number, height: number): string[] {
  const lines: string[] = [];
  for (let y = 0; y < height; y++) {
    if (y < canvas.length) {
      const row = canvas[y].join("").padEnd(width).slice(0, width);
      lines.push(row);
    } else {
      lines.push(" ".repeat(width));
    }
  }
  return lines;
}

export function renderArt(params: ArtParams): ArtOutput {
  const { seed, progress, archetype, subtype, traits, canvasWidth, canvasHeight } = params;

  const prng = createPrng(seed);
  const body = generateBody(prng, progress, archetype, canvasWidth, canvasHeight);
  const motifed = applyMotifs(body, archetype, traits, prng, progress);
  const rawFrames = generateFrames(motifed, prng, archetype);

  const frames = rawFrames.map((f) => canvasToStrings(f, canvasWidth, canvasHeight));
  const colorFrames = colorizeFrames(rawFrames, archetype, traits, progress);

  return { frames, colorFrames };
}
```

**Step 4: Create barrel export**

```typescript
// src/art/index.ts
export { generateSeed } from "./seed.js";
export { generateBody } from "./body.js";
export { applyMotifs } from "./motif.js";
export { generateFrames } from "./animator.js";
export { colorize, colorizeFrames } from "./color.js";
export { renderArt } from "./renderer.js";
export type { ArtParams, ArtOutput, Canvas, Frame } from "./types.js";
```

**Step 5: Run tests — expect PASS**
```bash
npx vitest run test/art/
```

**Step 6: Commit**
```bash
git add src/art/renderer.ts src/art/index.ts test/art/renderer.test.ts
git commit -m "feat: add art renderer and barrel export"
```

---

## Phase 5: CLI + UI + Encouragement

- [x] Task 16: Encouragement module

**Files:**
- Create: `src/encouragement/messages.ts`
- Create: `src/encouragement/trigger.ts`
- Create: `src/encouragement/index.ts`
- Test: `test/encouragement/trigger.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect } from "vitest";
import { shouldTrigger, selectMessage } from "../../src/encouragement/trigger.js";
import { createPrng } from "../../src/utils/hash.js";

describe("shouldTrigger", () => {
  it("returns true when rate exceeds threshold and cooldown elapsed", () => {
    const result = shouldTrigger(60_000, 50_000, "2026-01-01T00:00:00Z", 3);
    expect(result).toBe(true);
  });

  it("returns false when rate below threshold", () => {
    expect(shouldTrigger(10_000, 50_000, "2026-01-01T00:00:00Z", 3)).toBe(false);
  });

  it("returns false when cooldown not elapsed", () => {
    // lastShown = 1 hour ago, cooldown = 3 hours
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(shouldTrigger(60_000, 50_000, oneHourAgo, 3)).toBe(false);
  });

  it("returns true when lastShownAt is null (never shown)", () => {
    expect(shouldTrigger(60_000, 50_000, null, 3)).toBe(true);
  });
});

describe("selectMessage", () => {
  it("returns a non-empty string", () => {
    const prng = createPrng("aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111");
    const msg = selectMessage(prng);
    expect(msg).toBeTruthy();
    expect(typeof msg).toBe("string");
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement messages.ts**

```typescript
export const ENCOURAGEMENT_MESSAGES: readonly string[] = [
  "Nice pace. Coffee break?",
  "You've been going hard. Stretch?",
  "Impressive flow! Remember to blink.",
  "Your pet is growing fast!",
  "Steady progress. Keep it up!",
  "Time for a water break?",
  "Great momentum today!",
  "Your dedication shows. Rest when ready.",
  "Another session in the books!",
  "You and your pet are on fire!",
];
```

**Step 4: Implement trigger.ts**

```typescript
import { hoursAgo } from "../utils/time.js";
import { ENCOURAGEMENT_MESSAGES } from "./messages.js";

export function shouldTrigger(
  tokensLastHour: number,
  threshold: number,
  lastShownAt: string | null,
  cooldownHours: number,
): boolean {
  if (tokensLastHour < threshold) return false;
  if (lastShownAt === null) return true;
  return hoursAgo(lastShownAt) >= cooldownHours;
}

export function selectMessage(prng: () => number): string {
  const idx = Math.floor(prng() * ENCOURAGEMENT_MESSAGES.length);
  return ENCOURAGEMENT_MESSAGES[idx];
}
```

**Step 5: Create barrel**

```typescript
// src/encouragement/index.ts
export { ENCOURAGEMENT_MESSAGES } from "./messages.js";
export { shouldTrigger, selectMessage } from "./trigger.js";
```

**Step 6: Run test — expect PASS**
```bash
npx vitest run test/encouragement/
```

**Step 7: Commit**
```bash
git add src/encouragement/ test/encouragement/
git commit -m "feat: add encouragement message trigger system"
```

---

- [x] Task 17: Main orchestrator (src/index.ts)

**Files:**
- Create: `src/index.ts`

**Step 1: Implement orchestrator**

This is the core integration module that ties all domains together.

```typescript
import { loadConfig, ensureDataDir, type Config, CLAUDE_PROJECTS_DIR, GROWTH_MULTIPLIER } from "./config/index.js";
import {
  loadState, saveState, loadCollection, saveCollection,
  createInitialState, addCompletedPet, updateGlobalStats, updateIngestionFile, updatePetInState,
  type AppState, type Collection, type CompletedPet,
} from "./store/index.js";
import { scanLogFiles, readIncremental, aggregateSessions, type SessionMetrics } from "./ingestion/index.js";
import { computeCalibration, advancePet, detectMonthChange, handleMonthChange } from "./progression/index.js";
import { classifySession, computeDepthMetrics, computeStyleMetrics, computeTraits } from "./personality/index.js";
import { renderArt, generateSeed } from "./art/index.js";
import { hostname } from "node:os";

export interface RunResult {
  readonly state: AppState;
  readonly collection: Collection;
  readonly newlyCompleted: readonly CompletedPet[];
}

export function runIngestion(config: Config, state: AppState): { state: AppState; sessionMetrics: SessionMetrics[] } {
  const logDir = config.logPath ?? CLAUDE_PROJECTS_DIR;
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

export function runCalibration(state: AppState, config: Config): AppState {
  const gs = state.globalStats;
  if (!gs.earliestTimestamp || !gs.latestTimestamp || gs.totalTokensAllTime === 0) {
    return state;
  }

  const result = computeCalibration(
    { totalTokensAllTime: gs.totalTokensAllTime, earliestTimestamp: gs.earliestTimestamp, latestTimestamp: gs.latestTimestamp },
    config.growth.g,
    config.growth.t0Rounding,
  );

  return {
    ...state,
    calibration: { t0: result.t0, monthlyEstimate: result.monthlyEstimate, calibratedAt: new Date().toISOString() },
  };
}

export function runProgression(state: AppState, newTokens: number, config: Config): { state: AppState; completed: CompletedPet[] } {
  if (!state.calibration || newTokens === 0) return { state, completed: [] };

  let current = state;

  // Check month boundary
  if (detectMonthChange(current.currentMonth)) {
    current = handleMonthChange(current);
  }

  const result = advancePet(current.currentPet, newTokens, state.calibration.t0, config.growth.g, current.spawnIndexCurrentMonth);

  // Generate art for completed pets
  const completedWithArt: CompletedPet[] = result.completedPets.map((pet) => {
    const seed = generateSeed(hostname(), pet.petId);
    const art = renderArt({
      seed,
      progress: 1.0,
      archetype: pet.personality.archetype,
      subtype: pet.personality.subtype,
      traits: pet.personality.traits,
      canvasWidth: config.canvas.width,
      canvasHeight: config.canvas.height,
    });
    return { ...pet, frames: art.frames, colorFrames: art.colorFrames, seed };
  });

  current = {
    ...current,
    currentPet: result.updatedPet,
    spawnIndexCurrentMonth: result.newSpawnIndex,
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

  // Merge signals across all sessions
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
  const { traits, archetype, subtype } = computeTraits(classification.scores, depth, style);

  return updatePetInState(state, {
    personalitySnapshot: {
      usageMix: classification.scores,
      depthMetrics: depth,
      styleMetrics: style,
      traits,
      archetype,
      subtype,
    },
  });
}

export function runFull(config?: Config): RunResult {
  const cfg = config ?? loadConfig();
  ensureDataDir();

  let state = loadState() ?? createInitialState(10_000); // Temp T0 until calibrated
  let collection = loadCollection();

  // 1. Ingest
  const { state: postIngest, sessionMetrics } = runIngestion(cfg, state);
  state = postIngest;

  // 2. Calibrate if needed
  if (!state.calibration) {
    state = runCalibration(state, cfg);
    if (state.calibration) {
      // Re-set current pet with calibrated T0
      const t0 = state.calibration.t0;
      state = updatePetInState(state, { requiredTokens: Math.ceil(t0 * Math.pow(cfg.growth.g, state.spawnIndexCurrentMonth)) });
    }
  }

  // 3. Personality
  state = runPersonality(state, sessionMetrics);

  // 4. Progress
  const newTokens = sessionMetrics.reduce((sum, m) => sum + m.totalTokens, 0);
  const { state: postProgress, completed } = runProgression(state, newTokens, cfg);
  state = postProgress;

  // 5. Save completed pets
  for (const pet of completed) {
    collection = addCompletedPet(collection, pet);
  }

  saveState(state);
  saveCollection(collection);

  return { state, collection, newlyCompleted: completed };
}
```

**Step 2: Commit**
```bash
git add src/index.ts
git commit -m "feat: add main orchestrator integrating all domains"
```

---

- [x] Task 18: Ink UI components

**Files:**
- Create: `src/ui/app.tsx`
- Create: `src/ui/components/PetView.tsx`
- Create: `src/ui/components/ProgressBar.tsx`
- Create: `src/ui/components/StatsPanel.tsx`
- Create: `src/ui/components/TraitDisplay.tsx`
- Create: `src/ui/components/CollectionList.tsx`
- Create: `src/ui/components/PetDetail.tsx`
- Create: `src/ui/hooks/useAnimation.ts`

**Step 1: Implement useAnimation hook**

```typescript
// src/ui/hooks/useAnimation.ts
import { useState, useEffect } from "react";

export function useAnimation(frameCount: number, fps: number, enabled: boolean): number {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!enabled || frameCount <= 1) return;
    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % frameCount);
    }, 1000 / fps);
    return () => clearInterval(interval);
  }, [frameCount, fps, enabled]);

  return frame;
}
```

**Step 2: Implement ProgressBar**

```typescript
// src/ui/components/ProgressBar.tsx
import React from "react";
import { Text } from "ink";

interface Props {
  consumed: number;
  required: number;
  width?: number;
}

export function ProgressBar({ consumed, required, width = 30 }: Props) {
  const pct = Math.min(1, consumed / required);
  const filled = Math.round(pct * width);
  const empty = width - filled;
  const bar = "\u2588".repeat(filled) + "\u2591".repeat(empty);
  const label = `${Math.round(pct * 100)}% (${consumed.toLocaleString()}/${required.toLocaleString()})`;

  return <Text>[{bar}] {label}</Text>;
}
```

**Step 3: Implement TraitDisplay**

```typescript
// src/ui/components/TraitDisplay.tsx
import React from "react";
import { Text, Box } from "ink";
import { TRAIT_IDS } from "../../config/constants.js";

interface Props {
  traits: Record<string, number>;
  archetype: string;
  subtype: string;
}

export function TraitDisplay({ traits, archetype, subtype }: Props) {
  return (
    <Box flexDirection="column">
      <Text bold>
        {archetype.toUpperCase()} / {subtype}
      </Text>
      {TRAIT_IDS.map((id) => {
        const score = traits[id] ?? 0;
        const barLen = Math.round(score / 5); // max 20 chars
        const bar = "\u2588".repeat(barLen);
        return (
          <Text key={id}>
            {id.padEnd(10)} {bar} {score}
          </Text>
        );
      })}
    </Box>
  );
}
```

**Step 4: Implement PetView**

```typescript
// src/ui/components/PetView.tsx
import React from "react";
import { Text, Box } from "ink";
import { useAnimation } from "../hooks/useAnimation.js";
import { ProgressBar } from "./ProgressBar.js";
import { TraitDisplay } from "./TraitDisplay.js";
import type { AppState } from "../../store/types.js";
import type { Config } from "../../config/schema.js";
import { renderArt, generateSeed } from "../../art/index.js";
import { hostname } from "node:os";

interface Props {
  state: AppState;
  config: Config;
}

export function PetView({ state, config }: Props) {
  const pet = state.currentPet;
  const progress = pet.requiredTokens > 0 ? pet.consumedTokens / pet.requiredTokens : 0;
  const personality = pet.personalitySnapshot;
  const archetype = personality?.archetype ?? "builder";
  const subtype = personality?.subtype ?? "scholar";
  const traits = personality?.traits ?? {};

  const seed = generateSeed(hostname(), pet.petId);
  const art = renderArt({
    seed,
    progress,
    archetype,
    subtype,
    traits,
    canvasWidth: config.canvas.width,
    canvasHeight: config.canvas.height,
  });

  const frameIdx = useAnimation(art.colorFrames.length, config.animation.fps, config.animation.enabled);
  const currentFrame = art.colorFrames[frameIdx] ?? art.frames[frameIdx] ?? [];

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold dimColor>tomotoken</Text>
      <Text> </Text>
      {currentFrame.map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}
      <Text> </Text>
      <ProgressBar consumed={pet.consumedTokens} required={pet.requiredTokens} />
      <Text> </Text>
      {personality && <TraitDisplay traits={traits} archetype={archetype} subtype={subtype} />}
    </Box>
  );
}
```

**Step 5: Implement StatsPanel**

```typescript
// src/ui/components/StatsPanel.tsx
import React from "react";
import { Text, Box } from "ink";
import type { AppState } from "../../store/types.js";

interface Props {
  state: AppState;
}

export function StatsPanel({ state }: Props) {
  const gs = state.globalStats;
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>Token Statistics</Text>
      <Text>Total (all time): {gs.totalTokensAllTime.toLocaleString()}</Text>
      <Text>Sessions ingested: {gs.totalSessionsIngested}</Text>
      <Text>First log: {gs.earliestTimestamp ?? "none"}</Text>
      <Text>Latest log: {gs.latestTimestamp ?? "none"}</Text>
      {state.calibration && (
        <>
          <Text> </Text>
          <Text bold>Calibration</Text>
          <Text>T0: {state.calibration.t0.toLocaleString()}</Text>
          <Text>Monthly estimate: {state.calibration.monthlyEstimate.toLocaleString()}</Text>
        </>
      )}
    </Box>
  );
}
```

**Step 6: Implement CollectionList**

```typescript
// src/ui/components/CollectionList.tsx
import React from "react";
import { Text, Box } from "ink";
import type { Collection } from "../../store/types.js";

interface Props {
  collection: Collection;
}

export function CollectionList({ collection }: Props) {
  if (collection.pets.length === 0) {
    return <Text dimColor>No completed pets yet. Keep coding!</Text>;
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>Pet Collection ({collection.pets.length})</Text>
      <Text> </Text>
      {collection.pets.map((pet, i) => (
        <Text key={pet.petId}>
          #{i + 1} {pet.petId.slice(0, 8)} | {pet.personality.archetype}/{pet.personality.subtype} | {pet.consumedTokens.toLocaleString()} tokens | {new Date(pet.completedAt).toLocaleDateString()}
        </Text>
      ))}
    </Box>
  );
}
```

**Step 7: Implement PetDetail**

```typescript
// src/ui/components/PetDetail.tsx
import React from "react";
import { Text, Box } from "ink";
import { TraitDisplay } from "./TraitDisplay.js";
import type { CompletedPet } from "../../store/types.js";
import { useAnimation } from "../hooks/useAnimation.js";

interface Props {
  pet: CompletedPet;
  fps: number;
  animate: boolean;
}

export function PetDetail({ pet, fps, animate }: Props) {
  const frameIdx = useAnimation(pet.colorFrames.length || pet.frames.length, fps, animate);
  const frames = pet.colorFrames.length > 0 ? pet.colorFrames : pet.frames;
  const frame = frames[frameIdx] ?? [];

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>Pet: {pet.petId.slice(0, 8)}</Text>
      <Text>Spawned: {new Date(pet.spawnedAt).toLocaleString()}</Text>
      <Text>Completed: {new Date(pet.completedAt).toLocaleString()}</Text>
      <Text>Tokens: {pet.consumedTokens.toLocaleString()}</Text>
      <Text> </Text>
      {frame.map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}
      <Text> </Text>
      <TraitDisplay traits={pet.personality.traits} archetype={pet.personality.archetype} subtype={pet.personality.subtype} />
    </Box>
  );
}
```

**Step 8: Implement app.tsx**

```typescript
// src/ui/app.tsx
import React from "react";
import { Box } from "ink";
import type { AppState, Collection } from "../store/types.js";
import type { Config } from "../config/schema.js";
import { PetView } from "./components/PetView.js";
import { StatsPanel } from "./components/StatsPanel.js";
import { CollectionList } from "./components/CollectionList.js";
import { PetDetail } from "./components/PetDetail.js";

interface Props {
  command: "show" | "stats" | "collection" | "view" | "config";
  state: AppState;
  config: Config;
  collection: Collection;
  viewPetId?: string;
}

export function App({ command, state, config, collection, viewPetId }: Props) {
  switch (command) {
    case "show":
      return <PetView state={state} config={config} />;
    case "stats":
      return <StatsPanel state={state} />;
    case "collection":
      return <CollectionList collection={collection} />;
    case "view": {
      const pet = collection.pets.find((p) => p.petId.startsWith(viewPetId ?? ""));
      if (!pet) return <Box><text>Pet not found: {viewPetId}</text></Box>;
      return <PetDetail pet={pet} fps={config.animation.fps} animate={config.animation.enabled} />;
    }
    case "config":
      return <Box flexDirection="column" paddingX={1}><text>{JSON.stringify(config, null, 2)}</text></Box>;
    default:
      return <PetView state={state} config={config} />;
  }
}
```

**Step 9: Commit**
```bash
git add src/ui/
git commit -m "feat: add Ink UI components (PetView, Stats, Collection, TraitDisplay)"
```

---

- [x] Task 19: CLI entry point (commander)

**Files:**
- Create: `bin/tomotoken.ts`

**Step 1: Implement CLI**

```typescript
#!/usr/bin/env node
import { Command } from "commander";
import React from "react";
import { render } from "ink";
import { App } from "../src/ui/app.js";
import { runFull, runCalibration, runIngestion } from "../src/index.js";
import { loadConfig, ensureDataDir, loadState, saveState, createInitialState, loadCollection } from "../src/store/index.js";
import { loadConfig as loadCfg } from "../src/config/index.js";

const program = new Command();

program
  .name("tomotoken")
  .description("Visualize your Claude Code usage as a growing pet")
  .version("0.1.0");

program
  .command("show", { isDefault: true })
  .description("Show current pet with progress and traits")
  .action(() => {
    const { state, collection } = runFull();
    const config = loadCfg();
    render(React.createElement(App, { command: "show", state, config, collection }));
  });

program
  .command("stats")
  .description("Show token usage statistics")
  .action(() => {
    const { state, collection } = runFull();
    const config = loadCfg();
    render(React.createElement(App, { command: "stats", state, config, collection }));
  });

program
  .command("collection")
  .description("List completed pets")
  .action(() => {
    const { state, collection } = runFull();
    const config = loadCfg();
    render(React.createElement(App, { command: "collection", state, config, collection }));
  });

program
  .command("view <petId>")
  .description("View a completed pet in detail")
  .action((petId: string) => {
    const { state, collection } = runFull();
    const config = loadCfg();
    render(React.createElement(App, { command: "view", state, config, collection, viewPetId: petId }));
  });

program
  .command("config")
  .description("Show current configuration")
  .action(() => {
    const { state, collection } = runFull();
    const config = loadCfg();
    render(React.createElement(App, { command: "config", state, config, collection }));
  });

program
  .command("recalibrate")
  .description("Recompute T0 from current log data")
  .action(() => {
    const config = loadCfg();
    ensureDataDir();
    let state = loadState() ?? createInitialState(10_000);
    const { state: postIngest } = runIngestion(config, state);
    state = runCalibration(postIngest, config);
    saveState(state);
    console.log(`Recalibrated. T0=${state.calibration?.t0}, Monthly estimate=${state.calibration?.monthlyEstimate}`);
  });

program
  .command("rescan")
  .description("Force re-ingest all logs from scratch")
  .action(() => {
    const config = loadCfg();
    ensureDataDir();
    const state = createInitialState(10_000); // Reset all ingestion offsets
    saveState(state);
    const { state: result } = runFull(config);
    console.log(`Rescan complete. ${result.globalStats.totalTokensAllTime.toLocaleString()} total tokens.`);
  });

program
  .command("watch")
  .description("Live mode: watch for log changes and update pet")
  .option("--no-animate", "Disable animation")
  .action((_opts) => {
    console.log("Watch mode not yet implemented in v0.1. Use 'tomotoken show' for now.");
  });

program.parse();
```

**Step 2: Commit**
```bash
git add bin/tomotoken.ts
git commit -m "feat: add CLI entry point with 8 commands"
```

---

## Phase 6: Integration + Polish

- [x] Task 20: Foundation tests + coverage check

**Files:**
- Test: `test/store/store.test.ts`
- Test: `test/utils/hash.test.ts`
- Test: `test/utils/time.test.ts`

**Step 1: Write store tests**

```typescript
// test/store/store.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  createInitialState, loadState, saveState,
  createInitialCollection, loadCollection, saveCollection, addCompletedPet,
  updateGlobalStats, updatePetInState,
} from "../../src/store/store.js";

const TMP = join(__dirname, "../tmp-store");

beforeEach(() => mkdirSync(TMP, { recursive: true }));
afterEach(() => rmSync(TMP, { recursive: true, force: true }));

describe("state persistence", () => {
  it("round-trips state through save/load", () => {
    const path = join(TMP, "state.json");
    const state = createInitialState(5000);
    saveState(state, path);
    const loaded = loadState(path);
    expect(loaded).toEqual(state);
  });

  it("returns null for missing file", () => {
    expect(loadState(join(TMP, "nonexistent.json"))).toBeNull();
  });
});

describe("collection persistence", () => {
  it("round-trips collection", () => {
    const path = join(TMP, "collection.json");
    const col = createInitialCollection();
    saveCollection(col, path);
    expect(loadCollection(path)).toEqual(col);
  });
});

describe("immutable updates", () => {
  it("updateGlobalStats creates new state", () => {
    const state = createInitialState(5000);
    const updated = updateGlobalStats(state, 1000, 1, "2026-01-01T00:00:00Z");
    expect(updated).not.toBe(state);
    expect(updated.globalStats.totalTokensAllTime).toBe(1000);
    expect(state.globalStats.totalTokensAllTime).toBe(0);
  });

  it("updatePetInState creates new state", () => {
    const state = createInitialState(5000);
    const updated = updatePetInState(state, { consumedTokens: 2500 });
    expect(updated.currentPet.consumedTokens).toBe(2500);
    expect(state.currentPet.consumedTokens).toBe(0);
  });
});
```

**Step 2: Write utils tests**

```typescript
// test/utils/hash.test.ts
import { describe, it, expect } from "vitest";
import { sha256, mulberry32, createPrng } from "../../src/utils/hash.js";

describe("sha256", () => {
  it("produces 64-char hex", () => {
    expect(sha256("test")).toMatch(/^[0-9a-f]{64}$/);
  });
  it("is deterministic", () => {
    expect(sha256("abc")).toBe(sha256("abc"));
  });
});

describe("mulberry32", () => {
  it("produces values in [0, 1)", () => {
    const prng = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = prng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it("is deterministic", () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    for (let i = 0; i < 10; i++) expect(a()).toBe(b());
  });
});
```

```typescript
// test/utils/time.test.ts
import { describe, it, expect } from "vitest";
import { currentMonthString, daysBetween, hoursAgo } from "../../src/utils/time.js";

describe("currentMonthString", () => {
  it("formats correctly", () => {
    expect(currentMonthString(new Date("2026-02-15"))).toBe("2026-02");
    expect(currentMonthString(new Date("2026-12-01"))).toBe("2026-12");
  });
});

describe("daysBetween", () => {
  it("returns 1 for same day", () => {
    expect(daysBetween("2026-01-15T08:00:00Z", "2026-01-15T20:00:00Z")).toBe(1);
  });
  it("returns correct days", () => {
    expect(daysBetween("2026-01-01T00:00:00Z", "2026-01-10T00:00:00Z")).toBe(10);
  });
});
```

**Step 3: Run all tests with coverage**
```bash
npx vitest run --coverage
```
Expected: All pass, 80%+ coverage on src/**

**Step 4: Commit**
```bash
git add test/store/ test/utils/
git commit -m "test: add store and utils test suites"
```

---

- [x] Task 21: Build verification + final commit

**Step 1: Fix any TypeScript errors**
```bash
npx tsc --noEmit
```
Fix any issues found.

**Step 2: Build with tsup**
```bash
npx tsup
```
Verify dist/ output is correct.

**Step 3: Smoke test**
```bash
node dist/bin/tomotoken.js show
node dist/bin/tomotoken.js stats
node dist/bin/tomotoken.js collection
```

**Step 4: Final commit**
```bash
git add -A
git commit -m "chore: build verification and polish"
```
