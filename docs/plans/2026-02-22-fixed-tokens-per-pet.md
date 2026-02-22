# Fixed Tokens Per Pet — Calibration System Removal

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the dynamic calibration system (T0, growth multiplier, monthly estimate) with a single fixed constant `TOKENS_PER_PET = 1_000_000_000` so every pet costs the same.

**Architecture:** Remove `computeCalibration()`, the `Calibration` type, the `growth` config block, the `recalibrate` CLI command, and the exponential `t0 * g^idx` formula in `advancePet()`. Every new pet simply gets `TOKENS_PER_PET` as its `requiredTokens`. The `spawnIndex` field stays on `PetRecord` for ordering but is no longer used in calculations. The `spawnIndexCurrentMonth` field and monthly reset are removed entirely.

**Tech Stack:** TypeScript, Vitest

---

## Layout Reference — Before vs After

```
BEFORE:
  computeCalibration() → t0 = monthlyEstimate / (1+g+g²)
  advancePet(pet, delta, t0, g, spawnIndex)
  newRequired = Math.ceil(t0 * Math.pow(g, idx))
  recalibrate CLI command
  config.growth.g / config.growth.t0Rounding

AFTER:
  TOKENS_PER_PET = 1_000_000_000
  advancePet(pet, delta)
  newRequired = TOKENS_PER_PET
  (no recalibrate command)
  (no growth config)
```

---

- [ ] Task 1: Add `TOKENS_PER_PET` constant, remove `GROWTH_MULTIPLIER`

**Files:**
- Modify: `src/config/constants.ts:12`

**Step 1: Replace constant**

In `src/config/constants.ts`, replace line 12:

```typescript
// BEFORE
export const GROWTH_MULTIPLIER = 1.5;
// AFTER
export const TOKENS_PER_PET = 1_000_000_000;
```

**Step 2: Commit**

```bash
git add src/config/constants.ts
git commit -m "feat(config): add TOKENS_PER_PET constant, remove GROWTH_MULTIPLIER"
```

---

- [ ] Task 2: Simplify `advancePet()` — remove `t0`/`g`/`spawnIndex` params

**Files:**
- Modify: `src/progression/engine.ts`
- Modify: `test/progression/engine.test.ts`

**Step 1: Write updated tests**

Rewrite `test/progression/engine.test.ts` to test the simplified signature:

```typescript
import { describe, it, expect } from "vitest";
import { advancePet } from "../../src/progression/engine.js";

function makePet(overrides = {}) {
  return {
    petId: "test-pet",
    spawnedAt: "2026-01-01T00:00:00Z",
    requiredTokens: 1_000_000_000,
    consumedTokens: 0,
    spawnIndex: 0,
    personalitySnapshot: null,
    generatedDesigns: null,
    ...overrides,
  };
}

describe("advancePet", () => {
  it("adds tokens to current pet without completing", () => {
    const result = advancePet(makePet(), 500_000_000);
    expect(result.updatedPet.consumedTokens).toBe(500_000_000);
    expect(result.completedPets).toHaveLength(0);
  });

  it("completes pet at exact threshold", () => {
    const result = advancePet(makePet(), 1_000_000_000);
    expect(result.completedPets).toHaveLength(1);
    expect(result.completedPets[0].consumedTokens).toBe(1_000_000_000);
    expect(result.updatedPet.consumedTokens).toBe(0);
    expect(result.updatedPet.requiredTokens).toBe(1_000_000_000);
  });

  it("completes multiple pets on large delta", () => {
    const result = advancePet(makePet(), 2_500_000_000);
    expect(result.completedPets).toHaveLength(2);
    expect(result.updatedPet.consumedTokens).toBe(500_000_000);
    expect(result.updatedPet.requiredTokens).toBe(1_000_000_000);
  });

  it("carries overflow into new pet", () => {
    const pet = makePet({ consumedTokens: 800_000_000 });
    const result = advancePet(pet, 300_000_000);
    expect(result.completedPets).toHaveLength(1);
    expect(result.updatedPet.consumedTokens).toBe(100_000_000);
  });

  it("increments spawnIndex on each completion", () => {
    const result = advancePet(makePet(), 2_000_000_000);
    expect(result.completedPets[0].spawnIndex).toBe(0);
    expect(result.completedPets[1].spawnIndex).toBe(1);
    expect(result.updatedPet.spawnIndex).toBe(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/progression/engine.test.ts`
Expected: FAIL — `advancePet` still requires 5 params.

**Step 3: Rewrite `engine.ts`**

Replace `src/progression/engine.ts` entirely:

```typescript
import { v4 as uuidv4 } from "uuid";
import { TOKENS_PER_PET } from "../config/constants.js";
import type { PetRecord, CompletedPet, PersonalitySnapshot } from "../store/types.js";
import type { AdvanceResult } from "./types.js";

const EMPTY_PERSONALITY: PersonalitySnapshot = {
  usageMix: {},
  depthMetrics: { editTestLoopCount: 0, repeatEditSameFileCount: 0, phaseSwitchCount: 0, totalSessions: 0 },
  styleMetrics: { bulletRatio: 0, questionRatio: 0, codeblockRatio: 0, avgMessageLen: 0, messageLenStd: 0, headingRatio: 0 },
  traits: {},
};

export function advancePet(
  currentPet: PetRecord,
  deltaTokens: number,
): AdvanceResult {
  let remaining = deltaTokens;
  let pet = currentPet;
  let idx = currentPet.spawnIndex;
  const completed: CompletedPet[] = [];

  while (remaining > 0) {
    const need = pet.requiredTokens - pet.consumedTokens;

    if (remaining < need) {
      pet = { ...pet, consumedTokens: pet.consumedTokens + remaining };
      remaining = 0;
    } else {
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
      pet = {
        petId: uuidv4(),
        spawnedAt: new Date().toISOString(),
        requiredTokens: TOKENS_PER_PET,
        consumedTokens: 0,
        spawnIndex: idx,
        personalitySnapshot: null,
        generatedDesigns: null,
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

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/progression/engine.test.ts`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add src/progression/engine.ts test/progression/engine.test.ts
git commit -m "refactor(progression): simplify advancePet to use fixed TOKENS_PER_PET"
```

---

- [ ] Task 3: Remove calibration types and module

**Files:**
- Delete: `src/progression/calibration.ts`
- Delete: `test/progression/calibration.test.ts`
- Modify: `src/progression/types.ts`
- Modify: `src/progression/index.ts`

**Step 1: Delete calibration files**

```bash
rm src/progression/calibration.ts test/progression/calibration.test.ts
```

**Step 2: Clean types**

Replace `src/progression/types.ts`:

```typescript
import type { CompletedPet, PetRecord } from "../store/types.js";

export interface AdvanceResult {
  readonly updatedPet: PetRecord;
  readonly completedPets: readonly CompletedPet[];
  readonly newSpawnIndex: number;
  readonly remainingTokens: number;
}
```

(Remove `CalibrationInput` and `CalibrationResult` interfaces.)

**Step 3: Update barrel export**

Replace `src/progression/index.ts`:

```typescript
export { advancePet } from "./engine.js";
export { detectMonthChange, handleMonthChange } from "./monthly.js";
export { computeEggStage, type EggStage } from "./stages.js";
```

(Remove `computeCalibration` re-export.)

**Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: Errors in files that still reference calibration (src/index.ts, etc.) — these are fixed in subsequent tasks.

**Step 5: Commit**

```bash
git add -u src/progression/ test/progression/calibration.test.ts
git commit -m "refactor(progression): remove calibration module and types"
```

---

- [ ] Task 4: Remove `Calibration` from store types and simplify state

**Files:**
- Modify: `src/store/types.ts:8-12,56-57`
- Modify: `src/store/store.ts:81-114,120-155`

**Step 1: Clean store types**

In `src/store/types.ts`:
- Delete `Calibration` interface (lines 8-12)
- Remove `calibration: Calibration | null` from `AppState` (line 56)
- Remove `spawnIndexCurrentMonth: number` from `AppState` (line 57)

The `AppState` becomes:

```typescript
export interface AppState {
  readonly version: 2;
  readonly currentMonth: string;
  readonly currentPet: PetRecord;
  readonly ingestionState: {
    readonly files: Record<string, FileIngestionState>;
  };
  readonly globalStats: GlobalStats;
  readonly lastEncouragementShownAt: string | null;
}
```

**Step 2: Simplify store.ts**

In `src/store/store.ts`:

a) `createInitialState` — remove `requiredTokens` param, use `TOKENS_PER_PET`:

```typescript
import { TOKENS_PER_PET } from "../config/constants.js";

export function createInitialState(): AppState {
  return {
    version: 2,
    currentMonth: currentMonthString(),
    currentPet: createInitialPet(0, TOKENS_PER_PET),
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

b) `loadState` migration — strip calibration/spawnIndexCurrentMonth from old states:

```typescript
export function loadState(path: string = STATE_PATH): AppState | null {
  const raw = readJson<Record<string, unknown>>(path);
  if (!raw) return null;

  // Version migration: v1 → v2
  if ((raw as { version?: number }).version === 1) {
    const v1 = raw as Record<string, unknown>;
    const v1Pet = v1.currentPet as Record<string, unknown>;
    return {
      version: 2,
      currentMonth: v1.currentMonth as string,
      currentPet: {
        petId: v1Pet.petId as string,
        spawnedAt: v1Pet.spawnedAt as string,
        requiredTokens: TOKENS_PER_PET,
        consumedTokens: v1Pet.consumedTokens as number,
        spawnIndex: 0,
        personalitySnapshot: null,
        generatedDesigns: null,
      },
      ingestionState: v1.ingestionState as AppState["ingestionState"],
      globalStats: v1.globalStats as AppState["globalStats"],
      lastEncouragementShownAt: null,
    };
  }

  // Backfill fields for pre-existing v2 states
  let state = raw as unknown as AppState;
  if (!("lastEncouragementShownAt" in raw)) {
    state = { ...state, lastEncouragementShownAt: null };
  }
  const pet = raw.currentPet as Record<string, unknown> | undefined;
  if (pet && !("generatedDesigns" in pet)) {
    state = { ...state, currentPet: { ...state.currentPet, generatedDesigns: null } };
  }
  return state;
}
```

**Step 3: Commit**

```bash
git add src/store/types.ts src/store/store.ts
git commit -m "refactor(store): remove Calibration type and spawnIndexCurrentMonth from AppState"
```

---

- [ ] Task 5: Simplify `src/index.ts` — remove `runCalibration`, simplify `runProgression`

**Files:**
- Modify: `src/index.ts:9,56-72,74-103,150,158-164`

**Step 1: Remove imports**

Remove `computeCalibration` from imports (line 9).

**Step 2: Delete `runCalibration` function**

Delete lines 56-72 entirely.

**Step 3: Simplify `runProgression`**

```typescript
export function runProgression(state: AppState, newTokens: number): { state: AppState; completed: CompletedPet[] } {
  if (newTokens === 0) return { state, completed: [] };

  let current = state;

  if (detectMonthChange(current.currentMonth)) {
    current = handleMonthChange(current);
  }

  const result = advancePet(current.currentPet, newTokens);

  const completedWithArt: CompletedPet[] = [];
  for (const pet of result.completedPets) {
    const seed = generateSeed(hostname(), pet.petId);
    completedWithArt.push({
      ...pet,
      seed,
      frames: generateAsciiFrames(seed, pet.personality, cfg?.canvas ?? { width: 40, height: 20, frames: 4 }),
      colorFrames: [],
    });
  }

  const updatedState: AppState = {
    ...current,
    currentPet: result.updatedPet,
  };

  return { state: updatedState, completed: completedWithArt };
}
```

(Remove calibration guard, remove `config` param, remove `spawnIndexCurrentMonth` update, remove `state.calibration.t0`.)

**Step 4: Simplify `runFull`**

In the `runFull` function:
- Line 150: Change `createInitialState(10_000)` → `createInitialState()`
- Delete lines 157-164 (the calibration block)
- Line 171: Change `runProgression(state, newTokens, cfg)` → `runProgression(state, newTokens)`

**Step 5: Run typecheck**

Run: `npx tsc --noEmit`
Expected: Errors in bin/tomotoken.ts and UI files (fixed in next tasks).

**Step 6: Commit**

```bash
git add src/index.ts
git commit -m "refactor(core): remove runCalibration, simplify runProgression"
```

---

- [ ] Task 6: Remove `growth` config block

**Files:**
- Modify: `src/config/schema.ts:11,36-41`

**Step 1: Remove growth from schema**

Remove `GROWTH_MULTIPLIER` import (line 11) and delete the `growth` config block (lines 36-41).

**Step 2: Commit**

```bash
git add src/config/schema.ts
git commit -m "refactor(config): remove growth config block (g, t0Rounding)"
```

---

- [ ] Task 7: Remove `recalibrate` CLI command

**Files:**
- Modify: `bin/tomotoken.ts:9,68-78`

**Step 1: Remove import**

Remove `runCalibration` from the import at line 9.

**Step 2: Delete `recalibrate` command**

Delete lines 68-78 (the `.command("recalibrate")` block).

**Step 3: Commit**

```bash
git add bin/tomotoken.ts
git commit -m "refactor(cli): remove recalibrate command"
```

---

- [ ] Task 8: Simplify `useWatcher` hook and `StatsPanel`

**Files:**
- Modify: `src/ui/hooks/useWatcher.ts:3,42-50`
- Modify: `src/ui/components/StatsPanel.tsx:18-25`

**Step 1: Clean useWatcher**

Remove `runCalibration` import (line 3). Delete the calibration block (lines 42-50) inside `executeCycle`.

**Step 2: Clean StatsPanel**

Remove the calibration display block (lines 18-25):

```tsx
// DELETE this block:
{state.calibration && (
  <>
    <Text> </Text>
    <Text bold>Calibration</Text>
    <Text>T0: {state.calibration.t0.toLocaleString()}</Text>
    <Text>Monthly estimate: {state.calibration.monthlyEstimate.toLocaleString()}</Text>
  </>
)}
```

**Step 3: Commit**

```bash
git add src/ui/hooks/useWatcher.ts src/ui/components/StatsPanel.tsx
git commit -m "refactor(ui): remove calibration display and recalibration cycle"
```

---

- [ ] Task 9: Simplify monthly.ts — remove `spawnIndexCurrentMonth` reset

**Files:**
- Modify: `src/progression/monthly.ts:11`
- Modify: `test/progression/monthly.test.ts`

**Step 1: Update monthly.ts**

In `handleMonthChange`, remove the `spawnIndexCurrentMonth: 0` line. The function should only update `currentMonth`.

**Step 2: Update monthly test**

Remove assertions about `spawnIndexCurrentMonth` from `test/progression/monthly.test.ts`.

**Step 3: Run tests**

Run: `npx vitest run test/progression/monthly.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/progression/monthly.ts test/progression/monthly.test.ts
git commit -m "refactor(progression): remove spawnIndexCurrentMonth from monthly reset"
```

---

- [ ] Task 10: Update all test mock states

**Files:**
- Modify: `test/store/store.test.ts`
- Modify: `test/ui/useWatcher.test.ts`
- Modify: `test/sidecar/render-data.test.ts`
- Modify: `test/sidecar/render-data-egg.test.ts`
- Modify: `test/sidecar/render-data-design.test.ts`
- Modify: `test/sidecar/render-data-generation.test.ts`
- Modify: `test/sidecar/prng-parity.test.ts`
- Modify: `test/generation/cli.test.ts`

**Step 1: Remove calibration from all mock state objects**

In every test file that creates a mock `AppState`, remove:
- `calibration: { t0: ..., monthlyEstimate: ..., calibratedAt: ... }`
- `spawnIndexCurrentMonth: 0`

**Step 2: Remove `runCalibration` mock from useWatcher test**

In `test/ui/useWatcher.test.ts`, remove the mock for `runCalibration` (line 15) and any assertions about calibration.

**Step 3: Fix store.test.ts migration test**

In `test/store/store.test.ts`, update the v1→v2 migration test:
- Remove calibration from v1 mock (or verify it's ignored)
- Remove assertions about `calibration` in migrated state
- Update `requiredTokens` assertion to expect `TOKENS_PER_PET` (1,000,000,000)

**Step 4: Fix `createInitialState` test**

Update calls from `createInitialState(5000)` → `createInitialState()`.

**Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add test/
git commit -m "test: update mock states to remove calibration fields"
```

---

- [ ] Task 11: Typecheck, build, and full verification

**Files:**
- No new files.

**Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Full test suite**

Run: `npx vitest run`
Expected: All tests PASS

**Step 3: Build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Final commit (if any tweaks)**

```bash
git add -A
git commit -m "refactor: complete calibration system removal, fixed TOKENS_PER_PET"
```

---

## Files Changed Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/config/constants.ts` | Modify | Add `TOKENS_PER_PET`, remove `GROWTH_MULTIPLIER` |
| `src/progression/engine.ts` | Modify | Simplify `advancePet()` to 2 params |
| `src/progression/calibration.ts` | Delete | Entire calibration logic |
| `src/progression/types.ts` | Modify | Remove `CalibrationInput`, `CalibrationResult` |
| `src/progression/index.ts` | Modify | Remove `computeCalibration` export |
| `src/progression/monthly.ts` | Modify | Remove `spawnIndexCurrentMonth` reset |
| `src/store/types.ts` | Modify | Remove `Calibration`, `calibration`, `spawnIndexCurrentMonth` |
| `src/store/store.ts` | Modify | Remove calibration from state init/migration |
| `src/index.ts` | Modify | Remove `runCalibration`, simplify `runProgression` |
| `src/config/schema.ts` | Modify | Remove `growth` config block |
| `bin/tomotoken.ts` | Modify | Remove `recalibrate` command |
| `src/ui/hooks/useWatcher.ts` | Modify | Remove recalibration cycle |
| `src/ui/components/StatsPanel.tsx` | Modify | Remove calibration display |
| `test/progression/calibration.test.ts` | Delete | Tests for deleted module |
| `test/progression/engine.test.ts` | Rewrite | Test simplified `advancePet` |
| `test/progression/monthly.test.ts` | Modify | Remove spawnIndex assertions |
| 6 test files (sidecar, generation, store, ui) | Modify | Remove calibration from mock states |
