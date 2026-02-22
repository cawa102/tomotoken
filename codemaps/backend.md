# Backend Codemap

> Freshness: 2026-02-22 18:03

## Ingestion (`src/ingestion/`)

```
scanner.ts ──→ incremental.ts ──→ parser.ts ──→ aggregator.ts
(find .jsonl)   (read from offset)  (parse line)   (merge sessions)
```

| File | Exports | Deps |
|------|---------|------|
| `scanner.ts` | `scanLogFiles(baseDir): ScanResult[]` | fs, path |
| `parser.ts` | `parseLine(line): ParsedLogEntry \| null` | (none) |
| `incremental.ts` | `readIncremental(path, offset): { entries, newByteOffset }` | fs, parser |
| `aggregator.ts` | `aggregateSessions(entries): SessionMetrics[]` | (none) |
| `watcher.ts` | `watchLogDir(dir, cb): Watcher` | fs |
| `types.ts` | `TokenUsage`, `ParsedLogEntry`, `SessionMetrics`, `ScanResult` | — |

## Progression (`src/progression/`)

| File | Exports | Deps |
|------|---------|------|
| `engine.ts` | `advancePet(pet, delta, idx): AdvanceResult` | uuid, store/types |
| `monthly.ts` | `detectMonthChange(month): bool`, `handleMonthChange(state): AppState` | store/types |
| `stages.ts` | `computeEggStage(progress): EggStage`, `type EggStage` | (none) |

Key: TOKENS_PER_PET = 1 billion. EggStage: 0→0%, 1→25%, 2→50%, 3→75%, 4→100%.

## Personality (`src/personality/`)

| File | Exports | Deps |
|------|---------|------|
| `classifier.ts` | `classifySession(signals): SessionClassification` | config/constants |
| `depth.ts` | `computeDepthMetrics(metrics[]): DepthMetrics` | (none) |
| `style.ts` | `computeStyleMetrics(messages[]): StyleMetrics` | (none) |
| `traits.ts` | `computeTraits(scores, depth, style): TraitVector` | config/constants |

8 categories: impl, debug, refactor, research, docs, planning, ops, security
8 traits: builder, fixer, refiner, scholar, scribe, architect, operator, guardian

## Creature (`src/creature/`)

| File | Exports | Deps |
|------|---------|------|
| `params.ts` | `deriveCreatureParams`, `adjustParamsForProgress` | store/types, config/constants |
| `palette.ts` | `generatePalette`, `paletteToHexArray`, `ansi256ToHex` | utils/clamp |
| `types.ts` | `CreatureParams`, `LimbStage`, `PatternType`, `Palette` | — |
| `index.ts` | barrel re-exports | params, palette, types |

Relocated from `src/art/parametric/` during web migration. Only parametric derivation + palette remain.

## Palette (`src/palette/`)

| File | Exports | Deps |
|------|---------|------|
| `index.ts` | re-exports `generatePalette`, `paletteToHexArray`, `ansi256ToHex` | creature/palette |

## Store (`src/store/`)

| File | Key Functions |
|------|---------------|
| `store.ts` | `loadState`, `saveState`, `loadCollection`, `saveCollection`, `createInitialState` |
| `store.ts` | Mutations: `addCompletedPet`, `updatePetInState`, `updateIngestionFile`, `updateGlobalStats` |

Storage: `~/.tomotoken/{state,collection,config}.json` + lock file

## Config (`src/config/`)

| File | Exports |
|------|---------|
| `schema.ts` | Zod schema for Config (animation, encouragement, privacy, llm) |
| `loader.ts` | `loadConfig(path?): Config` |
| `constants.ts` | `CLAUDE_PROJECTS_DIR`, `TOKENS_PER_PET`, category/trait IDs, defaults |

## Validation (`src/validation/`)

| File | Exports |
|------|---------|
| `startup.ts` | `validateStartup(llmConfig): ValidationResult` — checks API key + Blender |

## First-Run (`src/first-run/`)

| File | Exports |
|------|---------|
| `detect.ts` | `isFirstRun(state): boolean` |
| `recent-ingestion.ts` | `extractRecentTokens(state, limit): number` |
| `orchestrate.ts` | `buildFirstRunState(state): AppState` — computes initial personality |

## Sidecar (`src/sidecar/`)

| File | Purpose |
|------|---------|
| `render-data.ts` | `buildRenderData(state, seed): PetRenderData` — uses `computeEggStage` |
| `generation-trigger.ts` | Check stage via `computeEggStage`, call LLM if needed, save design |

## Viewer Server (`src/viewer/server.ts`)

Express on :3456 (VIEWER_PORT env), binds `127.0.0.1`.

`startServer()`: validateStartup → Express setup → 7 REST routes + WebSocket push (5s poll)

| Route | Handler Module |
|-------|---------------|
| `GET /api/pet` | inline (fetchRenderData) |
| `GET /api/collection` | `api-collection.ts` → `buildCollectionResponse` |
| `GET /api/collection/:petId` | `api-collection.ts` → `findPetById` |
| `GET /api/collection/:petId/render` | `api-collection.ts` → `buildCompletedPetRenderData` |
| `POST /api/snapshot/:petId` | `snapshot.ts` → `saveSnapshot` |
| `GET /api/snapshot/:petId` | `snapshot.ts` → `getSnapshotPath` |
| `GET /zukan` | static file (zukan.html) |

## Viewer API Modules

| File | Exports |
|------|---------|
| `api-collection.ts` | `buildCollectionResponse`, `findPetById`, `buildCompletedPetRenderData`, types |
| `snapshot.ts` | `saveSnapshot`, `getSnapshotPath`, `listSnapshotPetIds` |

## Generation (`src/generation/`)

| File | Purpose |
|------|---------|
| `schema.ts` | Zod: `CreatureDesign { parts[], expressions{}, personality{} }` |
| `prompt.ts` | Japanese prompt builder — egg-based stage descriptions (0-4) |
| `designer.ts` | Call LLM provider, parse JSON, validate schema |
| `llm-provider.ts` | `createLLMProvider(config)` — Anthropic or OpenAI abstraction |
| `cli.ts` | Design context management — egg stage descriptions |
| `templates/humanoid.ts` | Base geometry template |
| `templates/apply.ts` | Apply customization to template |

## Utils (`src/utils/`)

| File | Exports |
|------|---------|
| `hash.ts` | `createPrng(seed)` — SHA-256 → mulberry32 PRNG |
| `seed.ts` | `generateSeed(hostname, petId)` — deterministic seed |
| `path.ts` | `expandHome(path)` — `~/` resolution |
| `time.ts` | Date formatting utilities |
| `clamp.ts` | `clamp(value, min, max)` |
