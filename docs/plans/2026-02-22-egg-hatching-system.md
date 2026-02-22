# Egg Hatching System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace linear pet growth with a 4-stage egg → character hatching system in the 3D viewer, with wobble animation and flash transition reveal.

**Architecture:** Pre-made egg GLB assets (4 crack stages) loaded by progress threshold. Palette colors applied for per-pet uniqueness (speckled/marble pattern). At 100%, loading overlay → Hyper3D generates character → flash → character reveal. Existing 2D ASCII art system removed entirely.

**Tech Stack:** Blender MCP (egg model creation), Three.js (viewer rendering, wobble), CSS (flash transition), Vitest (testing)

---

## Parallelization Map

```
Track A: Backend Types & Stage (Tasks 1-2)  ──────────────────┐
Track B: Egg GLB Assets via Blender (Task 3)                  │
Track C: 2D Art Removal (Tasks 8-9) ─── starts after Task 1   │
                                                               ↓
Track D: Viewer Egg Loading (Tasks 4-5) ─── after A+B ────────┤
Track E: Viewer Wobble Animation (Task 6) ─── after Task 4    │
Track F: Viewer Hatch Transition (Task 7) ─── after Task 4    │
```

**Team assignment suggestion:**
- Teammate 1: Track A → Track D (backend types → viewer egg loading)
- Teammate 2: Track E + F (wobble + hatch transition, after Track D)
- Teammate 3: Track C (2D art removal — independent after Task 1)
- Teammate 4 (or lead): Track B (Blender MCP — interactive, manual)

---

## Task 1: Update Stage Types

**Files:**
- Modify: `src/art/parametric/types.ts:5` — change `LimbStage`
- Modify: `src/art/parametric/progress.ts:3-10` — update `computeLimbStage`
- Test: `test/progression/egg-stages.test.ts` (create)

**Context:** Current `LimbStage` is `0 | 1 | 2 | 3 | 4 | 5` with thresholds at 10%, 30%, 50%, 70%, 100%. New system needs 5 stages: 4 egg stages (0-3) at 25% intervals + hatched (4).

**Step 1: Write the failing test**

```typescript
// test/progression/egg-stages.test.ts
import { describe, it, expect } from "vitest";
import { computeEggStage } from "../../src/progression/stages.js";

describe("computeEggStage", () => {
  it("returns 0 for 0% progress (pristine egg)", () => {
    expect(computeEggStage(0)).toBe(0);
  });

  it("returns 0 for 24% progress", () => {
    expect(computeEggStage(0.24)).toBe(0);
  });

  it("returns 1 for 25% progress (small cracks)", () => {
    expect(computeEggStage(0.25)).toBe(1);
  });

  it("returns 1 for 49% progress", () => {
    expect(computeEggStage(0.49)).toBe(1);
  });

  it("returns 2 for 50% progress (many cracks)", () => {
    expect(computeEggStage(0.50)).toBe(2);
  });

  it("returns 2 for 74% progress", () => {
    expect(computeEggStage(0.74)).toBe(2);
  });

  it("returns 3 for 75% progress (large fractures)", () => {
    expect(computeEggStage(0.75)).toBe(3);
  });

  it("returns 3 for 99% progress", () => {
    expect(computeEggStage(0.99)).toBe(3);
  });

  it("returns 4 for 100% progress (hatched)", () => {
    expect(computeEggStage(1.0)).toBe(4);
  });

  it("clamps negative progress to stage 0", () => {
    expect(computeEggStage(-0.1)).toBe(0);
  });

  it("returns 4 for progress > 1.0", () => {
    expect(computeEggStage(1.5)).toBe(4);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/progression/egg-stages.test.ts`
Expected: FAIL — `computeEggStage` does not exist

**Step 3: Implement**

Create `src/progression/stages.ts`:

```typescript
/**
 * Egg stage based on progress toward hatching.
 * 0 = pristine egg, 1 = small cracks, 2 = many cracks,
 * 3 = large fractures, 4 = hatched (character revealed).
 */
export type EggStage = 0 | 1 | 2 | 3 | 4;

export function computeEggStage(progress: number): EggStage {
  if (progress >= 1.0) return 4;
  if (progress >= 0.75) return 3;
  if (progress >= 0.50) return 2;
  if (progress >= 0.25) return 1;
  return 0;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/progression/egg-stages.test.ts`
Expected: PASS (all 11 tests)

**Step 5: Commit**

```bash
git add src/progression/stages.ts test/progression/egg-stages.test.ts
git commit -m "feat(progression): add egg stage computation with 4-stage thresholds"
```

---

## Task 2: Update PetRenderData & Sidecar

**Files:**
- Modify: `src/art3d/types.ts:18` — change `stage` type from `LimbStage` to `EggStage`
- Modify: `src/sidecar/render-data.ts:5,46` — import/use `computeEggStage`
- Modify: `src/progression/index.ts` — re-export from stages.ts
- Test: `test/sidecar/render-data.test.ts` (create or modify if exists)

**Context:** `PetRenderData.stage` currently uses `LimbStage` (0-5) imported from `src/art/parametric/types.ts`. Switch to `EggStage` (0-4) from `src/progression/stages.ts`. The `creatureParams` field stays for now (will be cleaned up later with 2D removal).

**Step 1: Write the failing test**

```typescript
// test/sidecar/render-data-egg.test.ts
import { describe, it, expect } from "vitest";
import { buildRenderData } from "../../src/sidecar/render-data.js";
import type { AppState } from "../../src/store/types.js";

function makeState(consumedTokens: number, requiredTokens: number): AppState {
  return {
    version: 2,
    calibration: { monthlyEstimate: 100000, t0: 50000 },
    spawnIndexCurrentMonth: 0,
    currentMonth: "2026-02",
    currentPet: {
      petId: "test-pet-id",
      spawnedAt: "2026-02-01T00:00:00Z",
      requiredTokens,
      consumedTokens,
      spawnIndex: 0,
      personalitySnapshot: null,
      generatedDesigns: null,
    },
    ingestionState: { fileOffsets: {}, lastScanTimestamp: null },
    globalStats: { totalTokensAllTime: 100000, earliestTimestamp: "2026-01-01", latestTimestamp: "2026-02-01" },
    lastEncouragementShownAt: null,
  };
}

describe("buildRenderData egg stages", () => {
  it("returns stage 0 at 10% progress", () => {
    const data = buildRenderData(makeState(10000, 100000), "test-seed");
    expect(data.stage).toBe(0);
  });

  it("returns stage 1 at 30% progress", () => {
    const data = buildRenderData(makeState(30000, 100000), "test-seed");
    expect(data.stage).toBe(1);
  });

  it("returns stage 2 at 55% progress", () => {
    const data = buildRenderData(makeState(55000, 100000), "test-seed");
    expect(data.stage).toBe(2);
  });

  it("returns stage 3 at 80% progress", () => {
    const data = buildRenderData(makeState(80000, 100000), "test-seed");
    expect(data.stage).toBe(3);
  });

  it("returns stage 4 at 100% progress", () => {
    const data = buildRenderData(makeState(100000, 100000), "test-seed");
    expect(data.stage).toBe(4);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/sidecar/render-data-egg.test.ts`
Expected: FAIL — stage values don't match new thresholds

**Step 3: Update render-data.ts**

In `src/sidecar/render-data.ts`, change:
```typescript
// Before (line 5):
import { deriveCreatureParams, adjustParamsForProgress, computeLimbStage, paletteToHexArray, generatePalette } from "../art/parametric/index.js";

// After:
import { deriveCreatureParams, adjustParamsForProgress, paletteToHexArray, generatePalette } from "../art/parametric/index.js";
import { computeEggStage } from "../progression/stages.js";
```

In `src/sidecar/render-data.ts`, change line 46:
```typescript
// Before:
const stage = computeLimbStage(progress);
// After:
const stage = computeEggStage(progress);
```

In `src/art3d/types.ts`, change:
```typescript
// Before:
import type { CreatureParams, LimbStage } from "../art/parametric/types.js";
// ...
readonly stage: LimbStage;

// After:
import type { CreatureParams } from "../art/parametric/types.js";
import type { EggStage } from "../progression/stages.js";
// ...
readonly stage: EggStage;
```

In `src/progression/index.ts`, add:
```typescript
export { computeEggStage, type EggStage } from "./stages.js";
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/sidecar/render-data-egg.test.ts`
Expected: PASS

**Step 5: Run full test suite**

Run: `npm test`
Expected: Some existing tests may fail if they reference `LimbStage` or old stage values. Fix any broken imports. The old `computeLimbStage` stays in `progress.ts` for now (will be deleted with 2D removal).

**Step 6: Commit**

```bash
git add src/progression/stages.ts src/progression/index.ts src/art3d/types.ts src/sidecar/render-data.ts test/sidecar/render-data-egg.test.ts
git commit -m "feat(sidecar): switch PetRenderData to egg-based stages"
```

---

## Task 3: Create Egg GLB Assets via Blender MCP

**Files:**
- Create: `src/viewer/public/models/eggs/egg-stage-0.glb`
- Create: `src/viewer/public/models/eggs/egg-stage-1.glb`
- Create: `src/viewer/public/models/eggs/egg-stage-2.glb`
- Create: `src/viewer/public/models/eggs/egg-stage-3.glb`

**Context:** 4 egg models with increasing cracks. Each egg has named meshes for palette coloring: `cr_body_shell` (main egg color) and `cr_accent_spot*` (speckle/marble markings). This task is interactive via Blender MCP — not TDD.

**Mesh naming convention** (for `applyPalette()` in the viewer):
- `cr_body_shell` — primary body color (palette index 0 → hex color)
- `cr_accent_spot1`, `cr_accent_spot2`, ... — accent markings (palette index 6 → accessory color)
- `cr_detail_crack1`, `cr_detail_crack2`, ... — crack edges visible in stages 1-3 (palette index 2 → detail color)

**Egg geometry spec:**
- Base: UV Sphere (32 segments, 24 rings) scaled to (1.0, 1.3, 1.0) — egg shape
- Total size: ~1 unit wide, ~1.3 units tall
- Origin: center-bottom so egg sits on ground plane
- Spots: 5-8 small flattened spheres pressed into surface, randomly distributed
- Cracks (stage 1): 1-2 thin groove meshes on upper half
- Cracks (stage 2): 4-5 grooves covering more surface
- Cracks (stage 3): Wide fracture lines with slight mesh displacement, a chip missing at top

**Blender Python script approach:**

```python
import bpy
import bmesh
import math
import random

def create_egg(stage: int, seed: int = 42):
    random.seed(seed)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()

    # --- Egg shell ---
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=24, radius=0.5)
    egg = bpy.context.active_object
    egg.name = "cr_body_shell"
    egg.scale = (1.0, 1.0, 1.3)
    bpy.ops.object.transform_apply(scale=True)

    # Move origin to bottom
    egg.location.z = 0.65

    # Smooth shading
    bpy.ops.object.shade_smooth()

    # --- Spots (marble/speckle pattern) ---
    num_spots = random.randint(5, 8)
    for i in range(num_spots):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6, radius=0.06 + random.random() * 0.04)
        spot = bpy.context.active_object
        spot.name = f"cr_accent_spot{i+1}"

        # Random position on egg surface
        theta = random.uniform(0, 2 * math.pi)
        phi = random.uniform(0.3, 2.5)  # avoid top/bottom poles
        r = 0.48  # just inside surface
        spot.location = (
            r * math.sin(phi) * math.cos(theta),
            r * math.sin(phi) * math.sin(theta),
            0.65 + r * math.cos(phi)
        )
        spot.scale = (1.0, 1.0, 0.3)  # flatten against surface
        bpy.ops.object.shade_smooth()

    # --- Cracks (stages 1-3 only) ---
    if stage >= 1:
        # Add crack geometry based on stage
        add_cracks(stage)

    # --- Export ---
    bpy.ops.export_scene.gltf(
        filepath=f"/path/to/src/viewer/public/models/eggs/egg-stage-{stage}.glb",
        export_format='GLB',
        use_selection=False,
    )

def add_cracks(stage):
    crack_configs = {
        1: [(0.3, 0.8, 1)],     # 1 small crack on upper half
        2: [(0.2, 0.9, 3)],     # 3 cracks spreading
        3: [(0.1, 1.0, 5)],     # 5 large cracks with gap at top
    }
    # Create thin bezier curves extruded as crack meshes
    # Named "cr_detail_crack1", "cr_detail_crack2", etc.
    # Implementation: thin mesh planes along egg surface
    ...

for stage in range(4):
    create_egg(stage)
```

**Note:** This script is a guide. The actual Blender MCP execution will use `mcp__blender__execute_blender_code` and may need iteration to get the visual quality right. The key requirement is that mesh names follow the `cr_{role}_{part}` convention.

**Verification:**
1. Open each GLB in the viewer or Blender viewport
2. Verify mesh names are correct: `bpy.data.objects` should list `cr_body_shell`, `cr_accent_spot*`, and `cr_detail_crack*`
3. Verify stage progression looks natural (increasing crack severity)

**Commit:**

```bash
git add src/viewer/public/models/eggs/
git commit -m "feat(viewer): add 4 egg GLB models with palette-compatible mesh names"
```

---

## Task 4: Viewer — Egg Model Loading

**Files:**
- Create: `src/viewer/public/js/egg-loader.js`
- Modify: `src/viewer/public/js/app.js:78-112` — use egg loader for stages 0-3
- Test: `test/viewer/egg-loader.test.ts` (create)

**Context:** When `stage < 4`, load the egg GLB for that stage and apply palette. When `stage === 4` (hatched), load the character model as before.

**Step 1: Write the failing test**

```typescript
// test/viewer/egg-loader.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockLoad } = vi.hoisted(() => ({ mockLoad: vi.fn() }));
vi.mock("three/addons/loaders/GLTFLoader.js", () => ({
  GLTFLoader: vi.fn().mockImplementation(() => ({
    load: mockLoad,
  })),
}));

import { loadEggModel, EGG_MODEL_PATH } from "../../src/viewer/public/js/egg-loader.js";

describe("egg-loader", () => {
  beforeEach(() => {
    mockLoad.mockReset();
  });

  describe("EGG_MODEL_PATH", () => {
    it("exports egg model base path", () => {
      expect(EGG_MODEL_PATH).toBe("./models/eggs/");
    });
  });

  describe("loadEggModel", () => {
    it("loads correct GLB for stage 0", async () => {
      const fakeGltf = { scene: { name: "EggScene" }, animations: [] };
      mockLoad.mockImplementation((_url, onLoad) => onLoad(fakeGltf));

      const result = await loadEggModel(0);

      expect(mockLoad.mock.calls[0][0]).toBe("./models/eggs/egg-stage-0.glb");
      expect(result).not.toBeNull();
      expect(result.scene).toBe(fakeGltf.scene);
    });

    it("loads correct GLB for stage 3", async () => {
      const fakeGltf = { scene: { name: "EggScene" }, animations: [] };
      mockLoad.mockImplementation((_url, onLoad) => onLoad(fakeGltf));

      const result = await loadEggModel(3);

      expect(mockLoad.mock.calls[0][0]).toBe("./models/eggs/egg-stage-3.glb");
    });

    it("returns null for stage 4 (hatched — not an egg)", async () => {
      const result = await loadEggModel(4);
      expect(result).toBeNull();
      expect(mockLoad).not.toHaveBeenCalled();
    });

    it("returns null for invalid stage", async () => {
      const result = await loadEggModel(-1);
      expect(result).toBeNull();
    });

    it("returns null when GLB load fails", async () => {
      mockLoad.mockImplementation((_url, _onLoad, _onProg, onError) => {
        onError(new Error("404"));
      });

      const result = await loadEggModel(0);
      expect(result).toBeNull();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/viewer/egg-loader.test.ts`
Expected: FAIL — module does not exist

**Step 3: Implement egg-loader.js**

```javascript
// src/viewer/public/js/egg-loader.js
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export const EGG_MODEL_PATH = "./models/eggs/";

const loader = new GLTFLoader();

/**
 * Load egg GLB model for the given stage (0-3).
 * Returns null for stage >= 4 (hatched) or on load failure.
 */
export async function loadEggModel(stage) {
  if (stage < 0 || stage > 3) return null;

  const url = `${EGG_MODEL_PATH}egg-stage-${stage}.glb`;

  return new Promise((resolve) => {
    loader.load(
      url,
      (gltf) => resolve({ scene: gltf.scene, animations: gltf.animations }),
      undefined,
      () => resolve(null),
    );
  });
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/viewer/egg-loader.test.ts`
Expected: PASS

**Step 5: Update app.js to use egg loader**

Modify `src/viewer/public/js/app.js`:

```javascript
// Add import at top:
import { loadEggModel } from "./egg-loader.js";

// Replace updateCreature function (lines 78-112):
async function updateCreature(data) {
  const { archetype, creatureDesign, palette, stage, petId, progress } = data;

  currentProgress = progress || 0;

  if (petId !== currentPetId || stage !== currentStage) {
    disposeCreature(scene);
    currentDesign = null;
    currentMixer = null;

    let result = null;

    if (stage < 4) {
      // Egg stages 0-3: load egg model
      const eggGltf = await loadEggModel(stage);
      if (eggGltf) {
        const group = eggGltf.scene;
        group.userData.isEgg = true;
        result = { group, parts: {}, mixer: null };
      }
    } else {
      // Hatched (stage 4): load character model
      if (archetype) {
        result = await buildFromModel(archetype, palette);
      }
      if (!result && creatureDesign) {
        result = buildFromDesign(creatureDesign);
        currentDesign = creatureDesign;
      }
    }

    if (result) {
      // Apply palette colors to egg or character
      if (palette && result.group) {
        // applyPalette works on any group with cr_{role}_{part} named meshes
        const { applyPalette } = await import("./palette-apply.js");
        applyPalette(result.group, palette);
      }

      scene.add(result.group);
      currentGroup = result.group;
      currentParts = result.parts;
      currentMixer = result.mixer || null;
      currentPetId = petId;
      currentStage = stage;
    }
  }
}
```

**Step 6: Update STAGE_NAMES in app.js (line 18)**

```javascript
// Before:
const STAGE_NAMES = ["Egg", "Infant", "Child", "Youth", "Complete", "Mastered"];
// After:
const STAGE_NAMES = ["Egg", "Cracking", "Hatching Soon", "Almost There", "Hatched!"];
```

**Step 7: Commit**

```bash
git add src/viewer/public/js/egg-loader.js src/viewer/public/js/app.js test/viewer/egg-loader.test.ts
git commit -m "feat(viewer): load egg GLB models based on progress stage"
```

---

## Task 5: Update Viewer Animation Loop for Eggs

**Files:**
- Modify: `src/viewer/public/js/app.js:137-179` — handle egg in animation loop

**Context:** Eggs don't use AnimationMixer, morph expressions, or legacy animations. The animation loop should skip these when displaying an egg. The wobble animation (Task 6) will be integrated here.

**Step 1: Update animation loop**

In `src/viewer/public/js/app.js`, modify the `animate()` function:

```javascript
function animate() {
  requestAnimationFrame(animate);

  const now = performance.now() / 1000;
  const time = now - clock.startTime;
  const deltaTime = time - clock.lastTime;
  clock.lastTime = time;

  if (currentGroup && currentParts) {
    if (currentGroup.userData?.isEgg) {
      // Egg: wobble animation handled by egg-wobble module (Task 6)
      // No mixer, no expressions
    } else if (currentGroup.userData?.isGltfModel) {
      // glTF character model: animation mixer + morph expressions
      if (currentMixer) {
        currentMixer.update(deltaTime);
      }
      const expr = currentDesign?.expressions
        ? selectExpression(currentDesign.expressions, {
            progress: currentProgress,
            hour: new Date().getHours(),
          })
        : null;
      applyMorphExpression(currentGroup, expr || "default");
    } else if (currentDesign) {
      // LLM-generated: flag-based animation + expressions
      applyAnimations(currentGroup, time);
      if (currentDesign.expressions) {
        const expr = selectExpression(currentDesign.expressions, {
          progress: currentProgress,
          hour: new Date().getHours(),
        });
        if (expr) {
          applyExpression(currentParts, expr);
        }
      }
    }
  }

  composer.render();
}
```

**Step 2: Commit**

```bash
git add src/viewer/public/js/app.js
git commit -m "feat(viewer): skip character animations for egg stage in render loop"
```

---

## Task 6: Viewer — Wobble Animation

**Files:**
- Create: `src/viewer/public/js/egg-wobble.js`
- Modify: `src/viewer/public/js/app.js` — integrate wobble
- Test: `test/viewer/egg-wobble.test.ts` (create)

**Context:** Egg wobbles at random intervals. Frequency increases as progress approaches 100%. Each wobble is a damped Z-axis rotation oscillation (~7° amplitude, ~0.5s duration). Uses real-time `Math.random()` for "organic" timing (not PRNG).

**Step 1: Write the failing test**

```typescript
// test/viewer/egg-wobble.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EggWobbleController } from "../../src/viewer/public/js/egg-wobble.js";

describe("EggWobbleController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("constructs with initial progress", () => {
    const group = { rotation: { z: 0 } };
    const ctrl = new EggWobbleController(group, 0.1);
    expect(ctrl).toBeDefined();
    ctrl.dispose();
  });

  it("does not wobble immediately after construction", () => {
    const group = { rotation: { z: 0 } };
    const ctrl = new EggWobbleController(group, 0.5);
    expect(group.rotation.z).toBe(0);
    ctrl.dispose();
  });

  describe("getNextDelay", () => {
    it("returns longer delays for low progress", () => {
      const group = { rotation: { z: 0 } };
      const ctrl = new EggWobbleController(group, 0.0);
      const delay = ctrl.getNextDelay();
      // At 0% progress: delay should be between 30s and 60s
      expect(delay).toBeGreaterThanOrEqual(30000);
      expect(delay).toBeLessThanOrEqual(60000);
      ctrl.dispose();
    });

    it("returns shorter delays for high progress", () => {
      const group = { rotation: { z: 0 } };
      const ctrl = new EggWobbleController(group, 0.99);
      const delay = ctrl.getNextDelay();
      // At ~100% progress: delay should be between 3s and 8s
      expect(delay).toBeGreaterThanOrEqual(3000);
      expect(delay).toBeLessThanOrEqual(8000);
      ctrl.dispose();
    });
  });

  describe("wobble amplitude", () => {
    it("increases amplitude with progress", () => {
      const ctrl0 = new EggWobbleController({ rotation: { z: 0 } }, 0.0);
      const ctrl99 = new EggWobbleController({ rotation: { z: 0 } }, 0.99);

      expect(ctrl99.getAmplitude()).toBeGreaterThan(ctrl0.getAmplitude());

      ctrl0.dispose();
      ctrl99.dispose();
    });
  });

  it("cleans up timer on dispose", () => {
    const group = { rotation: { z: 0 } };
    const ctrl = new EggWobbleController(group, 0.5);
    ctrl.dispose();
    // After dispose, advancing timers should not cause wobble
    vi.advanceTimersByTime(120000);
    expect(group.rotation.z).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/viewer/egg-wobble.test.ts`
Expected: FAIL — module does not exist

**Step 3: Implement**

```javascript
// src/viewer/public/js/egg-wobble.js

/**
 * Controls random wobble animation for an egg group.
 * Wobble frequency increases as progress approaches 1.0.
 */
export class EggWobbleController {
  constructor(group, progress) {
    this._group = group;
    this._progress = Math.max(0, Math.min(progress, 1));
    this._timerId = null;
    this._animationFrameId = null;
    this._disposed = false;
    this._scheduleNext();
  }

  /** Delay range interpolated by progress: low progress = infrequent, high = frequent */
  getNextDelay() {
    const p = this._progress;
    const minDelay = 30000 - p * 27000;  // 30s → 3s
    const maxDelay = 60000 - p * 52000;  // 60s → 8s
    return minDelay + Math.random() * (maxDelay - minDelay);
  }

  /** Wobble amplitude in radians: increases slightly with progress */
  getAmplitude() {
    return 0.08 + this._progress * 0.06; // ~4.6° to ~8°
  }

  _scheduleNext() {
    if (this._disposed) return;
    this._timerId = setTimeout(() => this._startWobble(), this.getNextDelay());
  }

  _startWobble() {
    if (this._disposed) return;

    const amplitude = this.getAmplitude();
    const duration = 500; // ms
    const startTime = performance.now();
    const originalZ = this._group.rotation.z;

    const animate = (now) => {
      if (this._disposed) return;

      const elapsed = now - startTime;
      if (elapsed >= duration) {
        this._group.rotation.z = originalZ;
        this._scheduleNext();
        return;
      }

      // Damped sine oscillation: 2 full cycles with decay
      const t = elapsed / duration;
      const decay = 1 - t;
      this._group.rotation.z = originalZ + amplitude * Math.sin(t * Math.PI * 4) * decay;
      this._animationFrameId = requestAnimationFrame(animate);
    };

    this._animationFrameId = requestAnimationFrame(animate);
  }

  /** Update progress (e.g., when WebSocket sends new data) */
  updateProgress(progress) {
    this._progress = Math.max(0, Math.min(progress, 1));
  }

  /** Stop all wobble activity and clean up timers */
  dispose() {
    this._disposed = true;
    if (this._timerId != null) {
      clearTimeout(this._timerId);
      this._timerId = null;
    }
    if (this._animationFrameId != null) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/viewer/egg-wobble.test.ts`
Expected: PASS

**Step 5: Integrate into app.js**

Add to `src/viewer/public/js/app.js`:

```javascript
// Add import:
import { EggWobbleController } from "./egg-wobble.js";

// Add state variable after currentProgress:
let currentWobble = null;

// In updateCreature(), after setting up egg result:
if (stage < 4) {
  // ... existing egg loading code ...
  if (result) {
    // Dispose previous wobble controller
    if (currentWobble) {
      currentWobble.dispose();
      currentWobble = null;
    }
    currentWobble = new EggWobbleController(result.group, progress);
  }
} else {
  // Dispose wobble when hatching
  if (currentWobble) {
    currentWobble.dispose();
    currentWobble = null;
  }
}

// In the animation loop, update wobble progress when data changes:
// (Inside the isEgg branch of animate())
if (currentWobble) {
  currentWobble.updateProgress(currentProgress);
}
```

**Step 6: Commit**

```bash
git add src/viewer/public/js/egg-wobble.js test/viewer/egg-wobble.test.ts src/viewer/public/js/app.js
git commit -m "feat(viewer): add wobble animation for egg with progress-based frequency"
```

---

## Task 7: Viewer — Hatch Transition (Flash + Loading)

**Files:**
- Create: `src/viewer/public/js/hatch-transition.js`
- Modify: `src/viewer/public/index.html` — add flash overlay div
- Modify: `src/viewer/public/js/app.js` — trigger transition on hatch
- Test: `test/viewer/hatch-transition.test.ts` (create)

**Context:** When egg reaches 100%, show a loading indicator while Hyper3D generates the character model. Once model is ready, play a white flash → fade-out → character revealed with scale bounce-in.

**Step 1: Write the failing test**

```typescript
// test/viewer/hatch-transition.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock DOM
const mockFlashEl = {
  style: { opacity: "0", transition: "", pointerEvents: "none" },
  offsetHeight: 0, // force reflow mock
};
const mockLoadingEl = {
  style: { display: "none" },
  textContent: "",
};

vi.stubGlobal("document", {
  getElementById: vi.fn((id) => {
    if (id === "hatch-flash") return mockFlashEl;
    if (id === "hatch-loading") return mockLoadingEl;
    return null;
  }),
});

import { showLoading, hideLoading, playFlash } from "../../src/viewer/public/js/hatch-transition.js";

describe("hatch-transition", () => {
  beforeEach(() => {
    mockFlashEl.style.opacity = "0";
    mockFlashEl.style.transition = "";
    mockLoadingEl.style.display = "none";
  });

  describe("showLoading", () => {
    it("makes loading element visible", () => {
      showLoading();
      expect(mockLoadingEl.style.display).toBe("flex");
    });
  });

  describe("hideLoading", () => {
    it("hides loading element", () => {
      showLoading();
      hideLoading();
      expect(mockLoadingEl.style.display).toBe("none");
    });
  });

  describe("playFlash", () => {
    it("sets opacity to 1 for flash-in", async () => {
      const promise = playFlash();
      expect(mockFlashEl.style.opacity).toBe("1");
      // Don't await — just verify initial state
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/viewer/hatch-transition.test.ts`
Expected: FAIL — module does not exist

**Step 3: Implement hatch-transition.js**

```javascript
// src/viewer/public/js/hatch-transition.js

const flashEl = () => document.getElementById("hatch-flash");
const loadingEl = () => document.getElementById("hatch-loading");

/** Show loading indicator during character generation */
export function showLoading() {
  const el = loadingEl();
  if (el) el.style.display = "flex";
}

/** Hide loading indicator */
export function hideLoading() {
  const el = loadingEl();
  if (el) el.style.display = "none";
}

/**
 * Play white flash transition.
 * Call swapCallback during the flash peak to swap models.
 * Returns a Promise that resolves when the full transition completes.
 */
export function playFlash(swapCallback) {
  return new Promise((resolve) => {
    const el = flashEl();
    if (!el) {
      if (swapCallback) swapCallback();
      resolve();
      return;
    }

    // Phase 1: Flash in (fast)
    el.style.transition = "opacity 0.15s ease-in";
    el.style.opacity = "1";

    setTimeout(() => {
      // Phase 2: At peak white — swap the model
      if (swapCallback) swapCallback();

      // Phase 3: Fade out (slow)
      el.style.transition = "opacity 0.8s ease-out";
      el.style.opacity = "0";

      setTimeout(() => {
        resolve();
      }, 850);
    }, 200);
  });
}

/**
 * Animate scale bounce-in for newly hatched character.
 * Scales from 0.5 → 1.1 → 1.0 over ~0.6s.
 */
export function bounceIn(group) {
  if (!group) return;
  group.scale.set(0.5, 0.5, 0.5);

  const duration = 600;
  const startTime = performance.now();

  function animate(now) {
    const elapsed = now - startTime;
    if (elapsed >= duration) {
      group.scale.set(1, 1, 1);
      return;
    }

    const t = elapsed / duration;
    // Overshoot ease: goes to 1.1 then settles to 1.0
    const scale = t < 0.7
      ? 0.5 + (0.6 / 0.7) * t        // 0.5 → 1.1 (first 70%)
      : 1.1 - (0.1 / 0.3) * (t - 0.7); // 1.1 → 1.0 (last 30%)

    group.scale.set(scale, scale, scale);
    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/viewer/hatch-transition.test.ts`
Expected: PASS

**Step 5: Add HTML overlay elements**

In `src/viewer/public/index.html`, add before `</body>`:

```html
<!-- Hatch transition overlay -->
<div id="hatch-flash" style="position:fixed; inset:0; background:white; opacity:0; pointer-events:none; z-index:100;"></div>
<div id="hatch-loading" style="display:none; position:fixed; inset:0; justify-content:center; align-items:center; z-index:50; pointer-events:none;">
  <div style="text-align:center; color:#fff; font-size:14px;">
    <div style="margin-bottom:8px;">Hatching...</div>
    <div style="width:40px; height:40px; border:3px solid rgba(255,255,255,0.3); border-top:3px solid #fff; border-radius:50%; animation:spin 1s linear infinite; margin:0 auto;"></div>
  </div>
</div>
<style>@keyframes spin { to { transform: rotate(360deg); } }</style>
```

**Step 6: Integrate into app.js**

Update `updateCreature()` in `src/viewer/public/js/app.js` to handle hatching:

```javascript
import { showLoading, hideLoading, playFlash, bounceIn } from "./hatch-transition.js";

// In updateCreature, when stage changes to 4 (hatched):
if (stage === 4 && currentStage !== null && currentStage < 4) {
  // Hatching transition!
  showLoading();

  let newResult = null;

  // Load character model (may take time if Hyper3D generation needed)
  if (archetype) {
    newResult = await buildFromModel(archetype, palette);
  }
  if (!newResult && creatureDesign) {
    newResult = buildFromDesign(creatureDesign);
    currentDesign = creatureDesign;
  }

  hideLoading();

  if (newResult) {
    await playFlash(() => {
      // Swap models during flash peak
      disposeCreature(scene);
      scene.add(newResult.group);
      currentGroup = newResult.group;
      currentParts = newResult.parts;
      currentMixer = newResult.mixer || null;
    });
    bounceIn(currentGroup);
  }

  currentPetId = petId;
  currentStage = stage;
  return; // Skip normal rebuild logic
}
```

**Step 7: Commit**

```bash
git add src/viewer/public/js/hatch-transition.js src/viewer/public/index.html src/viewer/public/js/app.js test/viewer/hatch-transition.test.ts
git commit -m "feat(viewer): add flash transition and bounce-in for egg hatching"
```

---

## Task 8: Relocate Shared Modules from 2D Art

**Files:**
- Move: `src/art/parametric/palette.ts` → keep in place (still needed by sidecar)
- Move: `src/art/parametric/progress.ts` → functions replaced by `src/progression/stages.ts`
- Modify: `src/sidecar/render-data.ts` — update imports
- Modify: `src/art3d/types.ts` — update imports
- Modify: `src/art/parametric/index.ts` — remove non-palette exports

**Context:** Before deleting 2D art code, we must ensure shared utilities are accessible. `generatePalette` and `paletteToHexArray` from `palette.ts` are still needed. `computeLimbStage` from `progress.ts` is replaced by `computeEggStage`. `deriveCreatureParams` and `adjustParamsForProgress` from `params.ts` and `progress.ts` are only used for 2D creature rendering — check if sidecar still needs them.

**Step 1: Analyze dependencies**

Check what `buildRenderData` in `render-data.ts` uses:
- `deriveCreatureParams` — generates CreatureParams for the viewer's legacy builder. With egg system, this is only needed for the `creatureParams` field in PetRenderData. If we remove the legacy builder from the viewer, this field becomes unnecessary. **But** removing it would change the PetRenderData contract significantly.

**Decision:** Keep `creatureParams` in PetRenderData for now (backward compat). Move `palette.ts` to `src/palette/` as a standalone module. Keep `deriveCreatureParams` and `adjustParamsForProgress` importable from their current location until the full 2D cleanup.

**Step 2: Create standalone palette module**

Create `src/palette/index.ts`:

```typescript
// Re-export palette functions from their current location
// This provides a stable import path independent of src/art/
export { generatePalette, paletteToHexArray, ansi256ToHex } from "../art/parametric/palette.js";
```

**Step 3: Update sidecar import**

In `src/sidecar/render-data.ts`, update:
```typescript
// Before:
import { deriveCreatureParams, adjustParamsForProgress, computeLimbStage, paletteToHexArray, generatePalette } from "../art/parametric/index.js";

// After:
import { deriveCreatureParams, adjustParamsForProgress } from "../art/parametric/index.js";
import { generatePalette, paletteToHexArray } from "../palette/index.js";
import { computeEggStage } from "../progression/stages.js";
```

**Step 4: Run tests**

Run: `npm test`
Expected: All tests pass (imports reorganized but behavior unchanged)

**Step 5: Commit**

```bash
git add src/palette/index.ts src/sidecar/render-data.ts
git commit -m "refactor: relocate palette module for 2D art removal preparation"
```

---

## Task 9: Remove 2D Art System

**Files to DELETE:**
- `src/art/animation-actions.ts`
- `src/art/animator.ts`
- `src/art/body.ts`
- `src/art/color.ts`
- `src/art/index.ts`
- `src/art/renderer.ts`
- `src/art/seed.ts`
- `src/art/types.ts`
- `src/art/pixel/` (entire directory)
- `src/art/parametric/features.ts`
- `src/art/parametric/index.ts` (will be recreated as minimal re-export)
- `src/art/parametric/item-params.ts`
- `src/art/parametric/item-shapes.ts`
- `src/art/parametric/item-types.ts`
- `src/art/parametric/item.ts`
- `src/art/parametric/pattern.ts`
- `src/art/parametric/rasterize.ts`
- `src/art/parametric/silhouette.ts`
- `src/art/parametric/progress.ts` (replaced by `src/progression/stages.ts`)

**Files to KEEP (in `src/art/parametric/`):**
- `palette.ts` — used by sidecar for color generation
- `params.ts` — used by sidecar for CreatureParams (temporary, can remove later)
- `types.ts` — `CreatureParams` type still referenced by PetRenderData

**Tests to DELETE:**
- `test/art/animation-actions.test.ts`
- `test/art/animator.test.ts`
- `test/art/body.test.ts`
- `test/art/features-limbs.test.ts`
- `test/art/item-params.test.ts`
- `test/art/item-placement.test.ts`
- `test/art/item-shapes.test.ts`
- `test/art/pixel-render.test.ts`
- `test/art/pixel-resolve.test.ts`
- `test/art/renderer.test.ts`
- `test/art/seed.test.ts`
- `test/art/parametric.test.ts`

**Tests to KEEP:**
- `test/art/palette-rgb.test.ts` — tests palette color generation

**Step 1: Search for all imports of deleted modules**

Run: `grep -r "from.*art/" src/ --include="*.ts" | grep -v node_modules | grep -v "art3d" | grep -v "art/parametric/palette" | grep -v "art/parametric/params" | grep -v "art/parametric/types"`

Fix any imports that reference deleted modules.

**Step 2: Recreate minimal `src/art/parametric/index.ts`**

```typescript
// Minimal re-export: only modules that are still needed
export { deriveCreatureParams } from "./params.js";
export { generatePalette, paletteToHexArray } from "./palette.js";
// Note: computeLimbStage and adjustParamsForProgress removed (use src/progression/stages.ts)
```

Check if `adjustParamsForProgress` is still imported anywhere:
- `src/sidecar/render-data.ts` imports it — either keep it or remove the call
- **Decision:** Keep `adjustParamsForProgress` in `params.ts` (or move it there) since it modifies CreatureParams which is still in PetRenderData. Re-export from the new index.

Updated `src/art/parametric/index.ts`:

```typescript
export { deriveCreatureParams } from "./params.js";
export { adjustParamsForProgress } from "./progress.js"; // Keep this function, delete the rest of progress.ts
export { generatePalette, paletteToHexArray } from "./palette.js";
```

Wait — if we delete `progress.ts`, we lose `adjustParamsForProgress`. Move it to `params.ts` first:

```typescript
// Append to src/art/parametric/params.ts:
export function adjustParamsForProgress(params, progress) { ... }
```

Then delete `progress.ts`.

Final `src/art/parametric/index.ts`:

```typescript
export { deriveCreatureParams, adjustParamsForProgress } from "./params.js";
export { generatePalette, paletteToHexArray } from "./palette.js";
```

**Step 3: Delete files**

```bash
# Delete 2D-only source files
rm src/art/animation-actions.ts src/art/animator.ts src/art/body.ts src/art/color.ts
rm src/art/index.ts src/art/renderer.ts src/art/seed.ts src/art/types.ts
rm -rf src/art/pixel/
rm src/art/parametric/features.ts src/art/parametric/item-params.ts
rm src/art/parametric/item-shapes.ts src/art/parametric/item-types.ts
rm src/art/parametric/item.ts src/art/parametric/pattern.ts
rm src/art/parametric/rasterize.ts src/art/parametric/silhouette.ts
rm src/art/parametric/progress.ts

# Delete 2D-only tests
rm test/art/animation-actions.test.ts test/art/animator.test.ts test/art/body.test.ts
rm test/art/features-limbs.test.ts test/art/item-params.test.ts
rm test/art/item-placement.test.ts test/art/item-shapes.test.ts
rm test/art/pixel-render.test.ts test/art/pixel-resolve.test.ts
rm test/art/renderer.test.ts test/art/seed.test.ts test/art/parametric.test.ts
```

**Step 4: Update any remaining imports across the codebase**

Key files to check and fix:
- `src/index.ts` — may import from `src/art/index.ts` for `renderArt`
- `src/store/types.ts` — `CompletedPet.frames` and `colorFrames` fields (keep but they'll be empty arrays)
- Any CLI commands that reference 2D art rendering

**Step 5: Run full test suite**

Run: `npm test`
Expected: All remaining tests pass. Test count will drop (2D tests removed).

**Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: No type errors

**Step 7: Commit**

```bash
git add -A
git commit -m "refactor: remove 2D ASCII art system, keep only 3D rendering pipeline"
```

---

## Task 10: Update Viewer Legacy Code Removal

**Files:**
- Modify: `src/viewer/public/js/creature.js` — remove `buildLegacyCreature` function
- Modify: `src/viewer/public/js/app.js` — remove legacy imports and fallback
- Modify: `src/viewer/public/js/animation.js` — remove `applyLegacyAnimations` if only used by legacy
- Delete tests that only test legacy creature building (keep model loading tests)

**Context:** With 3D-only and the egg system, the legacy PRNG creature builder is no longer needed. The viewer either shows eggs (stages 0-3) or character GLB models (stage 4).

**Step 1: Remove legacy builder from creature.js**

Delete `buildLegacyCreature` function (lines 147-389) and its helper functions that are only used by it.

Keep: `buildFromModel`, `buildFromDesign`, `disposeCreature`, `addOutlines`

**Step 2: Update app.js imports**

```javascript
// Before:
import { buildFromDesign, buildFromModel, buildLegacyCreature, disposeCreature } from "./creature.js";
import { applyAnimations, applyLegacyAnimations } from "./animation.js";

// After:
import { buildFromDesign, buildFromModel, disposeCreature } from "./creature.js";
import { applyAnimations } from "./animation.js";
```

Remove `applyLegacyAnimations` call from animation loop.

**Step 3: Run tests**

Run: `npm test`
Fix any test references to removed functions.

**Step 4: Commit**

```bash
git add src/viewer/public/js/creature.js src/viewer/public/js/app.js src/viewer/public/js/animation.js
git commit -m "refactor(viewer): remove legacy PRNG creature builder"
```

---

## Task 11: Integration Testing & Cleanup

**Files:**
- Modify: `CLAUDE.md` — update architecture docs (remove 2D art references, add egg system)
- Modify: `src/generation/cli.ts:11-18` — update `STAGE_DESCRIPTIONS`

**Step 1: Update STAGE_DESCRIPTIONS in cli.ts**

```typescript
// Before:
const STAGE_DESCRIPTIONS = {
  0: "卵",
  1: "幼体",
  2: "子供",
  3: "青年",
  4: "完成",
  5: "マスター",
};

// After:
const STAGE_DESCRIPTIONS: Record<number, string> = {
  0: "たまご",
  1: "ヒビ入り",
  2: "もうすぐ",
  3: "孵化寸前",
  4: "誕生！",
};
```

**Step 2: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Manual verification checklist**

- [ ] `npm run dev:viewer` → viewer starts on localhost:3456
- [ ] Egg model loads (if GLB assets are present)
- [ ] Stage name displays correctly in info panel
- [ ] Progress bar works
- [ ] Wobble animation fires at random intervals
- [ ] No console errors

**Step 5: Commit**

```bash
git add CLAUDE.md src/generation/cli.ts
git commit -m "docs: update architecture docs and stage descriptions for egg system"
```

---

## Summary

| Task | Track | Depends On | Estimated Scope |
|------|-------|------------|----------------|
| 1. Update Stage Types | A | — | Small |
| 2. Update PetRenderData & Sidecar | A | Task 1 | Small |
| 3. Create Egg GLB Assets (Blender) | B | — | Medium (interactive) |
| 4. Viewer Egg Loading | D | Tasks 1, 3 | Medium |
| 5. Viewer Animation Loop Update | D | Task 4 | Small |
| 6. Viewer Wobble Animation | E | Task 4 | Medium |
| 7. Viewer Hatch Transition | F | Task 4 | Medium |
| 8. Relocate Shared Modules | C | Task 1 | Small |
| 9. Remove 2D Art System | C | Task 8 | Medium |
| 10. Remove Viewer Legacy Code | C | Task 4 | Small |
| 11. Integration & Cleanup | — | All | Small |
