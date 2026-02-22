# `tomotoken window` + Encouragement Display Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `tomotoken window` subcommand that opens a new terminal window with the live pet view, and wire the existing encouragement system into the watch display so users see motivational messages while working.

**Architecture:** Three independent layers stacked bottom-up: (1) state schema extension for encouragement tracking, (2) encouragement logic wired into WatchApp via a new React hook, (3) cross-platform terminal spawner behind a `window` subcommand. Each layer is testable in isolation.

**Tech Stack:** TypeScript, Commander.js (CLI), Ink 5 / React (UI), Vitest (tests), Node.js `child_process` + `osascript` (terminal spawning)

---

## Existing Code Reference

| Module | File | Key exports |
|--------|------|-------------|
| Encouragement trigger | `src/encouragement/trigger.ts` | `shouldTrigger(tokensLastHour, threshold, lastShownAt, cooldownHours): boolean`, `selectMessage(prng): string` |
| Encouragement messages | `src/encouragement/messages.ts` | `ENCOURAGEMENT_MESSAGES` (10 strings) |
| Time utils | `src/utils/time.ts` | `hoursAgo(isoString, now?): number` |
| State store | `src/store/store.ts` | `createInitialState`, `loadState`, `saveState`, `updatePetInState`, `updateGlobalStats` |
| State types | `src/store/types.ts` | `AppState`, `PetRecord`, `GlobalStats` |
| Config schema | `src/config/schema.ts` | `Config` (has `encouragement.enabled`, `.tokensPerHourThreshold` = 50000, `.cooldownHours` = 3) |
| Watch hook | `src/ui/hooks/useWatcher.ts` | `useWatcher(config, state, collection): { state, collection, newlyCompleted, updateCount }`, `executeCycle()` |
| Watch UI | `src/ui/WatchApp.tsx` | `WatchApp({ config, initialState, initialCollection, onExit })` |
| CLI | `bin/tomotoken.ts` | Commander.js program with `show`, `stats`, `collection`, `watch`, etc. |
| Hash/PRNG | `src/utils/hash.ts` | `createPrng(hexSeed): () => number` |

---

- [-] Task 1: Add `lastEncouragementShownAt` to AppState

**Files:**
- Modify: `src/store/types.ts:51-61`
- Modify: `src/store/store.ts:97-112` (createInitialState), `src/store/store.ts:114-142` (loadState)
- Modify: `src/store/index.ts`
- Test: `test/store/store.test.ts`
- Test: `test/ui/useWatcher.test.ts:40-62`

**Step 1: Write the failing tests**

Add to `test/store/store.test.ts` inside the `"immutable updates"` describe:

```typescript
it("createInitialState includes lastEncouragementShownAt", () => {
  const state = createInitialState(5000);
  expect(state.lastEncouragementShownAt).toBeNull();
});

it("updateEncouragementTimestamp creates new state", () => {
  const state = createInitialState(5000);
  const ts = "2026-02-15T12:00:00.000Z";
  const updated = updateEncouragementTimestamp(state, ts);
  expect(updated).not.toBe(state);
  expect(updated.lastEncouragementShownAt).toBe(ts);
  expect(state.lastEncouragementShownAt).toBeNull();
});
```

Add import of `updateEncouragementTimestamp` to the existing import line.

**Step 2: Run tests to verify they fail**

Run: `npx vitest run test/store/store.test.ts`
Expected: FAIL — `updateEncouragementTimestamp` is not exported, `lastEncouragementShownAt` not in type

**Step 3: Write minimal implementation**

In `src/store/types.ts`, add to `AppState`:
```typescript
export interface AppState {
  readonly version: 2;
  readonly calibration: Calibration | null;
  readonly spawnIndexCurrentMonth: number;
  readonly currentMonth: string;
  readonly currentPet: PetRecord;
  readonly ingestionState: {
    readonly files: Record<string, FileIngestionState>;
  };
  readonly globalStats: GlobalStats;
  readonly lastEncouragementShownAt: string | null;
}
```

In `src/store/store.ts`, update `createInitialState`:
```typescript
export function createInitialState(requiredTokens: number): AppState {
  return {
    version: 2,
    calibration: null,
    spawnIndexCurrentMonth: 0,
    currentMonth: currentMonthString(),
    currentPet: createInitialPet(0, requiredTokens),
    ingestionState: { files: {} },
    globalStats: {
      totalTokensAllTime: 0,
      totalSessionsIngested: 0,
      earliestTimestamp: null,
      latestTimestamp: null,
    },
    lastEncouragementShownAt: null,
  };
}
```

Update `loadState` — after the v1→v2 migration block (line ~141), add backfill for the new field:
```typescript
  // Backfill lastEncouragementShownAt for pre-encouragement states
  const state = raw as unknown as AppState;
  if (!("lastEncouragementShownAt" in raw)) {
    return { ...state, lastEncouragementShownAt: null };
  }
  return state;
```

Add new function:
```typescript
export function updateEncouragementTimestamp(
  state: AppState,
  timestamp: string,
): AppState {
  return { ...state, lastEncouragementShownAt: timestamp };
}
```

In `src/store/index.ts`, add `updateEncouragementTimestamp` to exports.

In `test/ui/useWatcher.test.ts`, add `lastEncouragementShownAt: null` to `createTestState()`.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run test/store/store.test.ts test/ui/useWatcher.test.ts`
Expected: PASS

**Step 5: Run full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: ALL PASS (any file referencing `AppState` will be checked by tsc)

**Step 6: Commit**

```bash
git add src/store/types.ts src/store/store.ts src/store/index.ts test/store/store.test.ts test/ui/useWatcher.test.ts
git commit -m "feat: add lastEncouragementShownAt to AppState with migration"
```

---

- [-] Task 2: Create `tokensInWindow` rate calculator

**Files:**
- Create: `src/encouragement/rate.ts`
- Modify: `src/encouragement/index.ts`
- Test: `test/encouragement/rate.test.ts`

**Step 1: Write the failing test**

Create `test/encouragement/rate.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { tokensInWindow } from "../../src/encouragement/rate.js";
import type { TokenEvent } from "../../src/encouragement/rate.js";

describe("tokensInWindow", () => {
  const now = new Date("2026-02-15T12:00:00.000Z");

  it("returns 0 for empty events", () => {
    expect(tokensInWindow([], 60, now)).toBe(0);
  });

  it("sums all events within window", () => {
    const events: TokenEvent[] = [
      { tokens: 1000, timestamp: "2026-02-15T11:30:00.000Z" },
      { tokens: 2000, timestamp: "2026-02-15T11:45:00.000Z" },
    ];
    expect(tokensInWindow(events, 60, now)).toBe(3000);
  });

  it("excludes events outside window", () => {
    const events: TokenEvent[] = [
      { tokens: 5000, timestamp: "2026-02-15T10:00:00.000Z" }, // 2h ago
      { tokens: 1000, timestamp: "2026-02-15T11:30:00.000Z" }, // 30m ago
    ];
    expect(tokensInWindow(events, 60, now)).toBe(1000);
  });

  it("includes events exactly at window boundary", () => {
    const events: TokenEvent[] = [
      { tokens: 500, timestamp: "2026-02-15T11:00:00.000Z" }, // exactly 60m ago
    ];
    expect(tokensInWindow(events, 60, now)).toBe(500);
  });

  it("returns 0 when all events are expired", () => {
    const events: TokenEvent[] = [
      { tokens: 9999, timestamp: "2026-02-15T09:00:00.000Z" },
    ];
    expect(tokensInWindow(events, 60, now)).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/encouragement/rate.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `src/encouragement/rate.ts`:

```typescript
export interface TokenEvent {
  readonly tokens: number;
  readonly timestamp: string;
}

export function tokensInWindow(
  events: readonly TokenEvent[],
  windowMinutes: number,
  now: Date,
): number {
  const cutoff = now.getTime() - windowMinutes * 60 * 1000;
  return events.reduce((sum, e) => {
    const t = new Date(e.timestamp).getTime();
    return t >= cutoff ? sum + e.tokens : sum;
  }, 0);
}
```

Update `src/encouragement/index.ts`:

```typescript
export { ENCOURAGEMENT_MESSAGES } from "./messages.js";
export { shouldTrigger, selectMessage } from "./trigger.js";
export { tokensInWindow, type TokenEvent } from "./rate.js";
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/encouragement/rate.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/encouragement/rate.ts src/encouragement/index.ts test/encouragement/rate.test.ts
git commit -m "feat: add tokensInWindow rate calculator for encouragement"
```

---

- [-] Task 3: Create `useEncouragement` hook

**Files:**
- Create: `src/ui/hooks/useEncouragement.ts`
- Test: `test/ui/hooks/useEncouragement.test.ts`

**Step 1: Write the failing test**

Create `test/ui/hooks/useEncouragement.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/store/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/store/index.js")>();
  return { ...actual, saveState: vi.fn() };
});

import { shouldTriggerEncouragement, computeEncouragementState } from "../../../src/ui/hooks/useEncouragement.js";
import type { AppState } from "../../../src/store/types.js";
import { createDefaultConfig } from "../../../src/config/schema.js";
import type { TokenEvent } from "../../../src/encouragement/rate.js";

function createTestState(overrides?: Partial<AppState>): AppState {
  return {
    version: 2,
    calibration: null,
    spawnIndexCurrentMonth: 0,
    currentMonth: "2026-02",
    currentPet: {
      petId: "test-pet", spawnedAt: "2026-02-01T00:00:00.000Z",
      requiredTokens: 10_000, consumedTokens: 3_000,
      spawnIndex: 0, personalitySnapshot: null,
    },
    ingestionState: { files: {} },
    globalStats: { totalTokensAllTime: 3_000, totalSessionsIngested: 1, earliestTimestamp: null, latestTimestamp: null },
    lastEncouragementShownAt: null,
    ...overrides,
  };
}

describe("shouldTriggerEncouragement", () => {
  it("returns true when tokens exceed threshold and cooldown elapsed", () => {
    const config = createDefaultConfig();
    const events: TokenEvent[] = [
      { tokens: 60_000, timestamp: new Date().toISOString() },
    ];
    const state = createTestState();
    expect(shouldTriggerEncouragement(config, state, events)).toBe(true);
  });

  it("returns false when encouragement is disabled", () => {
    const config = { ...createDefaultConfig(), encouragement: { enabled: false, tokensPerHourThreshold: 50_000, cooldownHours: 3 } };
    const events: TokenEvent[] = [
      { tokens: 60_000, timestamp: new Date().toISOString() },
    ];
    expect(shouldTriggerEncouragement(config, createTestState(), events)).toBe(false);
  });

  it("returns false when tokens below threshold", () => {
    const config = createDefaultConfig();
    const events: TokenEvent[] = [
      { tokens: 100, timestamp: new Date().toISOString() },
    ];
    expect(shouldTriggerEncouragement(config, createTestState(), events)).toBe(false);
  });

  it("returns false when cooldown not elapsed", () => {
    const config = createDefaultConfig();
    const events: TokenEvent[] = [
      { tokens: 60_000, timestamp: new Date().toISOString() },
    ];
    const state = createTestState({ lastEncouragementShownAt: new Date().toISOString() });
    expect(shouldTriggerEncouragement(config, state, events)).toBe(false);
  });
});

describe("computeEncouragementState", () => {
  it("returns visible message when triggered", () => {
    const config = createDefaultConfig();
    const events: TokenEvent[] = [
      { tokens: 60_000, timestamp: new Date().toISOString() },
    ];
    const state = createTestState();
    const result = computeEncouragementState(config, state, events);
    expect(result.visible).toBe(true);
    expect(result.message).toBeTruthy();
  });

  it("returns invisible when not triggered", () => {
    const config = createDefaultConfig();
    const result = computeEncouragementState(config, createTestState(), []);
    expect(result.visible).toBe(false);
    expect(result.message).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/ui/hooks/useEncouragement.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `src/ui/hooks/useEncouragement.ts`:

```typescript
import { useState, useEffect, useRef } from "react";
import { shouldTrigger, selectMessage } from "../../encouragement/trigger.js";
import { tokensInWindow } from "../../encouragement/rate.js";
import type { TokenEvent } from "../../encouragement/rate.js";
import { saveState, updateEncouragementTimestamp } from "../../store/index.js";
import { createPrng } from "../../utils/hash.js";
import type { AppState } from "../../store/types.js";
import type { Config } from "../../config/schema.js";

const DISPLAY_DURATION_MS = 30_000;
const WINDOW_MINUTES = 60;

export interface EncouragementState {
  readonly message: string | null;
  readonly visible: boolean;
}

export function shouldTriggerEncouragement(
  config: Config,
  state: AppState,
  events: readonly TokenEvent[],
): boolean {
  if (!config.encouragement.enabled) return false;
  const tokensLastHour = tokensInWindow(events, WINDOW_MINUTES, new Date());
  return shouldTrigger(
    tokensLastHour,
    config.encouragement.tokensPerHourThreshold,
    state.lastEncouragementShownAt,
    config.encouragement.cooldownHours,
  );
}

export function computeEncouragementState(
  config: Config,
  state: AppState,
  events: readonly TokenEvent[],
): EncouragementState {
  if (!shouldTriggerEncouragement(config, state, events)) {
    return { message: null, visible: false };
  }
  const prng = createPrng(
    (state.currentPet.petId + Date.now().toString(16)).padEnd(64, "0").slice(0, 64),
  );
  return { message: selectMessage(prng), visible: true };
}

export function useEncouragement(
  config: Config,
  state: AppState,
  updateCount: number,
): EncouragementState {
  const [display, setDisplay] = useState<EncouragementState>({ message: null, visible: false });
  const eventsRef = useRef<TokenEvent[]>([]);
  const prevTokensRef = useRef(state.currentPet.consumedTokens);

  useEffect(() => {
    if (updateCount === 0) return;

    const currentTokens = state.currentPet.consumedTokens;
    const delta = currentTokens - prevTokensRef.current;
    prevTokensRef.current = currentTokens;

    if (delta > 0) {
      const now = new Date();
      eventsRef.current = [
        ...eventsRef.current.filter(
          (e) => now.getTime() - new Date(e.timestamp).getTime() < WINDOW_MINUTES * 60 * 1000,
        ),
        { tokens: delta, timestamp: now.toISOString() },
      ];
    }

    const result = computeEncouragementState(config, state, eventsRef.current);
    if (result.visible) {
      setDisplay(result);
      saveState(updateEncouragementTimestamp(state, new Date().toISOString()));
    }
  }, [updateCount, config, state]);

  // Auto-hide timer
  useEffect(() => {
    if (!display.visible) return;
    const timer = setTimeout(() => setDisplay({ message: null, visible: false }), DISPLAY_DURATION_MS);
    return () => clearTimeout(timer);
  }, [display.visible]);

  return display;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/ui/hooks/useEncouragement.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/ui/hooks/useEncouragement.ts test/ui/hooks/useEncouragement.test.ts
git commit -m "feat: add useEncouragement hook for watch mode"
```

---

- [-] Task 4: Wire encouragement into WatchApp

**Files:**
- Modify: `src/ui/WatchApp.tsx`

**Step 1: Modify WatchApp**

Replace `src/ui/WatchApp.tsx` contents:

```tsx
import React from "react";
import { Box, Text, useInput } from "ink";
import { useWatcher } from "./hooks/useWatcher.js";
import { useEncouragement } from "./hooks/useEncouragement.js";
import { PetView } from "./components/PetView.js";
import type { AppState, Collection } from "../store/types.js";
import type { Config } from "../config/schema.js";

interface Props {
  config: Config;
  initialState: AppState;
  initialCollection: Collection;
  onExit: () => void;
}

export function WatchApp({ config, initialState, initialCollection, onExit }: Props) {
  const { state, collection, newlyCompleted, updateCount } = useWatcher(config, initialState, initialCollection);
  const encouragement = useEncouragement(config, state, updateCount);

  useInput((_input, key) => {
    if (key.escape || (key.ctrl && _input === "c")) {
      onExit();
    }
  });

  const latestCompleted = newlyCompleted.length > 0 ? newlyCompleted[newlyCompleted.length - 1] : null;

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold dimColor>tomotoken watch</Text>
      <Text dimColor>Watching for token usage... (Ctrl+C to exit)</Text>
      <Text> </Text>
      <PetView state={state} config={config} />
      <Text> </Text>
      {encouragement.visible && encouragement.message && (
        <Box borderStyle="round" borderColor="yellow" paddingX={1}>
          <Text color="yellow">{encouragement.message}</Text>
        </Box>
      )}
      {latestCompleted && (
        <Box flexDirection="column">
          <Text bold color="green">Pet completed!</Text>
          <Text dimColor>New pet spawned.</Text>
          <Text> </Text>
        </Box>
      )}
      <Text dimColor>Collection: {collection.pets.length} pets | Updates: {updateCount}</Text>
    </Box>
  );
}
```

**Step 2: Run tests + typecheck**

Run: `npm test && npm run typecheck`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add src/ui/WatchApp.tsx
git commit -m "feat: wire encouragement messages into watch mode display"
```

---

- [-] Task 5: Create terminal detection module

**Files:**
- Create: `src/window/detect.ts`
- Test: `test/window/detect.test.ts`

**Step 1: Write the failing test**

Create `test/window/detect.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { detectPlatform, detectTerminal } from "../../src/window/detect.js";

describe("detectPlatform", () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform });
  });

  it("returns darwin on macOS", () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    expect(detectPlatform()).toBe("darwin");
  });

  it("returns unsupported on windows", () => {
    Object.defineProperty(process, "platform", { value: "win32" });
    expect(detectPlatform()).toBe("unsupported");
  });
});

describe("detectTerminal", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("detects iTerm2 on macOS via TERM_PROGRAM", () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    process.env.TERM_PROGRAM = "iTerm.app";
    const info = detectTerminal();
    expect(info.platform).toBe("darwin");
    expect(info.terminalApp).toBe("iTerm.app");
  });

  it("returns null terminalApp when TERM_PROGRAM not set on macOS", () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    delete process.env.TERM_PROGRAM;
    const info = detectTerminal();
    expect(info.platform).toBe("darwin");
    expect(info.terminalApp).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/window/detect.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `src/window/detect.ts`:

```typescript
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

export type Platform = "darwin" | "linux" | "wsl" | "unsupported";

export interface TerminalInfo {
  readonly platform: Platform;
  readonly terminalApp: string | null;
}

function isWsl(): boolean {
  try {
    const version = readFileSync("/proc/version", "utf-8");
    return /microsoft/i.test(version);
  } catch {
    return false;
  }
}

export function detectPlatform(): Platform {
  if (process.platform === "darwin") return "darwin";
  if (process.platform === "linux") return isWsl() ? "wsl" : "linux";
  return "unsupported";
}

function findLinuxTerminal(): string | null {
  const candidates = ["gnome-terminal", "xfce4-terminal", "konsole", "xterm", "x-terminal-emulator"];
  for (const cmd of candidates) {
    try {
      execFileSync("which", [cmd], { stdio: "pipe" });
      return cmd;
    } catch {
      // not found, try next
    }
  }
  return null;
}

export function detectTerminal(): TerminalInfo {
  const platform = detectPlatform();

  if (platform === "darwin") {
    return {
      platform,
      terminalApp: process.env.TERM_PROGRAM ?? null,
    };
  }

  if (platform === "linux") {
    return { platform, terminalApp: findLinuxTerminal() };
  }

  if (platform === "wsl") {
    return { platform, terminalApp: "cmd.exe" };
  }

  return { platform, terminalApp: null };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/window/detect.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/window/detect.ts test/window/detect.test.ts
git commit -m "feat: add cross-platform terminal detection"
```

---

- [-] Task 6: Create window spawn module

**Files:**
- Create: `src/window/spawn.ts`
- Create: `src/window/index.ts`
- Test: `test/window/spawn.test.ts`

**Step 1: Write the failing test**

Create `test/window/spawn.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildSpawnArgs } from "../../src/window/spawn.js";
import type { TerminalInfo } from "../../src/window/detect.js";

describe("buildSpawnArgs", () => {
  const binPath = "/usr/local/bin/tomotoken";

  it("macOS Terminal.app uses osascript", () => {
    const info: TerminalInfo = { platform: "darwin", terminalApp: null };
    const result = buildSpawnArgs(info, binPath, []);
    expect(result.command).toBe("osascript");
    expect(result.args[0]).toBe("-e");
    expect(result.args[1]).toContain("Terminal");
    expect(result.args[1]).toContain(binPath);
    expect(result.args[1]).toContain("watch");
  });

  it("macOS iTerm2 uses osascript with iTerm2", () => {
    const info: TerminalInfo = { platform: "darwin", terminalApp: "iTerm.app" };
    const result = buildSpawnArgs(info, binPath, []);
    expect(result.command).toBe("osascript");
    expect(result.args[1]).toContain("iTerm");
  });

  it("linux gnome-terminal uses -- separator", () => {
    const info: TerminalInfo = { platform: "linux", terminalApp: "gnome-terminal" };
    const result = buildSpawnArgs(info, binPath, []);
    expect(result.command).toBe("gnome-terminal");
    expect(result.args).toContain("--");
    expect(result.args).toContain(binPath);
  });

  it("linux xterm uses -e flag", () => {
    const info: TerminalInfo = { platform: "linux", terminalApp: "xterm" };
    const result = buildSpawnArgs(info, binPath, []);
    expect(result.command).toBe("xterm");
    expect(result.args[0]).toBe("-e");
  });

  it("wsl uses cmd.exe to start wt.exe", () => {
    const info: TerminalInfo = { platform: "wsl", terminalApp: "cmd.exe" };
    const result = buildSpawnArgs(info, binPath, []);
    expect(result.command).toBe("cmd.exe");
    expect(result.args).toContain("/c");
  });

  it("passes extra args through", () => {
    const info: TerminalInfo = { platform: "linux", terminalApp: "xterm" };
    const result = buildSpawnArgs(info, binPath, ["--no-animate"]);
    expect(result.args.join(" ")).toContain("--no-animate");
  });

  it("throws for unsupported platform", () => {
    const info: TerminalInfo = { platform: "unsupported", terminalApp: null };
    expect(() => buildSpawnArgs(info, binPath, [])).toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/window/spawn.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `src/window/spawn.ts`:

```typescript
import { spawn } from "node:child_process";
import { detectTerminal } from "./detect.js";
import type { TerminalInfo } from "./detect.js";

export interface SpawnResult {
  readonly success: boolean;
  readonly error?: string;
  readonly terminalUsed: string;
}

interface SpawnArgs {
  readonly command: string;
  readonly args: readonly string[];
}

const GNOME_LIKE = new Set(["gnome-terminal", "xfce4-terminal"]);
const XTERM_LIKE = new Set(["xterm", "x-terminal-emulator", "konsole"]);

export function buildSpawnArgs(
  info: TerminalInfo,
  binPath: string,
  extraArgs: readonly string[],
): SpawnArgs {
  const watchCmd = [binPath, "watch", ...extraArgs];
  const fullCmd = watchCmd.join(" ");

  if (info.platform === "darwin") {
    if (info.terminalApp === "iTerm.app") {
      return {
        command: "osascript",
        args: ["-e", `tell application "iTerm2" to create window with default profile command "${fullCmd}"`],
      };
    }
    return {
      command: "osascript",
      args: ["-e", `tell application "Terminal" to do script "${fullCmd}"`],
    };
  }

  if (info.platform === "linux") {
    const term = info.terminalApp;
    if (term && GNOME_LIKE.has(term)) {
      return { command: term, args: ["--", ...watchCmd] };
    }
    if (term && XTERM_LIKE.has(term)) {
      return { command: term, args: ["-e", ...watchCmd] };
    }
    if (term) {
      return { command: term, args: ["-e", ...watchCmd] };
    }
    throw new Error("No supported terminal emulator found. Install gnome-terminal, xterm, or similar.");
  }

  if (info.platform === "wsl") {
    return {
      command: "cmd.exe",
      args: ["/c", "start", "wt.exe", "wsl", "--", ...watchCmd],
    };
  }

  throw new Error(`Unsupported platform: ${info.platform}. Run "tomotoken watch" manually.`);
}

export function spawnWindow(
  binPath: string,
  extraArgs: readonly string[] = [],
): SpawnResult {
  const info = detectTerminal();
  const terminalUsed = info.terminalApp ?? info.platform;

  try {
    const { command, args } = buildSpawnArgs(info, binPath, extraArgs);
    const child = spawn(command, [...args], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return { success: true, terminalUsed };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      terminalUsed,
    };
  }
}
```

Create `src/window/index.ts`:

```typescript
export { detectPlatform, detectTerminal, type TerminalInfo, type Platform } from "./detect.js";
export { spawnWindow, buildSpawnArgs, type SpawnResult } from "./spawn.js";
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/window/spawn.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/window/spawn.ts src/window/index.ts test/window/spawn.test.ts
git commit -m "feat: add cross-platform window spawner"
```

---

- [-] Task 7: Add `window` subcommand to CLI

**Files:**
- Modify: `bin/tomotoken.ts`

**Step 1: Add the subcommand**

Add this block after the `watch` command and before `program.parse()` in `bin/tomotoken.ts`:

```typescript
import { resolve } from "node:path";
import { spawnWindow } from "../src/window/index.js";

// ... (add import at top of file)

program
  .command("window")
  .description("Open pet in a new terminal window (live watch mode)")
  .option("--no-animate", "Disable animation in the new window")
  .action((opts: { animate: boolean }) => {
    const extraArgs = opts.animate === false ? ["--no-animate"] : [];
    const binPath = resolve(process.argv[1]);
    const result = spawnWindow(binPath, extraArgs);
    if (!result.success) {
      console.error(`Failed to open window: ${result.error}`);
      console.error('Tip: run "tomotoken watch" manually in another terminal.');
      process.exit(1);
    }
    console.log(`Opened tomotoken in ${result.terminalUsed}`);
  });
```

**Step 2: Run typecheck + full test suite**

Run: `npm run typecheck && npm test`
Expected: ALL PASS

**Step 3: Manual verification**

Run: `npx tsx bin/tomotoken.ts window`
Expected: New terminal window opens running `tomotoken watch`

Run: `npx tsx bin/tomotoken.ts window --no-animate`
Expected: Same but with `--no-animate` passed through

**Step 4: Commit**

```bash
git add bin/tomotoken.ts
git commit -m "feat: add tomotoken window subcommand for separate terminal"
```

---

## Verification Checklist

1. `npm test` — All tests pass (existing 249 + ~20 new)
2. `npm run typecheck` — Clean, no errors
3. `tomotoken watch` — Encouragement message appears in yellow bordered box when tokens/hour exceeds 50,000
4. `tomotoken window` — New terminal window opens with live watch mode running
5. `tomotoken window --no-animate` — Same but static display (no animation)
6. State migration — Running on old `state.json` without `lastEncouragementShownAt` works fine (backfilled to `null`)
