# Architecture Codemap

> Freshness: 2026-02-22 | 82 source files | 312 tests (49 files)

## Domain Flow

```
Ingestion → Progression → Personality → Art(Params) → UI
     ↕            ↕            ↕            ↕          ↕
              JSON Store (state/collection/config)
```

Subsystems: Viewer (3D WebGL), Sidecar (CLI orchestrator), Generation (LLM design),
Art3D (style guide), Palette, Encouragement, Window

## Entry Points

| Entry | File | Purpose |
|-------|------|---------|
| CLI | `bin/tomotoken.ts` | Commander.js: show, stats, collection, watch, zukan, window |
| Orchestrator | `src/index.ts` | `runFull()` chains ingest → calibrate → personality → progression → save |
| Sidecar | `src/sidecar/main.ts` | Builds `PetRenderData` JSON for viewer |
| Viewer | `src/viewer/server.ts` | Express + WebSocket on :3456 |

## Domain Map

| Domain | Location | Barrel | Key Exports |
|--------|----------|--------|-------------|
| Ingestion | `src/ingestion/` | `index.ts` | `aggregateSessions`, `scanLogFiles`, `readIncremental` |
| Progression | `src/progression/` | `index.ts` | `advancePet`, `computeCalibration`, `detectMonthChange`, `computeEggStage`, `EggStage` |
| Personality | `src/personality/` | `index.ts` | `classifySession`, `computeTraits`, `computeDepthMetrics`, `computeStyleMetrics` |
| Art/Parametric | `src/art/parametric/` | `index.ts` | `deriveCreatureParams`, `adjustParamsForProgress`, `generatePalette`, `paletteToHexArray` |
| Palette | `src/palette/` | `index.ts` | `generatePalette`, `paletteToHexArray`, `ansi256ToHex` (re-exports) |
| UI | `src/ui/` | (none) | `App`, `WatchApp`, `ZukanApp` components |
| Store | `src/store/` | `index.ts` | `loadState`, `saveState`, `loadCollection`, `saveCollection` |
| Config | `src/config/` | `index.ts` | `loadConfig`, `ensureDataDir`, `CLAUDE_PROJECTS_DIR` |
| Encouragement | `src/encouragement/` | `index.ts` | `shouldTrigger`, `selectMessage`, `tokensInWindow` |
| Window | `src/window/` | `index.ts` | `spawnWindow` |
| Viewer | `src/viewer/` | (none) | Express server + Three.js client (egg + character rendering) |
| Sidecar | `src/sidecar/` | (none) | `buildRenderData`, `triggerGenerationIfNeeded` |
| Generation | `src/generation/` | `index.ts` | `buildPrompt`, `creatureDesignSchema`, `saveDesign` |
| Art3D | `src/art3d/` | `index.ts` | `PetRenderData` type, `STYLE_SUFFIX`, `buildModelPrompt` |
| Utils | `src/utils/` | `index.ts` | `expandHome`, `createPrng`, `generateSeed`, `clamp` |

## Cross-Domain Dependencies

```
Config ← all domains (constants, paths)
Store  ← Ingestion, Progression, Personality, UI, Sidecar
Ingestion → Personality (SessionMetrics[])
Personality → Art/Parametric (traits, depth, style)
Palette ← Art/Parametric (re-export), Sidecar, Viewer
Progression/stages ← Sidecar, Viewer (EggStage)
Store → Sidecar → Viewer (PetRenderData)
Generation → Store (CreatureDesign saved to state)
```

## Key Design Patterns

- **Immutability**: All state mutations return new objects via spread
- **Atomic writes**: temp file + rename for state/collection
- **Incremental ingestion**: byte offset tracking per log file
- **Egg hatching**: 5-stage progression (0=pristine → 4=hatched)
- **Barrel exports**: each domain exposes public API via `index.ts`
- **3D pipeline**: Hyper3D generation → Blender post-processing → GLB → Three.js viewer
