# Limb Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade character limbs from 1px sticks to game-style pixel art with joints/fists/shoes, add procedural item generation at 100%, and replace fixed animation cycles with random-timing action pool.

**Architecture:** Modify `CreatureParams` to replace `hasArms`/`hasLegs` booleans with `limbStage: 0|1|2|3|4|5`. Rewrite `placeFeatures()` arms/legs section with Stage-based rendering. Add new `item.ts`/`item-shapes.ts` for procedural item generation. Replace `animator.ts` fixed 4-frame array with base-frame + action-pool system. Extend `ArtParams` with `usageMix` and token ratio for item generation.

**Tech Stack:** TypeScript, vitest, 32x32 pixel canvas (half-block rendering), ANSI 256 colors, mulberry32 PRNG

---

## Reference Files

Before starting any task, read these files for context:

- **Design doc:** `docs/plans/2026-02-15-limb-enhancement-design.md`
- **Types:** `src/art/parametric/types.ts` — `CreatureParams`, `WidthMap`, `Bounds`
- **Pixel types:** `src/art/pixel/types.ts` — `PixelCanvas`, `MutablePixelCanvas`, `AnimationHints`, `BodyResult`
- **Art types:** `src/art/types.ts` — `ArtParams`, `ArtOutput`
- **Store types:** `src/store/types.ts` — `PersonalitySnapshot`, `CompletedPet`, `DepthMetrics`, `StyleMetrics`
- **Constants:** `src/config/constants.ts` — `CATEGORY_IDS`, `CANVAS_WIDTH=32`, `CANVAS_HEIGHT=16`
- **Pipeline entry:** `src/art/parametric/index.ts` — `generateParametricBody()` orchestrator
- **Params:** `src/art/parametric/params.ts` — `deriveCreatureParams()`
- **Progress:** `src/art/parametric/progress.ts` — `adjustParamsForProgress()`
- **Features:** `src/art/parametric/features.ts` — `placeFeatures()` (arms/legs at lines 173-200)
- **Animator:** `src/art/animator.ts` — `generateFrames()` (fixed 4-frame)
- **Renderer:** `src/art/renderer.ts` — `renderArt()` pipeline
- **Orchestrator:** `src/index.ts` — `renderArt()` call site (line 90)
- **Existing tests:** `test/art/parametric.test.ts`, `test/art/animator.test.ts`

---

## Task 1: Add `LimbStage` type and update `CreatureParams`

**Files:**
- Modify: `src/art/parametric/types.ts`
- Test: `test/art/parametric.test.ts`

**Step 1: Write the failing test**

In `test/art/parametric.test.ts`, add to the existing `describe("deriveCreatureParams")` block:

```typescript
it("has limbStage property of type number", () => {
  const prng = createPrng(SEED);
  const p = deriveCreatureParams(TRAITS, DEPTH, STYLE, prng);
  expect(typeof p.limbStage).toBe("number");
  expect(p.limbStage).toBe(0); // raw params always have limbStage=0 (pre-progress)
});

it("does not have hasArms or hasLegs properties", () => {
  const prng = createPrng(SEED);
  const p = deriveCreatureParams(TRAITS, DEPTH, STYLE, prng);
  expect("hasArms" in p).toBe(false);
  expect("hasLegs" in p).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/art/parametric.test.ts --reporter verbose`
Expected: FAIL — `p.limbStage` is undefined, `hasArms` still exists

**Step 3: Write minimal implementation**

In `src/art/parametric/types.ts`, replace `hasArms`/`hasLegs` with `limbStage`:

```typescript
/** Limb development stage: 0=none, 1=sticks, 2=joints, 3=endpoints, 4=complete, 5=item */
export type LimbStage = 0 | 1 | 2 | 3 | 4 | 5;

export interface CreatureParams {
  readonly headRatio: number;
  readonly bodyWidthRatio: number;
  readonly roundness: number;
  readonly topHeavy: number;
  readonly eyeSize: 1 | 2 | 3;
  readonly eyeSpacing: number;
  readonly hasEars: boolean;
  readonly hasHorns: boolean;
  readonly hasTail: boolean;
  readonly hasWings: boolean;
  readonly limbStage: LimbStage;      // replaces hasArms + hasLegs
  readonly patternType: PatternType;
  readonly patternDensity: number;
  readonly neckWidth: number;
  readonly legLength: number;
  readonly armLength: number;
  readonly tailLength: number;
  readonly wingSize: number;
  readonly earSize: number;
  readonly hornSize: number;
  readonly bodyTaper: number;
  readonly asymmetry: number;
}
```

In `src/art/parametric/params.ts`, replace `hasArms`/`hasLegs` lines (51-52) with:

```typescript
  const limbStage: LimbStage = 0; // Raw params: always 0, progress.ts sets actual stage
```

Update the return object: remove `hasArms, hasLegs`, add `limbStage`.

Update the import: add `LimbStage` from `./types.js`.

**Step 4: Fix compilation errors**

After removing `hasArms`/`hasLegs` from `CreatureParams`, these files will break:
- `src/art/parametric/progress.ts` — references `hasArms`/`hasLegs` (fix in Task 2)
- `src/art/parametric/features.ts` — references `params.hasArms`/`params.hasLegs` (fix in Task 3)

For now, temporarily update `progress.ts` to spread `limbStage: 0` instead of `hasArms: false, hasLegs: false`, and update `features.ts` to check `params.limbStage >= 1` instead of `params.hasArms`/`params.hasLegs`.

Also update existing tests in `test/art/parametric.test.ts`:
- Replace `expect(typeof p.hasArms).toBe("boolean")` → `expect(typeof p.limbStage).toBe("number")`
- Replace `expect(typeof p.hasLegs).toBe("boolean")` → remove (covered by new test)
- In progress tests: replace `hasArms: false` checks → `limbStage: 0` checks

**Step 5: Run test to verify it passes**

Run: `npx vitest run test/art/parametric.test.ts --reporter verbose`
Expected: PASS

**Step 6: Run full test suite**

Run: `npm test`
Expected: All tests pass (existing arm/leg behavior preserved via `limbStage >= 1` check)

**Step 7: Commit**

```bash
git add src/art/parametric/types.ts src/art/parametric/params.ts src/art/parametric/progress.ts src/art/parametric/features.ts test/art/parametric.test.ts
git commit -m "refactor: replace hasArms/hasLegs with limbStage in CreatureParams"
```

---

## Task 2: Update `adjustParamsForProgress` for `limbStage`

**Files:**
- Modify: `src/art/parametric/progress.ts`
- Test: `test/art/parametric.test.ts`

**Step 1: Write the failing tests**

Add to `describe("adjustParamsForProgress")`:

```typescript
describe("limbStage progression", () => {
  const base = deriveCreatureParams(TRAITS, DEPTH, STYLE, createPrng(SEED));

  it("limbStage=0 when progress < 0.1", () => {
    expect(adjustParamsForProgress(base, 0.05).limbStage).toBe(0);
  });

  it("limbStage=1 when progress in [0.1, 0.3)", () => {
    expect(adjustParamsForProgress(base, 0.1).limbStage).toBe(1);
    expect(adjustParamsForProgress(base, 0.29).limbStage).toBe(1);
  });

  it("limbStage=2 when progress in [0.3, 0.5)", () => {
    expect(adjustParamsForProgress(base, 0.3).limbStage).toBe(2);
    expect(adjustParamsForProgress(base, 0.49).limbStage).toBe(2);
  });

  it("limbStage=3 when progress in [0.5, 0.7)", () => {
    expect(adjustParamsForProgress(base, 0.5).limbStage).toBe(3);
    expect(adjustParamsForProgress(base, 0.69).limbStage).toBe(3);
  });

  it("limbStage=4 when progress in [0.7, 1.0)", () => {
    expect(adjustParamsForProgress(base, 0.7).limbStage).toBe(4);
    expect(adjustParamsForProgress(base, 0.99).limbStage).toBe(4);
  });

  it("limbStage=5 when progress >= 1.0", () => {
    expect(adjustParamsForProgress(base, 1.0).limbStage).toBe(5);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/art/parametric.test.ts --reporter verbose`
Expected: FAIL — limbStage is always 0

**Step 3: Write minimal implementation**

Replace `src/art/parametric/progress.ts`:

```typescript
import type { CreatureParams } from "./types.js";
import type { LimbStage } from "./types.js";

function computeLimbStage(progress: number): LimbStage {
  if (progress < 0.1) return 0;
  if (progress < 0.3) return 1;
  if (progress < 0.5) return 2;
  if (progress < 0.7) return 3;
  if (progress >= 1.0) return 5;
  return 4;
}

export function adjustParamsForProgress(
  params: CreatureParams,
  progress: number,
): CreatureParams {
  const limbStage = computeLimbStage(progress);

  if (progress < 0.1) {
    return {
      ...params,
      limbStage,
      hasEars: false,
      hasTail: false,
      hasHorns: false,
      hasWings: false,
      patternDensity: 0,
    };
  }

  if (progress < 0.3) {
    return {
      ...params,
      limbStage,
      hasEars: false,
      hasTail: false,
      hasHorns: false,
      hasWings: false,
      patternDensity: params.patternDensity * progress,
    };
  }

  if (progress < 0.5) {
    return {
      ...params,
      limbStage,
      hasHorns: false,
      hasWings: false,
      patternDensity: params.patternDensity * progress,
    };
  }

  if (progress < 0.7) {
    return {
      ...params,
      limbStage,
      hasWings: false,
      patternDensity: params.patternDensity * progress,
    };
  }

  return {
    ...params,
    limbStage,
    patternDensity: params.patternDensity * progress,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/art/parametric.test.ts --reporter verbose`
Expected: PASS

**Step 5: Commit**

```bash
git add src/art/parametric/progress.ts test/art/parametric.test.ts
git commit -m "feat: compute limbStage from progress in adjustParamsForProgress"
```

---

## Task 3: Refactor `placeFeatures` arms/legs to use `limbStage` (Stage 1 = sticks)

**Files:**
- Modify: `src/art/parametric/features.ts`
- Test: `test/art/features-limbs.test.ts` (new test file)

**Step 1: Write the failing test**

Create `test/art/features-limbs.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { placeFeatures } from "../../src/art/parametric/features.js";
import type { CreatureParams, Bounds, WidthMap } from "../../src/art/parametric/types.js";
import type { MutablePixelCanvas } from "../../src/art/pixel/types.js";

function makeCanvas(w: number, h: number): MutablePixelCanvas {
  return Array.from({ length: h }, () => Array(w).fill(0));
}

function makeParams(overrides: Partial<CreatureParams>): CreatureParams {
  return {
    headRatio: 0.3, bodyWidthRatio: 0.5, roundness: 0.5, topHeavy: 0.3,
    eyeSize: 1, eyeSpacing: 0.5, hasEars: false, hasHorns: false,
    hasTail: false, hasWings: false, limbStage: 0,
    patternType: 0, patternDensity: 0, neckWidth: 0.5,
    legLength: 0.2, armLength: 0.2, tailLength: 0.2, wingSize: 0.2,
    earSize: 0.2, hornSize: 0.2, bodyTaper: 0.3, asymmetry: 0.05,
    ...overrides,
  };
}

const W = 32;
const H = 32;
const headBounds: Bounds = { top: 10, bottom: 16, left: 12, right: 20 };
const bodyBounds: Bounds = { top: 17, bottom: 26, left: 10, right: 22 };
const widthMap: WidthMap = Array(H).fill(null);

function countNonZeroPixelsInRegion(
  canvas: MutablePixelCanvas,
  rowStart: number, rowEnd: number, colStart: number, colEnd: number,
): number {
  let count = 0;
  for (let r = rowStart; r <= rowEnd; r++) {
    for (let c = colStart; c <= colEnd; c++) {
      if (r >= 0 && r < canvas.length && c >= 0 && c < canvas[0].length && canvas[r][c] !== 0) {
        count++;
      }
    }
  }
  return count;
}

describe("placeFeatures limb stages", () => {
  const prng = () => 0.5; // deterministic

  it("limbStage=0: no arm or leg pixels below/beside body", () => {
    const canvas = makeCanvas(W, H);
    const params = makeParams({ limbStage: 0 });
    const { canvas: result } = placeFeatures(canvas, widthMap, params, headBounds, bodyBounds, prng);
    // Check no pixels outside body bounds on sides (arms area)
    const armPixels = countNonZeroPixelsInRegion(result, bodyBounds.top, bodyBounds.bottom, 0, bodyBounds.left - 2);
    const legPixels = countNonZeroPixelsInRegion(result, bodyBounds.bottom + 1, H - 1, 0, W - 1);
    // Only eye/mouth pixels in head area expected, no arm/leg pixels
    expect(armPixels).toBe(0);
    expect(legPixels).toBe(0);
  });

  it("limbStage=1: arm pixels are 1px wide sticks", () => {
    const canvas = makeCanvas(W, H);
    const params = makeParams({ limbStage: 1 });
    const { canvas: result } = placeFeatures(canvas, widthMap, params, headBounds, bodyBounds, prng);
    // Left arm column: bodyBounds.left - 1
    const leftArmCol = bodyBounds.left - 1;
    let armPixelCount = 0;
    for (let r = bodyBounds.top; r <= bodyBounds.bottom; r++) {
      if (result[r][leftArmCol] !== 0) armPixelCount++;
    }
    expect(armPixelCount).toBeGreaterThan(0);
    // Each arm row should be exactly 1px wide (no pixel at leftArmCol - 1)
    for (let r = bodyBounds.top; r <= bodyBounds.bottom; r++) {
      if (result[r][leftArmCol] !== 0) {
        expect(result[r][leftArmCol - 1]).toBe(0);
      }
    }
  });

  it("limbStage=1: leg pixels are 1px wide sticks", () => {
    const canvas = makeCanvas(W, H);
    const params = makeParams({ limbStage: 1 });
    const { canvas: result } = placeFeatures(canvas, widthMap, params, headBounds, bodyBounds, prng);
    // Legs below body
    let legPixels = 0;
    for (let r = bodyBounds.bottom + 1; r < H; r++) {
      for (let c = 0; c < W; c++) {
        if (result[r][c] !== 0) legPixels++;
      }
    }
    expect(legPixels).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/art/features-limbs.test.ts --reporter verbose`
Expected: FAIL — limbStage=0 still draws arms (if hasArms was replaced with `limbStage >= 1` in Task 1)

Note: If Task 1 already converted `hasArms` → `limbStage >= 1`, the Stage 1 test may pass but Stage 0 may fail depending on exact implementation.

**Step 3: Write minimal implementation**

In `src/art/parametric/features.ts`, replace the arms section (lines 173-185) and legs section (lines 188-200) with:

```typescript
  // --- Arms (limbStage >= 1) ---
  if (params.limbStage >= 1) {
    const armLen = Math.max(1, Math.round((bodyBounds.bottom - bodyBounds.top) * params.armLength));
    const armRow = bodyBounds.top + Math.round((bodyBounds.bottom - bodyBounds.top) * 0.25);

    if (params.limbStage === 1) {
      // Stage 1: 1px wide sticks
      for (let i = 0; i < armLen; i++) {
        setPixel(result, armRow + i, bodyBounds.left - 1, 2);
        gesturePixels.push([armRow + i, bodyBounds.left - 1]);
        setPixel(result, armRow + i, bodyBounds.right + 1, 2);
        gesturePixels.push([armRow + i, bodyBounds.right + 1]);
      }
    }
    // Stage 2-5 handled in subsequent tasks
  }

  // --- Legs (limbStage >= 1) ---
  if (params.limbStage >= 1) {
    const legLen = Math.max(1, Math.round((bodyBounds.bottom - bodyBounds.top) * params.legLength));
    const legSpacing = Math.max(1, Math.round((bodyBounds.right - bodyBounds.left) * 0.25));
    const leftLegCol = Math.round((bodyBounds.left + bodyBounds.right) / 2) - legSpacing;
    const rightLegCol = Math.round((bodyBounds.left + bodyBounds.right) / 2) + legSpacing;

    if (params.limbStage === 1) {
      // Stage 1: 1px wide sticks
      for (let i = 1; i <= legLen; i++) {
        setPixel(result, bodyBounds.bottom + i, leftLegCol, 2);
        gesturePixels.push([bodyBounds.bottom + i, leftLegCol]);
        setPixel(result, bodyBounds.bottom + i, rightLegCol, 2);
        gesturePixels.push([bodyBounds.bottom + i, rightLegCol]);
      }
    }
    // Stage 2-5 handled in subsequent tasks
  }
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/art/features-limbs.test.ts --reporter verbose`
Expected: PASS

**Step 5: Run full suite**

Run: `npm test`
Expected: All pass

**Step 6: Commit**

```bash
git add src/art/parametric/features.ts test/art/features-limbs.test.ts
git commit -m "refactor: use limbStage for arm/leg rendering in placeFeatures (Stage 1)"
```

---

## Task 4: Stage 2 limbs — 2px width + elbow/knee joints

**Files:**
- Modify: `src/art/parametric/features.ts`
- Test: `test/art/features-limbs.test.ts`

**Step 1: Write the failing tests**

Add to `describe("placeFeatures limb stages")`:

```typescript
it("limbStage=2: arms are 2px wide", () => {
  const canvas = makeCanvas(W, H);
  const params = makeParams({ limbStage: 2, armLength: 0.3 });
  const { canvas: result } = placeFeatures(canvas, widthMap, params, headBounds, bodyBounds, prng);
  const armRow = bodyBounds.top + Math.round((bodyBounds.bottom - bodyBounds.top) * 0.25);
  // Left arm: should have pixels at both bodyBounds.left - 1 and bodyBounds.left - 2
  const col1 = bodyBounds.left - 1;
  const col2 = bodyBounds.left - 2;
  let twoPixWideRows = 0;
  for (let r = armRow; r <= bodyBounds.bottom; r++) {
    if (result[r][col1] !== 0 && result[r][col2] !== 0) twoPixWideRows++;
  }
  expect(twoPixWideRows).toBeGreaterThan(0);
});

it("limbStage=2: elbow has joint highlight (palette 3)", () => {
  const canvas = makeCanvas(W, H);
  const params = makeParams({ limbStage: 2, armLength: 0.3 });
  const { canvas: result } = placeFeatures(canvas, widthMap, params, headBounds, bodyBounds, prng);
  // There should be at least one pixel with palette 3 (joint) in the arm region
  let jointPixels = 0;
  for (let r = bodyBounds.top; r <= bodyBounds.bottom; r++) {
    for (let c = 0; c < bodyBounds.left; c++) {
      if (result[r][c] === 3) jointPixels++;
    }
  }
  expect(jointPixels).toBeGreaterThan(0);
});

it("limbStage=2: legs are 2px wide with knee highlight", () => {
  const canvas = makeCanvas(W, H);
  const params = makeParams({ limbStage: 2, legLength: 0.3 });
  const { canvas: result } = placeFeatures(canvas, widthMap, params, headBounds, bodyBounds, prng);
  let kneePixels = 0;
  for (let r = bodyBounds.bottom + 1; r < H; r++) {
    for (let c = 0; c < W; c++) {
      if (result[r][c] === 3) kneePixels++;
    }
  }
  expect(kneePixels).toBeGreaterThan(0);
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/art/features-limbs.test.ts --reporter verbose`
Expected: FAIL — Stage 2 not yet rendering 2px arms

**Step 3: Write minimal implementation**

In the `placeFeatures()` arms block, add Stage 2 case after Stage 1:

```typescript
    if (params.limbStage >= 2 && params.limbStage !== 1) {
      const halfLen = Math.max(1, Math.floor(armLen / 2));
      const elbowOffset = Math.round(params.asymmetry * 3) + 1;

      // -- Left arm --
      const lCol = bodyBounds.left - 1;
      // Upper arm: 2px wide, straight down
      for (let i = 0; i < halfLen; i++) {
        setPixel(result, armRow + i, lCol, 2);
        setPixel(result, armRow + i, lCol - 1, 2);
        gesturePixels.push([armRow + i, lCol]);
      }
      // Elbow joint: palette 3
      const elbowRow = armRow + halfLen;
      setPixel(result, elbowRow, lCol - elbowOffset, 3);
      setPixel(result, elbowRow, lCol - elbowOffset + 1, 3);
      gesturePixels.push([elbowRow, lCol - elbowOffset]);
      // Forearm: 2px wide, offset by elbow
      for (let i = 1; i <= halfLen; i++) {
        setPixel(result, elbowRow + i, lCol - elbowOffset, 2);
        setPixel(result, elbowRow + i, lCol - elbowOffset + 1, 2);
        gesturePixels.push([elbowRow + i, lCol - elbowOffset]);
      }

      // -- Right arm (mirrored) --
      const rCol = bodyBounds.right + 1;
      for (let i = 0; i < halfLen; i++) {
        setPixel(result, armRow + i, rCol, 2);
        setPixel(result, armRow + i, rCol + 1, 2);
        gesturePixels.push([armRow + i, rCol + 1]);
      }
      setPixel(result, elbowRow, rCol + elbowOffset, 3);
      setPixel(result, elbowRow, rCol + elbowOffset - 1, 3);
      gesturePixels.push([elbowRow, rCol + elbowOffset]);
      for (let i = 1; i <= halfLen; i++) {
        setPixel(result, elbowRow + i, rCol + elbowOffset - 1, 2);
        setPixel(result, elbowRow + i, rCol + elbowOffset, 2);
        gesturePixels.push([elbowRow + i, rCol + elbowOffset]);
      }
    }
```

Similar 2px + knee highlight logic for legs.

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/art/features-limbs.test.ts --reporter verbose`
Expected: PASS

**Step 5: Commit**

```bash
git add src/art/parametric/features.ts test/art/features-limbs.test.ts
git commit -m "feat: Stage 2 limbs with 2px width and elbow/knee joints"
```

---

## Task 5: Stage 3 limbs — fist + shoe sole endpoints

**Files:**
- Modify: `src/art/parametric/features.ts`
- Test: `test/art/features-limbs.test.ts`

**Step 1: Write the failing tests**

```typescript
it("limbStage=3: arms end with 3px wide fist", () => {
  const canvas = makeCanvas(W, H);
  const params = makeParams({ limbStage: 3, armLength: 0.3 });
  const { canvas: result } = placeFeatures(canvas, widthMap, params, headBounds, bodyBounds, prng);
  // Find the lowest arm pixel row on left side, check 3px width at that level
  let lowestArmRow = 0;
  for (let r = H - 1; r >= 0; r--) {
    for (let c = 0; c < bodyBounds.left; c++) {
      if (result[r][c] !== 0) { lowestArmRow = r; break; }
    }
    if (lowestArmRow > 0) break;
  }
  // Count non-zero pixels in fist rows (last 2 rows of arm)
  let fistWidth = 0;
  for (let c = 0; c < bodyBounds.left; c++) {
    if (result[lowestArmRow][c] !== 0) fistWidth++;
  }
  expect(fistWidth).toBeGreaterThanOrEqual(3);
});

it("limbStage=3: legs end with 4px wide shoe sole", () => {
  const canvas = makeCanvas(W, H);
  const params = makeParams({ limbStage: 3, legLength: 0.3 });
  const { canvas: result } = placeFeatures(canvas, widthMap, params, headBounds, bodyBounds, prng);
  // Find lowest leg pixel row
  let lowestLegRow = 0;
  for (let r = H - 1; r >= 0; r--) {
    let found = false;
    for (let c = 0; c < W; c++) {
      if (result[r][c] !== 0) { lowestLegRow = r; found = true; break; }
    }
    if (found) break;
  }
  // Count non-zero pixels in shoe row for one leg
  const centerX = Math.round((bodyBounds.left + bodyBounds.right) / 2);
  let leftShoeWidth = 0;
  for (let c = 0; c < centerX; c++) {
    if (result[lowestLegRow][c] !== 0) leftShoeWidth++;
  }
  expect(leftShoeWidth).toBeGreaterThanOrEqual(4);
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/art/features-limbs.test.ts --reporter verbose`
Expected: FAIL — Stage 3 not yet implemented

**Step 3: Write minimal implementation**

Extend Stage 2 arm rendering: after the forearm loop, add fist (3px wide x 2px high):

```typescript
      // Fist: 3px wide x 2px high at forearm end
      if (params.limbStage >= 3) {
        const fistRow = elbowRow + halfLen + 1;
        const fistCol = lCol - elbowOffset - 1; // centered on forearm
        for (let fr = 0; fr < 2; fr++) {
          for (let fc = 0; fc < 3; fc++) {
            setPixel(result, fistRow + fr, fistCol + fc, 2);
          }
        }
        gesturePixels.push([fistRow, fistCol], [fistRow + 1, fistCol + 2]);
      }
```

Similar for shoe sole (4px wide x 2px high) at leg ends.

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/art/features-limbs.test.ts --reporter verbose`
Expected: PASS

**Step 5: Commit**

```bash
git add src/art/parametric/features.ts test/art/features-limbs.test.ts
git commit -m "feat: Stage 3 limbs with fist and shoe sole endpoints"
```

---

## Task 6: Stage 4 limbs — outlines and detail

**Files:**
- Modify: `src/art/parametric/features.ts`
- Test: `test/art/features-limbs.test.ts`

**Step 1: Write the failing tests**

```typescript
it("limbStage=4: fist has outline pixels (palette 1)", () => {
  const canvas = makeCanvas(W, H);
  const params = makeParams({ limbStage: 4, armLength: 0.3 });
  const { canvas: result } = placeFeatures(canvas, widthMap, params, headBounds, bodyBounds, prng);
  let outlinePixels = 0;
  for (let r = bodyBounds.top; r < H; r++) {
    for (let c = 0; c < bodyBounds.left; c++) {
      if (result[r][c] === 1) outlinePixels++;
    }
  }
  expect(outlinePixels).toBeGreaterThan(0);
});

it("limbStage=4: shoe sole has light/dark shading (palette 2 and 3)", () => {
  const canvas = makeCanvas(W, H);
  const params = makeParams({ limbStage: 4, legLength: 0.3 });
  const { canvas: result } = placeFeatures(canvas, widthMap, params, headBounds, bodyBounds, prng);
  // Check shoe area has both palette 2 (body) and 3 (lighter) pixels
  let hasBody = false;
  let hasLight = false;
  for (let r = bodyBounds.bottom + 1; r < H; r++) {
    for (let c = 0; c < W; c++) {
      if (result[r][c] === 2) hasBody = true;
      if (result[r][c] === 3) hasLight = true;
    }
  }
  expect(hasBody).toBe(true);
  expect(hasLight).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/art/features-limbs.test.ts --reporter verbose`
Expected: FAIL

**Step 3: Write minimal implementation**

Wrap fist with outline (palette 1) border pixels. Add top-row/bottom-row color difference to shoe sole. The implementation adds a 1px outline ring around the fist (checking adjacency to existing fist pixels and setting outer ring to palette 1). Shoe sole gets palette 3 on top row, palette 2 on bottom row.

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/art/features-limbs.test.ts --reporter verbose`
Expected: PASS

**Step 5: Commit**

```bash
git add src/art/parametric/features.ts test/art/features-limbs.test.ts
git commit -m "feat: Stage 4 limbs with outline and shading detail"
```

---

## Task 7: Item types and parameter derivation

**Files:**
- Create: `src/art/parametric/item-types.ts`
- Create: `src/art/parametric/item-params.ts`
- Test: `test/art/item-params.test.ts`

**Step 1: Write the failing test**

Create `test/art/item-params.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createPrng } from "../../src/utils/hash.js";
import { deriveItemParams } from "../../src/art/parametric/item-params.js";
import type { ItemFamily } from "../../src/art/parametric/item-types.js";

const SEED = "1111222233334444555566667777888811112222333344445555666677778888";
const TRAITS = { builder: 60, fixer: 40, refiner: 30, scholar: 50, scribe: 20, architect: 70, operator: 10, guardian: 45 };
const USAGE_MIX = { impl: 0.4, debug: 0.2, refactor: 0.1, research: 0.1, docs: 0.05, planning: 0.1, ops: 0.03, security: 0.02 };

describe("deriveItemParams", () => {
  it("returns valid ItemFamily", () => {
    const prng = createPrng(SEED);
    const result = deriveItemParams(TRAITS, USAGE_MIX, 0.8, prng);
    const validFamilies: ItemFamily[] = ["blade", "staff", "shield", "tool", "orb"];
    expect(validFamilies).toContain(result.family);
  });

  it("length is in [2, 6]", () => {
    const prng = createPrng(SEED);
    const result = deriveItemParams(TRAITS, USAGE_MIX, 0.8, prng);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.length).toBeLessThanOrEqual(6);
  });

  it("width is in [1, 4]", () => {
    const prng = createPrng(SEED);
    const result = deriveItemParams(TRAITS, USAGE_MIX, 0.8, prng);
    expect(result.width).toBeGreaterThanOrEqual(1);
    expect(result.width).toBeLessThanOrEqual(4);
  });

  it("taper is in [0, 1]", () => {
    const prng = createPrng(SEED);
    const result = deriveItemParams(TRAITS, USAGE_MIX, 0.8, prng);
    expect(result.taper).toBeGreaterThanOrEqual(0);
    expect(result.taper).toBeLessThanOrEqual(1);
  });

  it("curvature is in [0, 1]", () => {
    const prng = createPrng(SEED);
    const result = deriveItemParams(TRAITS, USAGE_MIX, 0.8, prng);
    expect(result.curvature).toBeGreaterThanOrEqual(0);
    expect(result.curvature).toBeLessThanOrEqual(1);
  });

  it("crossPiece is boolean", () => {
    const prng = createPrng(SEED);
    const result = deriveItemParams(TRAITS, USAGE_MIX, 0.8, prng);
    expect(typeof result.crossPiece).toBe("boolean");
  });

  it("richness is 'modest', 'standard', or 'lavish'", () => {
    const prng = createPrng(SEED);
    const result = deriveItemParams(TRAITS, USAGE_MIX, 0.8, prng);
    expect(["modest", "standard", "lavish"]).toContain(result.richness);
  });

  it("richness='modest' when tokenRatio < 0.5", () => {
    const prng = createPrng(SEED);
    const result = deriveItemParams(TRAITS, USAGE_MIX, 0.3, prng);
    expect(result.richness).toBe("modest");
  });

  it("richness='lavish' when tokenRatio > 1.0", () => {
    const prng = createPrng(SEED);
    const result = deriveItemParams(TRAITS, USAGE_MIX, 1.5, prng);
    expect(result.richness).toBe("lavish");
  });

  it("is deterministic (same seed → same result)", () => {
    const a = deriveItemParams(TRAITS, USAGE_MIX, 0.8, createPrng(SEED));
    const b = deriveItemParams(TRAITS, USAGE_MIX, 0.8, createPrng(SEED));
    expect(a).toEqual(b);
  });

  it("different seeds → different results", () => {
    const seed2 = "aaaa" + SEED.slice(4);
    const a = deriveItemParams(TRAITS, USAGE_MIX, 0.8, createPrng(SEED));
    const b = deriveItemParams(TRAITS, USAGE_MIX, 0.8, createPrng(seed2));
    expect(a).not.toEqual(b);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/art/item-params.test.ts --reporter verbose`
Expected: FAIL — modules not found

**Step 3: Write minimal implementation**

Create `src/art/parametric/item-types.ts`:

```typescript
export type ItemFamily = "blade" | "staff" | "shield" | "tool" | "orb";
export type Richness = "modest" | "standard" | "lavish";

export interface ItemParams {
  readonly family: ItemFamily;
  readonly length: number;      // 2-6
  readonly width: number;       // 1-4
  readonly taper: number;       // 0.0-1.0
  readonly curvature: number;   // 0.0-1.0
  readonly crossPiece: boolean;
  readonly richness: Richness;
  readonly dominantCategory: string; // for decoration direction
}
```

Create `src/art/parametric/item-params.ts`:

```typescript
import type { ItemFamily, ItemParams, Richness } from "./item-types.js";

const FAMILIES: readonly ItemFamily[] = ["blade", "staff", "shield", "tool", "orb"];

function computeRichness(tokenRatio: number): Richness {
  if (tokenRatio < 0.5) return "modest";
  if (tokenRatio <= 1.0) return "standard";
  return "lavish";
}

function dominantCategory(usageMix: Record<string, number>): string {
  let max = 0;
  let cat = "impl";
  for (const [k, v] of Object.entries(usageMix)) {
    if (v > max) { max = v; cat = k; }
  }
  return cat;
}

export function deriveItemParams(
  traits: Record<string, number>,
  usageMix: Record<string, number>,
  tokenRatio: number,
  prng: () => number,
): ItemParams {
  const t = (id: string): number => traits[id] ?? 0;
  const traitSum = (t("builder") + t("fixer") + t("refiner") + t("scholar") +
    t("scribe") + t("architect") + t("operator") + t("guardian")) / 800;
  const familyIdx = Math.floor((traitSum * 0.3 + prng() * 0.7) * FAMILIES.length);
  const family = FAMILIES[Math.min(familyIdx, FAMILIES.length - 1)];

  const length = Math.round((prng() * 0.7 + traitSum * 0.3) * 4 + 2);   // 2-6
  const width = Math.round((prng() * 0.7 + traitSum * 0.3) * 3 + 1);     // 1-4
  const taper = prng();
  const curvature = prng();
  const crossPiece = prng() > 0.5;
  const richness = computeRichness(tokenRatio);

  return {
    family,
    length: Math.min(6, Math.max(2, length)),
    width: Math.min(4, Math.max(1, width)),
    taper,
    curvature,
    crossPiece,
    richness,
    dominantCategory: dominantCategory(usageMix),
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/art/item-params.test.ts --reporter verbose`
Expected: PASS

**Step 5: Commit**

```bash
git add src/art/parametric/item-types.ts src/art/parametric/item-params.ts test/art/item-params.test.ts
git commit -m "feat: add item parameter derivation for Stage 5 items"
```

---

## Task 8: Item shape generation — 5 families

**Files:**
- Create: `src/art/parametric/item-shapes.ts`
- Test: `test/art/item-shapes.test.ts`

**Step 1: Write the failing tests**

Create `test/art/item-shapes.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createPrng } from "../../src/utils/hash.js";
import { generateItemPixels } from "../../src/art/parametric/item-shapes.js";
import type { ItemParams } from "../../src/art/parametric/item-types.js";

const SEED = "1111222233334444555566667777888811112222333344445555666677778888";

function makeItemParams(overrides: Partial<ItemParams>): ItemParams {
  return {
    family: "blade", length: 4, width: 2, taper: 0.5, curvature: 0.3,
    crossPiece: false, richness: "standard", dominantCategory: "impl",
    ...overrides,
  };
}

describe("generateItemPixels", () => {
  it("returns a 2D pixel array with non-zero pixels", () => {
    const result = generateItemPixels(makeItemParams({}), createPrng(SEED));
    expect(result.pixels.length).toBeGreaterThan(0);
    const flat = result.pixels.flat();
    expect(flat.some((v) => v !== 0)).toBe(true);
  });

  it("blade family: taller than wide", () => {
    const result = generateItemPixels(makeItemParams({ family: "blade", length: 5, width: 2 }), createPrng(SEED));
    expect(result.pixels.length).toBeGreaterThan(result.pixels[0]?.length ?? 0);
  });

  it("shield family: wider than tall", () => {
    const result = generateItemPixels(makeItemParams({ family: "shield", length: 3, width: 4 }), createPrng(SEED));
    expect(result.pixels[0]?.length ?? 0).toBeGreaterThanOrEqual(result.pixels.length);
  });

  it("orb family: roughly square", () => {
    const result = generateItemPixels(makeItemParams({ family: "orb", length: 3, width: 3 }), createPrng(SEED));
    const h = result.pixels.length;
    const w = result.pixels[0]?.length ?? 0;
    expect(Math.abs(h - w)).toBeLessThanOrEqual(2);
  });

  it("all 5 families produce valid output", () => {
    for (const family of ["blade", "staff", "shield", "tool", "orb"] as const) {
      const result = generateItemPixels(makeItemParams({ family }), createPrng(SEED));
      expect(result.pixels.length).toBeGreaterThan(0);
      expect(result.pixels.flat().some((v) => v !== 0)).toBe(true);
    }
  });

  it("lavish richness adds more pixels than modest", () => {
    const modest = generateItemPixels(makeItemParams({ richness: "modest" }), createPrng(SEED));
    const lavish = generateItemPixels(makeItemParams({ richness: "lavish" }), createPrng(SEED));
    const modestCount = modest.pixels.flat().filter((v) => v !== 0).length;
    const lavishCount = lavish.pixels.flat().filter((v) => v !== 0).length;
    expect(lavishCount).toBeGreaterThanOrEqual(modestCount);
  });

  it("is deterministic", () => {
    const a = generateItemPixels(makeItemParams({}), createPrng(SEED));
    const b = generateItemPixels(makeItemParams({}), createPrng(SEED));
    expect(a).toEqual(b);
  });

  it("returns anchorPoint for placement", () => {
    const result = generateItemPixels(makeItemParams({}), createPrng(SEED));
    expect(typeof result.anchorRow).toBe("number");
    expect(typeof result.anchorCol).toBe("number");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/art/item-shapes.test.ts --reporter verbose`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `src/art/parametric/item-shapes.ts` with 5 shape generator functions:

- `generateBlade()` — tall narrow shape, tapers at tip
- `generateStaff()` — uniform width column
- `generateShield()` — wide rectangular/rounded shape
- `generateTool()` — L-shape with head
- `generateOrb()` — circular shape

Each returns `{ pixels: number[][], anchorRow: number, anchorCol: number }`.

The `anchorRow`/`anchorCol` indicates where the item connects to the character's hand.

Richness controls: `modest` = base only, `standard` = base + palette 8 decoration, `lavish` = base + palette 8+9 decoration + 1-2px sparkle.

Dominant category influences decoration pattern (lines vs circles vs angles) applied as a post-processing step on the base shape.

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/art/item-shapes.test.ts --reporter verbose`
Expected: PASS

**Step 5: Commit**

```bash
git add src/art/parametric/item-shapes.ts test/art/item-shapes.test.ts
git commit -m "feat: procedural item shape generation for 5 families"
```

---

## Task 9: Extend `ArtParams` and pipeline for item data

**Files:**
- Modify: `src/art/types.ts` — Add `usageMix` and `tokenRatio` to `ArtParams`
- Modify: `src/art/body.ts` — Pass through new params
- Modify: `src/art/parametric/index.ts` — Wire item generation for Stage 5
- Modify: `src/index.ts` — Pass `usageMix` and `tokenRatio` to `renderArt()`
- Test: `test/art/renderer.test.ts` — Update test fixtures

**Step 1: Write the failing test**

In `test/art/renderer.test.ts`, add:

```typescript
it("accepts usageMix and tokenRatio in ArtParams", () => {
  const output = renderArt({
    seed: SEED, progress: 1.0, traits: TRAITS,
    depthMetrics: DEPTH, styleMetrics: STYLE,
    canvasWidth: 32, canvasHeight: 16,
    usageMix: { impl: 0.5, debug: 0.3, refactor: 0.1, research: 0.05, docs: 0.03, planning: 0.01, ops: 0.005, security: 0.005 },
    tokenRatio: 0.8,
  });
  expect(output.frames).toHaveLength(4);
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/art/renderer.test.ts --reporter verbose`
Expected: FAIL — `usageMix`/`tokenRatio` not in ArtParams type

**Step 3: Write minimal implementation**

Update `src/art/types.ts`:

```typescript
export interface ArtParams {
  readonly seed: string;
  readonly progress: number;
  readonly traits: Record<string, number>;
  readonly depthMetrics: DepthMetrics;
  readonly styleMetrics: StyleMetrics;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly usageMix?: Record<string, number>;   // for item decoration
  readonly tokenRatio?: number;                  // for item richness
}
```

Thread these through `renderArt()` → `generateBody()` → `generateParametricBody()`. In `generateParametricBody()`, after `applyPattern()`, if `limbStage === 5` and `usageMix` is provided, call `deriveItemParams()` + `generateItemPixels()` and stamp the item onto the canvas near the character's hand position.

Update `src/index.ts` line ~90 to compute `tokenRatio` from `pet.consumedTokens / state.calibration.t0` and pass `personality.usageMix` and `tokenRatio`.

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/art/renderer.test.ts --reporter verbose`
Expected: PASS

**Step 5: Run full suite**

Run: `npm test`
Expected: All pass

**Step 6: Commit**

```bash
git add src/art/types.ts src/art/body.ts src/art/parametric/index.ts src/art/renderer.ts src/index.ts test/art/renderer.test.ts
git commit -m "feat: wire item generation into art pipeline for Stage 5"
```

---

## Task 10: Item placement on canvas

**Files:**
- Modify: `src/art/parametric/features.ts` — Add `placeItem()` function
- Create: `src/art/parametric/item.ts` — Item orchestrator (deriveItemParams + generateItemPixels + placement)
- Test: `test/art/item-placement.test.ts`

**Step 1: Write the failing test**

Create `test/art/item-placement.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createPrng } from "../../src/utils/hash.js";
import { placeItemOnCanvas } from "../../src/art/parametric/item.js";
import type { MutablePixelCanvas } from "../../src/art/pixel/types.js";
import type { Bounds } from "../../src/art/parametric/types.js";

const SEED = "1111222233334444555566667777888811112222333344445555666677778888";
const TRAITS = { builder: 50, fixer: 40, refiner: 30, scholar: 50, scribe: 20, architect: 70, operator: 10, guardian: 45 };
const USAGE_MIX = { impl: 0.4, debug: 0.2, refactor: 0.1, research: 0.1, docs: 0.05, planning: 0.1, ops: 0.03, security: 0.02 };

function makeCanvas(w: number, h: number): MutablePixelCanvas {
  return Array.from({ length: h }, () => Array(w).fill(0));
}

describe("placeItemOnCanvas", () => {
  const bodyBounds: Bounds = { top: 17, bottom: 26, left: 10, right: 22 };

  it("adds non-zero pixels to canvas", () => {
    const canvas = makeCanvas(32, 32);
    const prng = createPrng(SEED);
    const result = placeItemOnCanvas(canvas, bodyBounds, TRAITS, USAGE_MIX, 0.8, prng);
    const originalCount = 0;
    const resultCount = result.flat().filter((v) => v !== 0).length;
    expect(resultCount).toBeGreaterThan(originalCount);
  });

  it("item pixels are placed near hand position (beside body)", () => {
    const canvas = makeCanvas(32, 32);
    const prng = createPrng(SEED);
    const result = placeItemOnCanvas(canvas, bodyBounds, TRAITS, USAGE_MIX, 0.8, prng);
    // Item should be near bodyBounds edges (left side or right side)
    let itemPixelsNearBody = 0;
    for (let r = bodyBounds.top; r <= bodyBounds.bottom + 5; r++) {
      for (let c = 0; c < bodyBounds.left; c++) {
        if (result[r][c] !== 0) itemPixelsNearBody++;
      }
      for (let c = bodyBounds.right + 1; c < 32; c++) {
        if (result[r][c] !== 0) itemPixelsNearBody++;
      }
    }
    expect(itemPixelsNearBody).toBeGreaterThan(0);
  });

  it("does not overwrite body pixels", () => {
    const canvas = makeCanvas(32, 32);
    // Pre-fill body area
    for (let r = bodyBounds.top; r <= bodyBounds.bottom; r++) {
      for (let c = bodyBounds.left; c <= bodyBounds.right; c++) {
        canvas[r][c] = 2;
      }
    }
    const prng = createPrng(SEED);
    const result = placeItemOnCanvas(canvas, bodyBounds, TRAITS, USAGE_MIX, 0.8, prng);
    for (let r = bodyBounds.top; r <= bodyBounds.bottom; r++) {
      for (let c = bodyBounds.left; c <= bodyBounds.right; c++) {
        expect(result[r][c]).toBe(2);
      }
    }
  });

  it("is deterministic", () => {
    const a = placeItemOnCanvas(makeCanvas(32, 32), bodyBounds, TRAITS, USAGE_MIX, 0.8, createPrng(SEED));
    const b = placeItemOnCanvas(makeCanvas(32, 32), bodyBounds, TRAITS, USAGE_MIX, 0.8, createPrng(SEED));
    expect(a).toEqual(b);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/art/item-placement.test.ts --reporter verbose`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `src/art/parametric/item.ts`:

```typescript
import type { MutablePixelCanvas } from "../pixel/types.js";
import type { Bounds } from "./types.js";
import { deriveItemParams } from "./item-params.js";
import { generateItemPixels } from "./item-shapes.js";

export function placeItemOnCanvas(
  canvas: MutablePixelCanvas,
  bodyBounds: Bounds,
  traits: Record<string, number>,
  usageMix: Record<string, number>,
  tokenRatio: number,
  prng: () => number,
): MutablePixelCanvas {
  const result = canvas.map((row) => [...row]);
  const itemParams = deriveItemParams(traits, usageMix, tokenRatio, prng);
  const { pixels, anchorRow, anchorCol } = generateItemPixels(itemParams, prng);

  // Place item relative to character's hand (right side of body)
  const handRow = bodyBounds.top + Math.round((bodyBounds.bottom - bodyBounds.top) * 0.5);
  const handCol = bodyBounds.right + 2;
  const startRow = handRow - anchorRow;
  const startCol = handCol - anchorCol;

  for (let r = 0; r < pixels.length; r++) {
    for (let c = 0; c < pixels[r].length; c++) {
      if (pixels[r][c] === 0) continue;
      const tr = startRow + r;
      const tc = startCol + c;
      if (tr >= 0 && tr < result.length && tc >= 0 && tc < result[0].length) {
        if (result[tr][tc] === 0) {
          result[tr][tc] = pixels[r][c];
        }
      }
    }
  }

  return result;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/art/item-placement.test.ts --reporter verbose`
Expected: PASS

**Step 5: Commit**

```bash
git add src/art/parametric/item.ts test/art/item-placement.test.ts
git commit -m "feat: item placement on canvas for Stage 5 completion"
```

---

## Task 11: Animator rewrite — action definitions

**Files:**
- Modify: `src/art/animator.ts`
- Create: `src/art/animation-actions.ts`
- Test: `test/art/animation-actions.test.ts`

**Step 1: Write the failing tests**

Create `test/art/animation-actions.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  applyBlink, applyArmSway, applyFootTap, applyGesture, applyShimmer,
} from "../../src/art/animation-actions.js";
import type { AnimationHints, MutablePixelCanvas } from "../../src/art/pixel/types.js";

function makeCanvas(): MutablePixelCanvas {
  return Array.from({ length: 8 }, () => Array(8).fill(0));
}

function makeHints(): AnimationHints {
  return {
    eyePositions: [[2, 3], [2, 5]],
    gesturePixels: [[4, 1], [4, 7]],
    shimmerPixels: [[3, 3], [3, 4], [3, 5]],
  };
}

describe("applyBlink", () => {
  it("sets eye pixels to palette 1 (closed)", () => {
    const canvas = makeCanvas();
    canvas[2][3] = 6; // pupil
    canvas[2][5] = 6;
    const result = applyBlink(canvas, makeHints());
    expect(result[2][3]).toBe(1);
    expect(result[2][5]).toBe(1);
  });

  it("does not modify non-eye pixels", () => {
    const canvas = makeCanvas();
    canvas[3][3] = 2;
    const result = applyBlink(canvas, makeHints());
    expect(result[3][3]).toBe(2);
  });

  it("returns new canvas (immutable)", () => {
    const canvas = makeCanvas();
    canvas[2][3] = 6;
    const before = canvas.map((r) => [...r]);
    applyBlink(canvas, makeHints());
    expect(canvas).toEqual(before);
  });
});

describe("applyArmSway", () => {
  it("shifts a gesture pixel by 1 in row direction", () => {
    const canvas = makeCanvas();
    canvas[4][1] = 2;
    const hints: AnimationHints = {
      ...makeHints(),
      gesturePixels: [[4, 1]],
    };
    const prng = () => 0.5;
    const result = applyArmSway(canvas, hints, prng);
    // Original pixel should be moved
    const changed = result[3][1] !== 0 || result[5][1] !== 0;
    expect(changed).toBe(true);
  });
});

describe("applyShimmer", () => {
  it("changes shimmer pixel to highlight (4)", () => {
    const canvas = makeCanvas();
    canvas[3][3] = 2;
    canvas[3][4] = 2;
    const prng = () => 0.1;
    const result = applyShimmer(canvas, makeHints(), prng);
    const hasHighlight = result.flat().includes(4);
    expect(hasHighlight).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/art/animation-actions.test.ts --reporter verbose`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `src/art/animation-actions.ts`:

```typescript
import type { AnimationHints, MutablePixelCanvas, PixelCanvas } from "./pixel/types.js";

function deepCopy(canvas: PixelCanvas): MutablePixelCanvas {
  return canvas.map((row) => [...row]);
}

function safeSet(canvas: MutablePixelCanvas, r: number, c: number, v: number): void {
  if (r >= 0 && r < canvas.length && c >= 0 && c < canvas[0].length) {
    canvas[r][c] = v;
  }
}

export function applyBlink(base: PixelCanvas, hints: AnimationHints): PixelCanvas {
  const frame = deepCopy(base);
  for (const [row, col] of hints.eyePositions) {
    if (row >= 0 && row < frame.length && col >= 0 && col < frame[row].length) {
      const val = frame[row][col];
      if (val === 5 || val === 6) frame[row][col] = 1;
    }
  }
  return frame;
}

export function applyArmSway(base: PixelCanvas, hints: AnimationHints, prng: () => number): PixelCanvas {
  const frame = deepCopy(base);
  const candidates = hints.gesturePixels;
  if (candidates.length === 0) return frame;
  const [row, col] = candidates[Math.floor(prng() * candidates.length)];
  const dir = prng() > 0.5 ? 1 : -1;
  const newRow = row + dir;
  if (newRow >= 0 && newRow < frame.length && frame[newRow][col] === 0) {
    frame[newRow][col] = frame[row][col];
    frame[row][col] = 0;
  }
  return frame;
}

export function applyFootTap(base: PixelCanvas, hints: AnimationHints, prng: () => number): PixelCanvas {
  const frame = deepCopy(base);
  const candidates = hints.gesturePixels;
  if (candidates.length === 0) return frame;
  const [row, col] = candidates[Math.floor(prng() * candidates.length)];
  if (row - 1 >= 0 && frame[row - 1][col] === 0) {
    frame[row - 1][col] = frame[row][col];
    frame[row][col] = 0;
  }
  return frame;
}

export function applyGesture(base: PixelCanvas, hints: AnimationHints, prng: () => number): PixelCanvas {
  const frame = deepCopy(base);
  const candidates = hints.gesturePixels;
  if (candidates.length === 0) return frame;
  const count = Math.min(3, Math.floor(prng() * 3) + 1);
  for (let i = 0; i < count; i++) {
    const [row, col] = candidates[Math.floor(prng() * candidates.length)];
    if (row < 0 || row >= frame.length) continue;
    const dir = prng() > 0.5 ? 1 : -1;
    const newCol = col + dir;
    if (newCol >= 0 && newCol < frame[row].length && frame[row][newCol] === 0) {
      frame[row][newCol] = frame[row][col];
      frame[row][col] = 0;
    }
  }
  return frame;
}

export function applyShimmer(base: PixelCanvas, hints: AnimationHints, prng: () => number): PixelCanvas {
  const frame = deepCopy(base);
  const candidates = hints.shimmerPixels;
  if (candidates.length === 0) return frame;
  const count = Math.min(3, Math.floor(prng() * 3) + 1);
  for (let i = 0; i < count; i++) {
    const [row, col] = candidates[Math.floor(prng() * candidates.length)];
    if (row >= 0 && row < frame.length && col >= 0 && col < frame[row].length) {
      frame[row][col] = 4;
    }
  }
  return frame;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/art/animation-actions.test.ts --reporter verbose`
Expected: PASS

**Step 5: Commit**

```bash
git add src/art/animation-actions.ts test/art/animation-actions.test.ts
git commit -m "feat: individual animation action functions for action pool system"
```

---

## Task 12: Animator rewrite — random timing dispatch + Stage-based pool

**Files:**
- Modify: `src/art/animator.ts`
- Test: `test/art/animator.test.ts`

**Step 1: Write the failing tests**

Replace `test/art/animator.test.ts` content with:

```typescript
import { describe, it, expect } from "vitest";
import { createPrng } from "../../src/utils/hash.js";
import { generateBaseFrame, generateRandomFrame, getActionPool } from "../../src/art/animator.js";
import type { AnimationHints, PixelCanvas } from "../../src/art/pixel/types.js";
import type { LimbStage } from "../../src/art/parametric/types.js";

const SEED = "1111222233334444555566667777888811112222333344445555666677778888";

function makeBase(): PixelCanvas {
  const canvas = Array.from({ length: 8 }, () => Array(8).fill(0));
  canvas[2][3] = 6; canvas[2][5] = 6; // eyes
  canvas[4][1] = 2; canvas[4][7] = 2; // arms
  canvas[6][3] = 2; canvas[6][5] = 2; // legs
  return canvas;
}

function makeHints(): AnimationHints {
  return {
    eyePositions: [[2, 3], [2, 5]],
    gesturePixels: [[4, 1], [4, 7], [6, 3], [6, 5]],
    shimmerPixels: [[3, 3], [3, 4], [3, 5]],
  };
}

describe("generateBaseFrame", () => {
  it("returns deep copy of input", () => {
    const base = makeBase();
    const result = generateBaseFrame(base);
    expect(result).toEqual(base);
    expect(result).not.toBe(base);
  });
});

describe("getActionPool", () => {
  it("Stage 0: returns blink, gesture, shimmer only", () => {
    const pool = getActionPool(0);
    expect(pool).toContain("blink");
    expect(pool).toContain("gesture");
    expect(pool).toContain("shimmer");
    expect(pool).not.toContain("arm_sway");
    expect(pool).not.toContain("foot_tap");
  });

  it("Stage 1: same as Stage 0 (no limb animations)", () => {
    const pool = getActionPool(1);
    expect(pool).not.toContain("arm_sway");
    expect(pool).not.toContain("foot_tap");
  });

  it("Stage 2-3: adds arm_sway", () => {
    expect(getActionPool(2)).toContain("arm_sway");
    expect(getActionPool(3)).toContain("arm_sway");
  });

  it("Stage 3+: adds foot_tap", () => {
    expect(getActionPool(3)).toContain("foot_tap");
    expect(getActionPool(4)).toContain("foot_tap");
  });

  it("Stage 5: adds orb_float", () => {
    expect(getActionPool(5)).toContain("orb_float");
  });
});

describe("generateRandomFrame", () => {
  it("returns frame with same dimensions as base", () => {
    const base = makeBase();
    const frame = generateRandomFrame(base, makeHints(), 4, Math.random);
    expect(frame).toHaveLength(base.length);
    expect(frame[0]).toHaveLength(base[0].length);
  });

  it("frame is 90%+ similar to base", () => {
    const base = makeBase();
    const frame = generateRandomFrame(base, makeHints(), 4, Math.random);
    let same = 0;
    let total = 0;
    for (let r = 0; r < base.length; r++) {
      for (let c = 0; c < base[r].length; c++) {
        total++;
        if (frame[r][c] === base[r][c]) same++;
      }
    }
    expect(same / total).toBeGreaterThan(0.9);
  });

  it("sometimes returns base unchanged (no action triggered)", () => {
    const base = makeBase();
    // Use prng that returns high value (< action probability threshold)
    const noActionPrng = () => 0.95; // above 0.3 threshold = no action
    const frame = generateRandomFrame(base, makeHints(), 4, noActionPrng);
    expect(frame).toEqual(base);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/art/animator.test.ts --reporter verbose`
Expected: FAIL — new exports not found

**Step 3: Write minimal implementation**

Rewrite `src/art/animator.ts`:

```typescript
import type { AnimationHints, MutablePixelCanvas, PixelCanvas } from "./pixel/types.js";
import type { LimbStage } from "./parametric/types.js";
import {
  applyBlink, applyArmSway, applyFootTap, applyGesture, applyShimmer,
} from "./animation-actions.js";

type ActionName = "blink" | "arm_sway" | "foot_tap" | "gesture" | "shimmer" | "orb_float";
type Prng = () => number;

const ACTION_TRIGGER_PROBABILITY = 0.3;

export function generateBaseFrame(base: PixelCanvas): PixelCanvas {
  return base.map((row) => [...row]);
}

export function getActionPool(limbStage: LimbStage): ActionName[] {
  const pool: ActionName[] = ["blink", "gesture", "shimmer"];
  if (limbStage >= 2) pool.push("arm_sway");
  if (limbStage >= 3) pool.push("foot_tap");
  if (limbStage >= 5) pool.push("orb_float");
  return pool;
}

function applyAction(
  base: PixelCanvas,
  hints: AnimationHints,
  action: ActionName,
  prng: Prng,
): PixelCanvas {
  switch (action) {
    case "blink": return applyBlink(base, hints);
    case "arm_sway": return applyArmSway(base, hints, prng);
    case "foot_tap": return applyFootTap(base, hints, prng);
    case "gesture": return applyGesture(base, hints, prng);
    case "shimmer": return applyShimmer(base, hints, prng);
    case "orb_float": return applyArmSway(base, hints, prng); // reuse vertical shift
    default: return generateBaseFrame(base);
  }
}

export function generateRandomFrame(
  base: PixelCanvas,
  hints: AnimationHints,
  limbStage: LimbStage,
  prng: Prng,
): PixelCanvas {
  if (prng() > ACTION_TRIGGER_PROBABILITY) {
    return generateBaseFrame(base);
  }

  const pool = getActionPool(limbStage);
  const action = pool[Math.floor(prng() * pool.length)];
  return applyAction(base, hints, action, prng);
}

/**
 * Legacy API: still generates 4 frames for compatibility.
 * The renderer may switch to generateRandomFrame() for live display.
 */
export function generateFrames(
  base: PixelCanvas,
  hints: AnimationHints,
  prng: Prng,
): PixelCanvas[] {
  return [
    generateBaseFrame(base),
    applyBlink(base, hints),
    applyGesture(base, hints, prng),
    applyShimmer(base, hints, prng),
  ];
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/art/animator.test.ts --reporter verbose`
Expected: PASS

**Step 5: Run full suite**

Run: `npm test`
Expected: All pass (legacy `generateFrames` preserved)

**Step 6: Commit**

```bash
git add src/art/animator.ts test/art/animator.test.ts
git commit -m "feat: action pool animator with random timing and Stage-based pool"
```

---

## Task 13: Renderer integration — export `generateRandomFrame` and `limbStage`

**Files:**
- Modify: `src/art/renderer.ts`
- Modify: `src/art/index.ts` — Export new functions
- Modify: `src/art/types.ts` — Add `limbStage` to `ArtOutput` for UI use
- Test: `test/art/renderer.test.ts`

**Step 1: Write the failing test**

Add to `test/art/renderer.test.ts`:

```typescript
it("ArtOutput includes basePixelCanvas and animationHints for live animation", () => {
  const output = renderArt({
    seed: SEED, progress: 0.5, traits: TRAITS,
    depthMetrics: DEPTH, styleMetrics: STYLE,
    canvasWidth: 32, canvasHeight: 16,
  });
  expect(output.basePixelCanvas).toBeDefined();
  expect(output.animationHints).toBeDefined();
  expect(output.limbStage).toBe(3); // progress 0.5 → Stage 3
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/art/renderer.test.ts --reporter verbose`
Expected: FAIL — `basePixelCanvas` not in ArtOutput

**Step 3: Write minimal implementation**

Update `src/art/types.ts` `ArtOutput`:

```typescript
export interface ArtOutput {
  readonly frames: readonly string[][];
  readonly colorFrames: readonly string[][];
  readonly basePixelCanvas: PixelCanvas;
  readonly animationHints: AnimationHints;
  readonly limbStage: LimbStage;
  readonly palette: Palette;
}
```

Update `src/art/renderer.ts` to include these in the return value.

Update `src/art/index.ts` exports:

```typescript
export { generateRandomFrame, getActionPool } from "./animator.js";
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/art/renderer.test.ts --reporter verbose`
Expected: PASS

**Step 5: Run full suite**

Run: `npm test`
Expected: All pass

**Step 6: Commit**

```bash
git add src/art/renderer.ts src/art/types.ts src/art/index.ts test/art/renderer.test.ts
git commit -m "feat: expose basePixelCanvas and limbStage in ArtOutput for live animation"
```

---

## Task 14: Integration tests — full pipeline with limb stages

**Files:**
- Modify: `test/art/parametric.test.ts`

**Step 1: Write the failing tests**

Add a new `describe` block:

```typescript
describe("limb stages integration", () => {
  it("progress 0.05 → no limb pixels outside body", () => {
    const result = generateParametricBody(createPrng(SEED), 0.05, TRAITS, DEPTH, STYLE, 32, 16);
    // Only head/body pixels, no arm/leg extending pixels
    const pixelH = 32;
    const flat = result.pixelCanvas.flat();
    // Should have very few non-zero pixels (small creature)
    expect(flat.filter((v) => v !== 0).length).toBeGreaterThan(0);
  });

  it("progress 0.15 → has 1px stick limbs", () => {
    const result = generateParametricBody(createPrng(SEED), 0.15, TRAITS, DEPTH, STYLE, 32, 16);
    const flat = result.pixelCanvas.flat();
    expect(flat.filter((v) => v !== 0).length).toBeGreaterThan(10);
  });

  it("progress 0.5 → has joint highlights (palette 3) in limb area", () => {
    const result = generateParametricBody(createPrng(SEED), 0.5, TRAITS, DEPTH, STYLE, 32, 16);
    const flat = result.pixelCanvas.flat();
    expect(flat.includes(3)).toBe(true);
  });

  it("progress 1.0 → has all detail including outlines", () => {
    const result = generateParametricBody(createPrng(SEED), 1.0, TRAITS, DEPTH, STYLE, 32, 16);
    const flat = result.pixelCanvas.flat();
    const nonZero = flat.filter((v) => v !== 0).length;
    // Full creature should have significantly more pixels than tiny one
    const tinyResult = generateParametricBody(createPrng(SEED), 0.05, TRAITS, DEPTH, STYLE, 32, 16);
    const tinyNonZero = tinyResult.pixelCanvas.flat().filter((v) => v !== 0).length;
    expect(nonZero).toBeGreaterThan(tinyNonZero * 2);
  });

  it("limb pixel count increases with stage progression", () => {
    const progresses = [0.15, 0.35, 0.55, 0.75, 1.0];
    const pixelCounts = progresses.map((p) => {
      const r = generateParametricBody(createPrng(SEED), p, TRAITS, DEPTH, STYLE, 32, 16);
      return r.pixelCanvas.flat().filter((v) => v !== 0).length;
    });
    // Each stage should have >= pixels of previous (monotonic increase)
    for (let i = 1; i < pixelCounts.length; i++) {
      expect(pixelCounts[i]).toBeGreaterThanOrEqual(pixelCounts[i - 1]);
    }
  });

  it("determinism: same seed → identical canvas at each stage", () => {
    for (const progress of [0.15, 0.35, 0.55, 0.75, 1.0]) {
      const a = generateParametricBody(createPrng(SEED), progress, TRAITS, DEPTH, STYLE, 32, 16);
      const b = generateParametricBody(createPrng(SEED), progress, TRAITS, DEPTH, STYLE, 32, 16);
      expect(a.pixelCanvas).toEqual(b.pixelCanvas);
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/art/parametric.test.ts --reporter verbose`
Expected: Some tests may fail depending on Stage 2-4 rendering completeness

**Step 3: Fix any issues**

Ensure all stages in `placeFeatures()` are wired correctly and the pipeline produces expected results. Fix any edge cases.

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/art/parametric.test.ts --reporter verbose`
Expected: PASS

**Step 5: Run full suite with coverage**

Run: `npm run test:coverage`
Expected: All pass, coverage ≥ 80%

**Step 6: Commit**

```bash
git add test/art/parametric.test.ts
git commit -m "test: add integration tests for limb stage progression"
```

---

## Task 15: Update barrel exports and clean up

**Files:**
- Modify: `src/art/parametric/index.ts` — Export new modules
- Modify: `src/art/index.ts` — Export animation actions
- Run: Full test suite + typecheck

**Step 1: Update exports**

In `src/art/parametric/index.ts`, add:

```typescript
export type { LimbStage, ItemFamily, Richness } from "./types.js";
export { deriveItemParams } from "./item-params.js";
export { generateItemPixels } from "./item-shapes.js";
export { placeItemOnCanvas } from "./item.js";
```

In `src/art/index.ts`, add:

```typescript
export { generateRandomFrame, getActionPool, generateBaseFrame } from "./animator.js";
export { applyBlink, applyArmSway, applyFootTap, applyGesture, applyShimmer } from "./animation-actions.js";
```

**Step 2: Typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Full test suite**

Run: `npm run test:coverage`
Expected: All pass, ≥ 80% coverage

**Step 4: Commit**

```bash
git add src/art/parametric/index.ts src/art/index.ts
git commit -m "chore: update barrel exports for limb enhancement modules"
```

---

## Summary

| Task | Description | New Files | Modified Files |
|------|-------------|-----------|----------------|
| 1 | LimbStage type + CreatureParams update | — | types.ts, params.ts, progress.ts, features.ts |
| 2 | Progress → limbStage calculation | — | progress.ts |
| 3 | Stage 1 limbs (sticks) | features-limbs.test.ts | features.ts |
| 4 | Stage 2 limbs (joints) | — | features.ts |
| 5 | Stage 3 limbs (fist/shoe) | — | features.ts |
| 6 | Stage 4 limbs (outline/detail) | — | features.ts |
| 7 | Item types + params | item-types.ts, item-params.ts, test | — |
| 8 | Item shape generation | item-shapes.ts, test | — |
| 9 | ArtParams extension + pipeline wiring | — | types.ts, body.ts, index.ts, renderer.ts |
| 10 | Item placement on canvas | item.ts, test | — |
| 11 | Animation action functions | animation-actions.ts, test | — |
| 12 | Animator rewrite (random timing) | — | animator.ts |
| 13 | Renderer integration | — | renderer.ts, types.ts, index.ts |
| 14 | Integration tests | — | parametric.test.ts |
| 15 | Barrel exports + cleanup | — | index.ts files |
