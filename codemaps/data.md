# Data Models Codemap

> Freshness: 2026-02-22

## Storage Files (`~/.tomotoken/`)

### state.json — `AppState`

```typescript
{
  version: 2,
  calibration: { t0, monthlyEstimate, calibratedAt } | null,
  spawnIndexCurrentMonth: number,
  currentMonth: "2026-02",
  currentPet: PetRecord,
  ingestionState: { files: Record<path, { byteOffset, lastLineTimestamp }> },
  globalStats: { totalTokensAllTime, totalSessionsIngested, dates },
  lastEncouragementShownAt: string | null
}
```

### collection.json — `Collection`

```typescript
{
  version: 2,
  pets: CompletedPet[]  // immutable append-only
}
```

### config.json — `Config` (Zod-validated)

```typescript
{
  logPath?: string,
  canvas: { width: 16-80, height: 8-40, frames: 2-8 },
  animation: { enabled: bool, fps: 1-10 },
  growth: { g: 1.0-3.0, t0Rounding: "ceil"|"floor"|"round" },
  encouragement: { enabled: bool, tokensPerHourThreshold: int, cooldownHours: float },
  privacy: { storeRawMessages: bool }
}
```

## Core Types

### PetRecord (`src/store/types.ts`)

```typescript
{
  petId: string,
  spawnedAt: string,
  requiredTokens: number,
  consumedTokens: number,
  spawnIndex: number,
  personalitySnapshot: PersonalitySnapshot | null,
  generatedDesigns: Record<number, CreatureDesign> | null
}
```

### CompletedPet (`src/store/types.ts`)

```typescript
PetRecord + {
  completedAt: string,
  personality: PersonalitySnapshot,
  frames: string[][],        // 4 ASCII frames (legacy, may be empty)
  colorFrames: string[][],   // 4 ANSI-colored frames (legacy, may be empty)
  seed: string
}
```

### PersonalitySnapshot

```typescript
{
  usageMix: Record<CategoryId, number>,   // 8 categories (0-100)
  depthMetrics: DepthMetrics,
  styleMetrics: StyleMetrics,
  traits: Record<TraitId, number>          // 8 traits (0-100)
}
```

### DepthMetrics / StyleMetrics

```typescript
DepthMetrics = { editTestLoopCount, repeatEditSameFileCount, phaseSwitchCount, totalSessions }
StyleMetrics = { bulletRatio, questionRatio, codeblockRatio, avgMessageLen, messageLenStd, headingRatio }
```

## Ingestion Types (`src/ingestion/types.ts`)

```typescript
TokenUsage    = { input, output, cache_creation, cache_read }
ParsedLogEntry = { type, timestamp?, usage?, toolName?, editedFile?, bashCommand?, userMessageText? }
SessionMetrics = { sessionId, totalTokens, input/output/cacheTokens, toolUseCounts, toolTransitions,
                   editedExtensions, bashCommands, userMessageTexts, entryCount, first/lastTimestamp }
```

## Progression Types (`src/progression/stages.ts`)

```typescript
EggStage = 0 | 1 | 2 | 3 | 4
// 0=pristine egg, 1=small cracks (25%), 2=many cracks (50%),
// 3=large fractures (75%), 4=hatched (100%)
```

## Art Types

### Palette (`src/art/parametric/palette.ts`)

```typescript
{ colors: number[] }  // 10 ANSI 256 indices
// Slots: 0=transparent, 1=outline, 2=body, 3=secondary, 4=highlight,
//        5=eye white, 6=pupil, 7=mouth, 8=accent1, 9=accent2
```

### CreatureParams (`src/art/parametric/types.ts`)

20+ fields: headRatio, bodyRoundness, topHeavy, eyeSize, eyeSpacing, earPresence, hornPresence,
tailPresence, wingPresence, limbStage(0-5), patternType, neckWidth, leg/arm/tail/wing sizes, etc.

Note: `limbStage` (LimbStage 0-5) is internal to parametric derivation, distinct from `EggStage` (0-4).

## Generation Types (`src/generation/schema.ts`)

### CreatureDesign (Zod-validated)

```typescript
{
  parts: Part[],                    // 1-50 recursive 3D parts
  expressions: Record<string, Expression>,
  personality: { name, quirk }
}

Part = { name, primitive, position[3], rotation[3], scale[3], color, material, animatable?, children? }
Expression = { eyes?: { scaleY, offsetY, shape }, mouth?: { scaleX, scaleY, shape } }
```

## Viewer Types (`src/art3d/types.ts`)

### PetRenderData

```typescript
{ creatureParams, palette: string[], progress, petId, seed, archetype, subtype,
  stage: EggStage,  // 0-4 egg stage (0=pristine, 4=hatched)
  traits, creatureDesign: CreatureDesign | null }
```

## Input Format

Claude Code logs: `~/.claude/projects/{project}/{session}.jsonl`
Each line JSON with `type`: assistant (has usage + tool_use), user (has toolUseResult), progress, summary
