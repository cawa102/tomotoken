# Backend Codemap

> Freshness: 2026-02-22

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
| `engine.ts` | `advancePet(pet, delta, t0, g, idx): AdvanceResult` | uuid, store/types |
| `calibration.ts` | `computeCalibration(input, g, rounding): CalibrationResult` | (none) |
| `monthly.ts` | `detectMonthChange(month): bool`, `handleMonthChange(state): AppState` | store/types |
| `stages.ts` | `computeEggStage(progress): EggStage`, `type EggStage` | (none) |

Key formulas:
- T0: `ceil(M / 4.75)`, required[n]: `ceil(T0 * g^n)`
- EggStage: 0→0%, 1→25%, 2→50%, 3→75%, 4→100%

## Personality (`src/personality/`)

| File | Exports | Deps |
|------|---------|------|
| `classifier.ts` | `classifySession(signals): SessionClassification` | config/constants |
| `depth.ts` | `computeDepthMetrics(metrics[]): DepthMetrics` | (none) |
| `style.ts` | `computeStyleMetrics(messages[]): StyleMetrics` | (none) |
| `traits.ts` | `computeTraits(scores, depth, style): TraitVector` | config/constants |

8 categories: impl, debug, refactor, research, docs, planning, ops, security
8 traits: builder, fixer, refiner, scholar, scribe, architect, operator, guardian

## Art/Parametric (`src/art/parametric/`)

| File | Exports | Deps |
|------|---------|------|
| `params.ts` | `deriveCreatureParams`, `adjustParamsForProgress` | types, config/constants |
| `palette.ts` | `generatePalette`, `paletteToHexArray`, `ansi256ToHex` | (none) |
| `types.ts` | `CreatureParams`, `LimbStage`, `PatternType`, `Palette` | — |

Note: 2D ASCII art rendering removed. Only parametric derivation + palette remain.

## Palette (`src/palette/`)

| File | Exports | Deps |
|------|---------|------|
| `index.ts` | re-exports `generatePalette`, `paletteToHexArray`, `ansi256ToHex` | art/parametric/palette |

Standalone re-export module for consumers outside the art domain.

## Store (`src/store/`)

| File | Key Functions |
|------|---------------|
| `store.ts` | `loadState`, `saveState`, `loadCollection`, `saveCollection`, `createInitialState` |
| `store.ts` | Mutations: `addCompletedPet`, `updatePetInState`, `updateIngestionFile`, `updateGlobalStats` |

Storage: `~/.tomotoken/{state,collection,config}.json` + lock file

## Config (`src/config/`)

| File | Exports |
|------|---------|
| `schema.ts` | Zod schema for Config (canvas, animation, growth, encouragement, privacy) |
| `loader.ts` | `loadConfig(path?): Config` |
| `constants.ts` | `CLAUDE_PROJECTS_DIR`, category/trait IDs, defaults |

## Sidecar (`src/sidecar/`)

| File | Purpose |
|------|---------|
| `main.ts` | CLI entry: `runFull()` → build `PetRenderData` → stdout JSON |
| `render-data.ts` | `buildRenderData(state, seed): PetRenderData` — uses `computeEggStage` |
| `generation-trigger.ts` | Check stage via `computeEggStage`, call Claude API if needed, save design |

## Viewer Server (`src/viewer/server.ts`)

Express on :3456, binds to `127.0.0.1`, serves `viewer/public/`, REST `/api/pet`, WebSocket push (5s poll)

## Generation (`src/generation/`)

| File | Purpose |
|------|---------|
| `schema.ts` | Zod: `CreatureDesign { parts[], expressions{}, personality{} }` |
| `prompt.ts` | Japanese prompt builder — egg-based stage descriptions (0-4) |
| `designer.ts` | Call Claude, parse JSON, validate schema |
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
