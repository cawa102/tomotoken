# Web App Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove CLI/TUI layer, promote Three.js viewer to main app, add zukan page with card grid and snapshot system.

**Architecture:** Relocate creature parameter code from `src/art/` to `src/creature/`, delete TUI/CLI/ASCII layers, extend viewer server with collection + snapshot APIs, add vanilla JS zukan page.

**Tech Stack:** Express, WebSocket, Three.js, vanilla HTML/JS (no framework)

---

## Phase 1: Relocate creature parameter code

The `src/art/parametric/` directory contains both ASCII-art-only code and code shared with the 3D pipeline. Before deleting `src/art/`, move the shared code to `src/creature/`.

---

- [ ] Task 1: Move creature param types to src/creature/

**Files:**
- Create: `src/creature/types.ts`
- Create: `src/creature/params.ts`
- Create: `src/creature/palette.ts`
- Create: `src/creature/index.ts`
- Modify: `src/art3d/types.ts:1`
- Modify: `src/sidecar/render-data.ts:5`
- Modify: `src/palette/index.ts:1`
- Delete: `src/art/` (entire directory)
- Modify: `test/sidecar/prng-parity.test.ts:4`
- Modify: `test/art/palette-rgb.test.ts` → move to `test/creature/palette-rgb.test.ts`

**Step 1: Create src/creature/ with relocated files**

Copy `src/art/parametric/types.ts` → `src/creature/types.ts` (no changes to content).

Copy `src/art/parametric/params.ts` → `src/creature/params.ts`. Update its import:
```typescript
// Line 1: change
import type { DepthMetrics, StyleMetrics } from "../../store/types.js";
// to
import type { DepthMetrics, StyleMetrics } from "../store/types.js";
```

Copy `src/art/parametric/palette.ts` → `src/creature/palette.ts`. Update its import:
```typescript
// Line 1: change
import type { DepthMetrics, StyleMetrics } from "../../store/types.js";
// to
import type { DepthMetrics, StyleMetrics } from "../store/types.js";

// Line 6: change
import { clamp } from "../../utils/clamp.js";
// to
import { clamp } from "../utils/clamp.js";
```

Create `src/creature/index.ts`:
```typescript
export { deriveCreatureParams, adjustParamsForProgress } from "./params.js";
export { generatePalette, paletteToHexArray, ansi256ToHex } from "./palette.js";
export type { CreatureParams, LimbStage, PatternType, WidthMapEntry, WidthMap, Bounds } from "./types.js";
export type { Palette } from "./palette.js";
```

**Step 2: Update all imports**

`src/art3d/types.ts:1`:
```typescript
// change
import type { CreatureParams } from "../art/parametric/types.js";
// to
import type { CreatureParams } from "../creature/types.js";
```

`src/sidecar/render-data.ts:5`:
```typescript
// change
import { deriveCreatureParams, adjustParamsForProgress } from "../art/parametric/index.js";
// to
import { deriveCreatureParams, adjustParamsForProgress } from "../creature/index.js";
```

`src/palette/index.ts:1`:
```typescript
// change
export { generatePalette, paletteToHexArray, ansi256ToHex } from "../art/parametric/palette.js";
// to
export { generatePalette, paletteToHexArray, ansi256ToHex } from "../creature/palette.js";
```

`test/sidecar/prng-parity.test.ts:4`:
```typescript
// change
import { deriveCreatureParams, adjustParamsForProgress, generatePalette, paletteToHexArray } from "../../src/art/parametric/index.js";
// to
import { deriveCreatureParams, adjustParamsForProgress, generatePalette, paletteToHexArray } from "../../src/creature/index.js";
```

Move `test/art/palette-rgb.test.ts` → `test/creature/palette-rgb.test.ts`. Update import:
```typescript
// change
import { ansi256ToHex, paletteToHexArray, generatePalette, type Palette } from "../../src/art/parametric/palette.js";
// to
import { ansi256ToHex, paletteToHexArray, generatePalette, type Palette } from "../../src/creature/palette.js";
```

**Step 3: Delete src/art/ directory and test/art/ directory**

```bash
rm -rf src/art/ test/art/
```

**Step 4: Run tests to verify**

```bash
npm test
```

Expected: all tests pass (relocated files have identical logic).

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: relocate creature params from src/art/ to src/creature/"
```

---

## Phase 2: Delete CLI/TUI layer

---

- [ ] Task 2: Delete UI, window, encouragement directories

**Files:**
- Delete: `src/ui/` (entire directory, 19 files)
- Delete: `src/window/` (entire directory, 3 files)
- Delete: `src/encouragement/` (entire directory, 4 files)
- Delete: `test/ui/` (entire directory, 4 test files)
- Delete: `test/window/` (entire directory, 2 test files)
- Delete: `test/encouragement/` (entire directory, 2 test files)

**Step 1: Delete directories**

```bash
rm -rf src/ui/ src/window/ src/encouragement/
rm -rf test/ui/ test/window/ test/encouragement/
```

**Step 2: Run tests to verify**

```bash
npm test
```

Expected: remaining tests pass. Deleted tests are gone, no other test imports from deleted dirs.

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: delete TUI, window, and encouragement modules"
```

---

- [ ] Task 3: Remove frames/colorFrames from types and all creation sites

**Files:**
- Modify: `src/store/types.ts:67-68` — remove fields from CompletedPet
- Modify: `src/index.ts:74-75` — remove fields from spread
- Modify: `src/progression/engine.ts:38-39` — remove fields from spread
- Modify: `src/first-run/orchestrate.ts:81-82` — remove fields from spread
- Modify: `test/first-run/detect.test.ts:87-88` — remove fields from test fixture

**Step 1: Write failing test**

Create `test/store/completed-pet-no-frames.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import type { CompletedPet } from "../../src/store/types.js";

describe("CompletedPet type has no frames fields", () => {
  it("does not include frames or colorFrames", () => {
    const pet: CompletedPet = {
      petId: "test",
      spawnedAt: "2026-01-01T00:00:00Z",
      completedAt: "2026-01-02T00:00:00Z",
      requiredTokens: 1_000_000_000,
      consumedTokens: 1_000_000_000,
      spawnIndex: 0,
      personality: {
        usageMix: {},
        depthMetrics: { editTestLoopCount: 0, repeatEditSameFileCount: 0, phaseSwitchCount: 0, totalSessions: 0 },
        styleMetrics: { bulletRatio: 0, questionRatio: 0, codeblockRatio: 0, avgMessageLen: 0, messageLenStd: 0, headingRatio: 0 },
        traits: {},
      },
      seed: "abc",
    };
    expect(pet.petId).toBe("test");
    expect("frames" in pet).toBe(false);
    expect("colorFrames" in pet).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run test/store/completed-pet-no-frames.test.ts
```

Expected: FAIL — `CompletedPet` still requires `frames` and `colorFrames` fields.

**Step 3: Remove fields**

`src/store/types.ts` — remove lines 67-68:
```typescript
// DELETE these two lines from CompletedPet:
  readonly frames: readonly string[][];
  readonly colorFrames: readonly string[][];
```

`src/index.ts` — remove lines 74-75 from the `runProgression` function:
```typescript
// DELETE these two lines from completedWithArt.push():
      frames: [],
      colorFrames: [],
```

`src/progression/engine.ts` — remove lines 38-39:
```typescript
// DELETE these two lines from completed pet object:
        frames: [],
        colorFrames: [],
```

`src/first-run/orchestrate.ts` — remove lines 81-82:
```typescript
// DELETE these two lines from completedPet object:
    frames: [],
    colorFrames: [],
```

`test/first-run/detect.test.ts` — remove lines 87-88:
```typescript
// DELETE these two lines from test fixture:
          frames: [],
          colorFrames: [],
```

Also remove `canvas.frames` from config if it's only used for ASCII art frame count.
Check `src/config/schema.ts:26` — `canvas.frames` controls ASCII frame count. The entire `canvas` config section is ASCII-art-only. Remove the `canvas` block from `ConfigSchema`.

`src/config/constants.ts` — remove `CANVAS_WIDTH`, `CANVAS_HEIGHT`, `FRAME_COUNT` constants if only used by canvas config and ASCII art.

**Step 4: Run tests**

```bash
npx vitest run test/store/completed-pet-no-frames.test.ts
npm test
```

Expected: all pass.

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove frames/colorFrames from CompletedPet and canvas config"
```

---

- [ ] Task 4: Remove CLI dependencies and rewrite entry point

**Files:**
- Modify: `package.json` — remove `ink`, `react`, `@types/react`, `commander`, `chalk`
- Rewrite: `bin/tomotoken.ts` — server-only entry point
- Modify: `src/viewer/server.ts` — integrate startup validation + first-run

**Step 1: Rewrite bin/tomotoken.ts**

Replace entire file with:
```typescript
#!/usr/bin/env node
import { startServer } from "../src/viewer/server.js";

startServer();
```

**Step 2: Refactor src/viewer/server.ts to export startServer**

Add startup validation, first-run handling, and export:
```typescript
import express from "express";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { hostname } from "node:os";
import { runFull } from "../index.js";
import { generateSeed } from "../utils/seed.js";
import { buildRenderData } from "../sidecar/render-data.js";
import { triggerGenerationIfNeeded } from "../sidecar/generation-trigger.js";
import { loadConfig } from "../config/index.js";
import { validateStartup } from "../validation/startup.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rawPort = parseInt(process.env.VIEWER_PORT ?? "3456", 10);
if (Number.isNaN(rawPort) || rawPort < 1 || rawPort > 65535) {
  throw new Error(`Invalid VIEWER_PORT: "${process.env.VIEWER_PORT}". Must be 1-65535.`);
}
const PORT = rawPort;
const POLL_INTERVAL_MS = 5_000;

async function fetchRenderData(): Promise<string> {
  const result = await runFull();
  const state = await triggerGenerationIfNeeded(result.state);
  const seed = generateSeed(hostname(), state.currentPet.petId);
  const renderData = buildRenderData(state, seed);
  return JSON.stringify(renderData);
}

export function startServer(): void {
  // Validate environment
  const config = loadConfig();
  const validation = validateStartup(config.llm);
  if (!validation.ok) {
    process.stderr.write("\n⚠ Setup incomplete:\n\n");
    for (const error of validation.errors) {
      process.stderr.write(`  [${error.component}] ${error.message}\n`);
    }
    process.exit(1);
  }

  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  const publicDir = join(__dirname, "..", "..", "src", "viewer", "public");
  app.use(express.static(publicDir));

  // REST: current pet
  app.get("/api/pet", async (_req, res) => {
    try {
      const json = await fetchRenderData();
      res.setHeader("Content-Type", "application/json");
      res.send(json);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`/api/pet error: ${message}\n`);
      res.status(500).json({ error: "Failed to fetch pet data" });
    }
  });

  // WebSocket: push updates
  const clients = new Set<WebSocket>();
  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
    ws.on("error", () => clients.delete(ws));
    fetchRenderData()
      .then((json) => { if (ws.readyState === WebSocket.OPEN) ws.send(json); })
      .catch(() => {});
  });

  let polling = false;
  setInterval(async () => {
    if (polling || clients.size === 0) return;
    polling = true;
    try {
      const json = await fetchRenderData();
      for (const ws of clients) {
        if (ws.readyState === WebSocket.OPEN) ws.send(json);
      }
    } catch {} finally { polling = false; }
  }, POLL_INTERVAL_MS);

  server.listen(PORT, "127.0.0.1", () => {
    process.stdout.write(`Tomotoken running at http://localhost:${PORT}\n`);
  });
}
```

**Step 3: Remove CLI dependencies from package.json**

Remove from `dependencies`:
- `chalk`
- `commander`
- `ink`
- `react`

Remove from `devDependencies`:
- `@types/react`

**Step 4: Update npm scripts in package.json**

```json
{
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "start": "tsup src/viewer/server.ts bin/tomotoken.ts --format esm --out-dir dist --external express --external ws --onSuccess 'node dist/tomotoken.js'",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src/ bin/ --ext .ts,.tsx",
    "typecheck": "tsc --noEmit"
  }
}
```

Remove `dev:viewer` and `sidecar` scripts.

**Step 5: Run npm install to update lockfile**

```bash
npm install
```

**Step 6: Run tests**

```bash
npm test
```

Expected: all pass (no test imports from deleted packages).

**Step 7: Commit**

```bash
git add -A
git commit -m "refactor: remove CLI dependencies, rewrite entry point as server-only"
```

---

## Phase 3: Collection API endpoints

---

- [ ] Task 5: Add GET /api/collection endpoint

**Files:**
- Modify: `src/viewer/server.ts` — add route
- Create: `test/viewer/api-collection.test.ts`

**Step 1: Write failing test**

Create `test/viewer/api-collection.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Collection, CompletedPet, PersonalitySnapshot } from "../../src/store/types.js";

// Mock the store module
vi.mock("../../src/store/index.js", () => ({
  loadCollection: vi.fn(),
}));

import { loadCollection } from "../../src/store/index.js";
import { buildCollectionResponse } from "../../src/viewer/api-collection.js";

const mockPersonality: PersonalitySnapshot = {
  usageMix: {},
  depthMetrics: { editTestLoopCount: 0, repeatEditSameFileCount: 0, phaseSwitchCount: 0, totalSessions: 0 },
  styleMetrics: { bulletRatio: 0, questionRatio: 0, codeblockRatio: 0, avgMessageLen: 0, messageLenStd: 0, headingRatio: 0 },
  traits: { builder: 80, fixer: 60 },
};

const mockPet: CompletedPet = {
  petId: "abc12345",
  spawnedAt: "2026-01-01T00:00:00Z",
  completedAt: "2026-02-01T00:00:00Z",
  requiredTokens: 1_000_000_000,
  consumedTokens: 1_000_000_000,
  spawnIndex: 0,
  personality: mockPersonality,
  seed: "seed123",
};

describe("buildCollectionResponse", () => {
  it("maps CompletedPet to collection response with hasSnapshot", () => {
    const collection: Collection = { version: 2, pets: [mockPet] };
    const result = buildCollectionResponse(collection, new Set(["abc12345"]));

    expect(result.pets).toHaveLength(1);
    expect(result.pets[0].petId).toBe("abc12345");
    expect(result.pets[0].archetype).toBe("builder");
    expect(result.pets[0].subtype).toBe("fixer");
    expect(result.pets[0].hasSnapshot).toBe(true);
    // Should not include full personality object
    expect(result.pets[0]).not.toHaveProperty("personality");
  });

  it("returns hasSnapshot false when no snapshot exists", () => {
    const collection: Collection = { version: 2, pets: [mockPet] };
    const result = buildCollectionResponse(collection, new Set());

    expect(result.pets[0].hasSnapshot).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run test/viewer/api-collection.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement api-collection module**

Create `src/viewer/api-collection.ts`:
```typescript
import type { Collection } from "../store/types.js";
import { TRAIT_IDS } from "../config/constants.js";

export interface CollectionPetSummary {
  readonly petId: string;
  readonly archetype: string;
  readonly subtype: string;
  readonly traits: Record<string, number>;
  readonly consumedTokens: number;
  readonly spawnedAt: string;
  readonly completedAt: string;
  readonly hasSnapshot: boolean;
}

export interface CollectionResponse {
  readonly pets: readonly CollectionPetSummary[];
}

function deriveTopTwo(traits: Record<string, number>): { archetype: string; subtype: string } {
  const sorted = [...TRAIT_IDS].sort((a, b) => (traits[b] ?? 0) - (traits[a] ?? 0));
  return { archetype: sorted[0] ?? "unknown", subtype: sorted[1] ?? "unknown" };
}

export function buildCollectionResponse(
  collection: Collection,
  snapshotPetIds: ReadonlySet<string>,
): CollectionResponse {
  return {
    pets: collection.pets.map((pet) => {
      const { archetype, subtype } = deriveTopTwo(pet.personality.traits);
      return {
        petId: pet.petId,
        archetype,
        subtype,
        traits: pet.personality.traits,
        consumedTokens: pet.consumedTokens,
        spawnedAt: pet.spawnedAt,
        completedAt: pet.completedAt,
        hasSnapshot: snapshotPetIds.has(pet.petId),
      };
    }),
  };
}
```

**Step 4: Wire into server.ts**

Add to `src/viewer/server.ts` inside `startServer()`:
```typescript
import { loadCollection } from "../store/index.js";
import { buildCollectionResponse } from "./api-collection.js";
import { listSnapshotPetIds } from "./snapshot.js"; // (built in Task 7)

// After existing routes:
app.get("/api/collection", (_req, res) => {
  try {
    const collection = loadCollection();
    const snapshotIds = listSnapshotPetIds();
    const response = buildCollectionResponse(collection, snapshotIds);
    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`/api/collection error: ${message}\n`);
    res.status(500).json({ error: "Failed to fetch collection" });
  }
});
```

Note: `listSnapshotPetIds` is created in Task 7. For now, add a stub or implement Tasks 5-6 together.

**Step 5: Run tests**

```bash
npx vitest run test/viewer/api-collection.test.ts
npm test
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add GET /api/collection endpoint"
```

---

- [ ] Task 6: Add GET /api/collection/:petId endpoint

**Files:**
- Modify: `src/viewer/server.ts` — add route
- Create: `test/viewer/api-collection-detail.test.ts`

**Step 1: Write failing test**

Create `test/viewer/api-collection-detail.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import type { Collection, CompletedPet, PersonalitySnapshot } from "../../src/store/types.js";
import { findPetById } from "../../src/viewer/api-collection.js";

const mockPersonality: PersonalitySnapshot = {
  usageMix: { builder: 5, fixer: 3 },
  depthMetrics: { editTestLoopCount: 2, repeatEditSameFileCount: 1, phaseSwitchCount: 1, totalSessions: 5 },
  styleMetrics: { bulletRatio: 0.2, questionRatio: 0.1, codeblockRatio: 0.3, avgMessageLen: 100, messageLenStd: 30, headingRatio: 0.1 },
  traits: { builder: 80, fixer: 60, scholar: 40 },
};

const mockPet: CompletedPet = {
  petId: "abc12345",
  spawnedAt: "2026-01-01T00:00:00Z",
  completedAt: "2026-02-01T00:00:00Z",
  requiredTokens: 1_000_000_000,
  consumedTokens: 1_000_000_000,
  spawnIndex: 0,
  personality: mockPersonality,
  seed: "seed123",
};

describe("findPetById", () => {
  const collection: Collection = { version: 2, pets: [mockPet] };

  it("returns pet with full personality when found", () => {
    const result = findPetById(collection, "abc12345");
    expect(result).not.toBeNull();
    expect(result!.petId).toBe("abc12345");
    expect(result!.personality).toEqual(mockPersonality);
  });

  it("returns null for unknown petId", () => {
    expect(findPetById(collection, "unknown")).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run test/viewer/api-collection-detail.test.ts
```

**Step 3: Add findPetById to api-collection.ts**

```typescript
export function findPetById(collection: Collection, petId: string): CompletedPet | null {
  return collection.pets.find((p) => p.petId === petId) ?? null;
}
```

**Step 4: Wire route in server.ts**

```typescript
app.get("/api/collection/:petId", (_req, res) => {
  try {
    const collection = loadCollection();
    const pet = findPetById(collection, _req.params.petId);
    if (!pet) { res.status(404).json({ error: "Pet not found" }); return; }
    res.json(pet);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`/api/collection/:petId error: ${message}\n`);
    res.status(500).json({ error: "Failed to fetch pet" });
  }
});
```

**Step 5: Run tests and commit**

```bash
npm test
git add -A
git commit -m "feat: add GET /api/collection/:petId endpoint"
```

---

## Phase 4: Snapshot system

---

- [ ] Task 7: Add snapshot save/serve endpoints

**Files:**
- Create: `src/viewer/snapshot.ts`
- Create: `test/viewer/snapshot.test.ts`
- Modify: `src/viewer/server.ts` — add routes

**Step 1: Write failing test**

Create `test/viewer/snapshot.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { saveSnapshot, getSnapshotPath, listSnapshotPetIds } from "../../src/viewer/snapshot.js";

const TEST_DIR = join(process.cwd(), "test", "tmp-snapshots");

describe("snapshot", () => {
  beforeEach(() => { mkdirSync(TEST_DIR, { recursive: true }); });
  afterEach(() => { rmSync(TEST_DIR, { recursive: true, force: true }); });

  it("saves PNG data and retrieves path", () => {
    // Minimal valid PNG header
    const pngData = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
    saveSnapshot("pet-001", pngData, TEST_DIR);

    const path = getSnapshotPath("pet-001", TEST_DIR);
    expect(path).not.toBeNull();
    expect(existsSync(path!)).toBe(true);
    expect(readFileSync(path!)).toEqual(pngData);
  });

  it("returns null for missing snapshot", () => {
    expect(getSnapshotPath("nonexistent", TEST_DIR)).toBeNull();
  });

  it("lists petIds that have snapshots", () => {
    const pngData = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
    saveSnapshot("pet-a", pngData, TEST_DIR);
    saveSnapshot("pet-b", pngData, TEST_DIR);

    const ids = listSnapshotPetIds(TEST_DIR);
    expect(ids).toEqual(new Set(["pet-a", "pet-b"]));
  });

  it("rejects petId with path traversal", () => {
    const pngData = Buffer.from([0x89, 0x50]);
    expect(() => saveSnapshot("../evil", pngData, TEST_DIR)).toThrow();
    expect(() => saveSnapshot("foo/bar", pngData, TEST_DIR)).toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run test/viewer/snapshot.test.ts
```

**Step 3: Implement snapshot module**

Create `src/viewer/snapshot.ts`:
```typescript
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const DEFAULT_SNAPSHOT_DIR = join(homedir(), ".tomotoken", "snapshots");

const SAFE_ID = /^[a-zA-Z0-9_-]+$/;

function validatePetId(petId: string): void {
  if (!SAFE_ID.test(petId)) {
    throw new Error(`Invalid petId: ${petId}`);
  }
}

export function saveSnapshot(
  petId: string,
  pngData: Buffer,
  dir: string = DEFAULT_SNAPSHOT_DIR,
): void {
  validatePetId(petId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${petId}.png`), pngData);
}

export function getSnapshotPath(
  petId: string,
  dir: string = DEFAULT_SNAPSHOT_DIR,
): string | null {
  validatePetId(petId);
  const path = join(dir, `${petId}.png`);
  return existsSync(path) ? path : null;
}

export function listSnapshotPetIds(
  dir: string = DEFAULT_SNAPSHOT_DIR,
): ReadonlySet<string> {
  if (!existsSync(dir)) return new Set();
  const files = readdirSync(dir);
  const ids = files
    .filter((f) => f.endsWith(".png"))
    .map((f) => f.slice(0, -4));
  return new Set(ids);
}
```

**Step 4: Wire routes in server.ts**

```typescript
import { saveSnapshot, getSnapshotPath } from "./snapshot.js";

// POST /api/snapshot/:petId — receive PNG from client
app.post("/api/snapshot/:petId", express.raw({ type: "image/png", limit: "2mb" }), (req, res) => {
  try {
    saveSnapshot(req.params.petId, req.body as Buffer);
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

// GET /api/snapshot/:petId — serve PNG
app.get("/api/snapshot/:petId", (req, res) => {
  try {
    const path = getSnapshotPath(req.params.petId);
    if (!path) { res.status(404).json({ error: "Snapshot not found" }); return; }
    res.sendFile(path);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});
```

**Step 5: Run tests and commit**

```bash
npm test
git add -A
git commit -m "feat: add snapshot save/serve system"
```

---

- [ ] Task 8: Client-side snapshot capture on pet completion

**Files:**
- Modify: `src/viewer/public/js/app.js` — detect pet completion, capture canvas, POST to server

**Step 1: Add capture logic to app.js**

In the WebSocket message handler, after detecting a pet has completed (stage transition from <4 to 4, or a new petId appearing):

```javascript
// Track previous pet state for completion detection
let previousPetId = null;

function onPetDataReceived(data) {
  // Detect pet completion: petId changed means previous pet completed
  if (previousPetId && previousPetId !== data.petId) {
    captureSnapshot(previousPetId);
  }
  previousPetId = data.petId;
  // ... existing render logic
}

async function captureSnapshot(petId) {
  // Wait one frame for final render
  requestAnimationFrame(() => {
    const canvas = renderer.domElement;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        await fetch(`/api/snapshot/${petId}`, {
          method: "POST",
          headers: { "Content-Type": "image/png" },
          body: blob,
        });
      } catch (err) {
        console.warn("Failed to save snapshot:", err);
      }
    }, "image/png");
  });
}
```

**Step 2: Test manually**

Start server, trigger a pet completion scenario, verify PNG appears in `~/.tomotoken/snapshots/`.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: client-side snapshot capture on pet completion"
```

---

## Phase 5: Zukan page

---

- [ ] Task 9: Create zukan HTML page with card grid

**Files:**
- Create: `src/viewer/public/zukan.html`
- Create: `src/viewer/public/js/zukan.js`
- Create: `src/viewer/public/css/zukan.css`

**Step 1: Create zukan.html**

Minimal HTML shell: card grid container, modal container, floating nav button back to `/`.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tomotoken - Zukan</title>
  <link rel="stylesheet" href="css/zukan.css">
</head>
<body>
  <div id="grid"></div>
  <div id="modal" class="modal hidden">
    <div class="modal-backdrop"></div>
    <div class="modal-content">
      <button class="modal-close">&times;</button>
      <div id="modal-viewer"></div>
      <div id="modal-info"></div>
    </div>
  </div>
  <a href="/" id="nav-btn" class="floating-btn" title="Back to pet">&#x1f3e0;</a>
  <script type="module" src="js/zukan.js"></script>
</body>
</html>
```

**Step 2: Create zukan.css**

Card grid layout, modal styles, floating button styles. Responsive grid with `auto-fill, minmax(240px, 1fr)`.

**Step 3: Create zukan.js**

```javascript
async function loadCollection() {
  const res = await fetch("/api/collection");
  return res.json();
}

function createCard(pet) {
  const card = document.createElement("div");
  card.className = "pet-card";
  card.dataset.petId = pet.petId;

  const img = document.createElement("img");
  img.src = pet.hasSnapshot ? `/api/snapshot/${pet.petId}` : "";
  img.alt = pet.archetype;
  img.className = "card-thumb";
  if (!pet.hasSnapshot) img.style.display = "none";

  const name = document.createElement("div");
  name.className = "card-archetype";
  name.textContent = pet.archetype;

  const date = document.createElement("div");
  date.className = "card-date";
  date.textContent = new Date(pet.completedAt).toLocaleDateString();

  // Palette dots
  const palette = document.createElement("div");
  palette.className = "card-palette";
  const traitKeys = Object.keys(pet.traits).slice(0, 8);
  // (palette dots are cosmetic — use trait-based colors if available)

  card.append(img, name, date, palette);
  card.addEventListener("click", () => openModal(pet.petId));
  return card;
}

function renderGrid(data) {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  for (const pet of data.pets) {
    grid.appendChild(createCard(pet));
  }
}

async function openModal(petId) {
  // Fetch full pet data for modal
  const res = await fetch(`/api/collection/${petId}`);
  const pet = await res.json();
  // Show modal with pet details + 3D viewer
  document.getElementById("modal").classList.remove("hidden");
  renderModalContent(pet);
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
}

function renderModalContent(pet) {
  const info = document.getElementById("modal-info");
  info.innerHTML = `
    <h2>${deriveArchetype(pet.personality.traits)}</h2>
    <p>${new Date(pet.spawnedAt).toLocaleDateString()} — ${new Date(pet.completedAt).toLocaleDateString()}</p>
    <p>${pet.consumedTokens.toLocaleString()} tokens</p>
  `;
  // TODO: Task 10 — initialize Three.js in modal-viewer
}

function deriveArchetype(traits) {
  return Object.entries(traits).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";
}

// Init
document.querySelector(".modal-backdrop").addEventListener("click", closeModal);
document.querySelector(".modal-close").addEventListener("click", closeModal);

loadCollection().then(renderGrid);
```

**Step 4: Add route in server.ts**

The zukan page is served by Express static middleware (already configured). Since `zukan.html` is in `public/`, accessing `/zukan.html` works. For clean URL `/zukan`, add:

```typescript
app.get("/zukan", (_req, res) => {
  res.sendFile(join(publicDir, "zukan.html"));
});
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add zukan page with card grid and collection API"
```

---

- [ ] Task 10: Add 3D viewer to zukan modal

**Files:**
- Modify: `src/viewer/public/js/zukan.js` — initialize Three.js in modal
- Possibly extract shared rendering code from `app.js` into a reusable module

**Step 1: Extract reusable rendering setup**

The modal needs the same Three.js setup (scene, camera, lights, toon shading, model loading) as the main page. Extract shared code from `app.js` into a new module `js/viewer-core.js` that both pages can import.

Key functions to share:
- Scene setup (camera, lights, background)
- Model loading (buildFromDesign / buildFromModel)
- Toon shading, palette application
- Animation mixer
- Radar chart rendering

**Step 2: Use viewer-core.js in zukan modal**

```javascript
import { createViewer, loadPetModel } from "./viewer-core.js";

async function openModal(petId) {
  const res = await fetch(`/api/collection/${petId}`);
  const pet = await res.json();
  document.getElementById("modal").classList.remove("hidden");

  const container = document.getElementById("modal-viewer");
  container.innerHTML = "";

  // Build PetRenderData-like object from CompletedPet
  // The modal viewer needs: seed, personality traits, archetype
  // Use buildRenderData on server or reconstruct client-side

  const viewer = createViewer(container);
  // Load and display the pet's 3D model
  // ... render logic
}
```

Note: The modal may need to call a server endpoint to get PetRenderData for a completed pet. Consider adding `GET /api/collection/:petId/render` that runs `buildRenderData` for a completed pet.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add 3D viewer to zukan modal with shared rendering code"
```

---

- [ ] Task 11: Add floating nav button to main page

**Files:**
- Modify: `src/viewer/public/index.html` — add floating button linking to `/zukan`

**Step 1: Add button HTML**

Add before `</body>`:
```html
<a href="/zukan" id="nav-btn" class="floating-btn" title="Zukan">📖</a>
```

**Step 2: Add CSS**

```css
.floating-btn {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  font-size: 24px;
  z-index: 1000;
  cursor: pointer;
  transition: background 0.2s;
}
.floating-btn:hover {
  background: rgba(0, 0, 0, 0.8);
}
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add floating nav buttons between main and zukan pages"
```

---

## Phase 6: Cleanup and docs

---

- [ ] Task 12: Update README

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Step 1: Rewrite README**

Remove all CLI command references. Update:
- Usage section: `npm start` only
- Remove `commander` from description
- Remove ASCII art mentions
- Add zukan page description
- Update project structure (remove deleted dirs, add `src/creature/`)
- Update data storage section (add snapshots dir)
- Rescan: document `rm ~/.tomotoken/state.json && npm start`

**Step 2: Update CLAUDE.md**

- Remove CLI Commands section
- Remove Art domain description
- Remove UI domain description
- Update architecture diagram
- Add creature/ and viewer API descriptions

**Step 3: Commit**

```bash
git add -A
git commit -m "docs: update README and CLAUDE.md for web-only architecture"
```

---

- [ ] Task 13: Final test pass and cleanup

**Step 1: Run full test suite**

```bash
npm test
```

**Step 2: Run typecheck**

```bash
npm run typecheck
```

**Step 3: Run build**

```bash
npm run build
```

**Step 4: Manual smoke test**

```bash
npm start
# Open http://localhost:3456 — verify 3D viewer works
# Open http://localhost:3456/zukan — verify card grid loads
# Click floating button — verify navigation works
```

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore: final cleanup after web app migration"
```
