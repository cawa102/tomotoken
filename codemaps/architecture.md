# Architecture Codemap

> Freshness: 2026-02-22 21:45 | 63 TS files + 23 client files | 325 tests (55 files)

## Domain Flow

```
Ingestion → Progression → Personality → Creature(Params) → Viewer(Web)
     ↕            ↕            ↕            ↕                  ↕
                   JSON Store (state/collection/config)
```

Subsystems: Generation (LLM design), Art3D (style guide), Sidecar (render-data builder),
Palette, First-Run, Validation, Snapshot

## Entry Points

| Entry | File | Purpose |
|-------|------|---------|
| Server | `bin/tomotoken.ts` | `startServer()` — Express + WebSocket on :3456 |
| Orchestrator | `src/index.ts` | `runFull()` chains ingest → personality → progression → save |

## Domain Map

| Domain | Location | Barrel | Key Exports |
|--------|----------|--------|-------------|
| Ingestion | `src/ingestion/` | `index.ts` | `aggregateSessions`, `scanLogFiles`, `readIncremental` |
| Progression | `src/progression/` | `index.ts` | `advancePet`, `detectMonthChange`, `computeEggStage`, `EggStage` |
| Personality | `src/personality/` | `index.ts` | `classifySession`, `computeTraits`, `computeDepthMetrics`, `computeStyleMetrics` |
| Creature | `src/creature/` | `index.ts` | `deriveCreatureParams`, `adjustParamsForProgress`, `generatePalette`, `paletteToHexArray` |
| Palette | `src/palette/` | `index.ts` | Re-exports from creature/palette |
| Store | `src/store/` | `index.ts` | `loadState`, `saveState`, `loadCollection`, `saveCollection` |
| Config | `src/config/` | `index.ts` | `loadConfig`, `ensureDataDir`, `CLAUDE_PROJECTS_DIR`, `TOKENS_PER_PET` |
| Validation | `src/validation/` | `startup.ts` | `validateStartup(llmConfig)` |
| First-Run | `src/first-run/` | (none) | `isFirstRun`, `buildFirstRunState`, `extractRecentTokens` |
| Viewer | `src/viewer/` | (none) | Express server, API routes, Three.js client, snapshot, collection page |
| Sidecar | `src/sidecar/` | (none) | `buildRenderData`, `triggerGenerationIfNeeded` |
| Generation | `src/generation/` | `index.ts` | `buildPrompt`, `creatureDesignSchema`, `saveDesign`, `createLLMProvider` |
| Art3D | `src/art3d/` | `index.ts` | `PetRenderData` type, `STYLE_SUFFIX`, `buildModelPrompt` |
| Utils | `src/utils/` | `index.ts` | `expandHome`, `createPrng`, `generateSeed`, `clamp` |

## Cross-Domain Dependencies

```
Config ← all domains (constants, paths)
Store  ← Ingestion, Progression, Personality, Sidecar, Viewer
Ingestion → Personality (SessionMetrics[])
Personality → Creature (traits, depth, style → params + palette)
Palette ← Creature (re-export), Sidecar, Viewer
Progression/stages ← Sidecar, Viewer (EggStage)
Store → Sidecar → Viewer (PetRenderData)
Generation → Store (CreatureDesign saved to state)
Viewer/api-collection → Creature, Palette, Progression (builds PetRenderData for completed pets)
Viewer/snapshot → filesystem (~/.tomotoken/snapshots/)
```

## API Surface

| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/pet` | Current pet PetRenderData |
| GET | `/api/collection` | All completed pets (summary) |
| GET | `/api/collection/:petId` | Single pet detail (full personality) |
| GET | `/api/collection/:petId/render` | PetRenderData for completed pet |
| POST | `/api/snapshot/:petId` | Save PNG snapshot |
| GET | `/api/snapshot/:petId` | Serve PNG snapshot |
| GET | `/collection` | Collection page (clean URL) |
| WS | `/` | 5s poll PetRenderData push |

## Key Design Patterns

- **Immutability**: All state mutations return new objects via spread
- **Atomic writes**: temp file + rename for state/collection
- **Incremental ingestion**: byte offset tracking per log file
- **Egg hatching**: 5-stage progression (0=pristine → 4=hatched)
- **Barrel exports**: each domain exposes public API via `index.ts`
- **3D pipeline**: Hyper3D generation → Blender post-processing → GLB → Three.js viewer
- **Web-only**: Single `npm start` launches Express server, no CLI commands
