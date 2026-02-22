# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Tomotoken is a tool that visualizes Claude Code token usage as a growing pet character. Pets accumulate tokens from local Claude Code logs, grow procedurally-generated bodies (3D via Hyper3D), develop personality traits from usage patterns, and enter a collection when complete.

## Commands

```bash
npm test                    # Run all tests (vitest)
npm run test:watch          # Watch mode
npm run test:coverage       # With 80% coverage thresholds
npx vitest run test/ingestion/parser.test.ts  # Single test file
npm run build               # Build with tsup → dist/
npm run typecheck           # tsc --noEmit
npm start                   # Run CLI (node dist/bin/tomotoken.js)
npm run dev:viewer          # 3D viewer server on localhost:3456
npm run sidecar             # Build PetRenderData JSON to stdout
```

### CLI Commands

```bash
tomotoken              # show current pet (default)
tomotoken stats        # token usage summaries
tomotoken collection   # list completed pets
tomotoken view <id>    # detailed pet view with animation
tomotoken config       # show current config
tomotoken watch        # live mode (polls every 5s, animates)
tomotoken window       # spawn new terminal window
tomotoken zukan        # interactive encyclopedia (gallery/timeline/stats)
tomotoken recalibrate  # recompute T0 calibration
tomotoken rescan       # re-ingest all logs from scratch
```

## Architecture

Five core domains flow left-to-right, plus subsystems for 3D rendering and LLM generation:

```
Ingestion → Progression → Personality → Art → UI
     ↕            ↕            ↕         ↕      ↕
                    JSON Store (3 files)

Subsystems: Generation, Art3D, Viewer, Sidecar, Encouragement, Window
```

### Core Domains

**Ingestion** (`src/ingestion/`) — Scans `~/.claude/projects/**/*.jsonl` (including `subagents/agent-*.jsonl`), parses Claude Code log entries, aggregates per-session token metrics. Supports incremental reads via byte offset tracking.

**Progression** (`src/progression/`) — Calibrates T0 from historical data (`M/4.75` where `M = monthly token estimate`), advances pet progress, handles completion overflow (one delta can complete multiple pets), resets spawn index on month boundaries.

**Personality** (`src/personality/`) — Classifies sessions into 8 categories via weighted scoring of 4 signals (file extensions, tool transitions, bash keywords, tool distribution). Computes depth/style metrics. Maps to 8 trait scores → archetype (highest) + subtype (second).

**Art** (`src/art/`) — Deterministic procedural ASCII art from SHA-256 seed → mulberry32 PRNG. Single parametric pipeline (`generateParametricBody`) produces unique creatures from continuous trait parameters. 4-frame idle animation (95%+ frame similarity), ANSI 256 color palettes via chalk.

**UI** (`src/ui/`) — Ink 5 (React for CLI) components: `App` (command dispatcher), `WatchApp` (live mode), `ZukanApp` (interactive encyclopedia). Main orchestrator at `src/index.ts`. CLI entry at `bin/tomotoken.ts` uses commander.

### Subsystems

**Generation** (`src/generation/`) — Optional LLM-based creature design via Claude API (`@anthropic-ai/sdk`). Generates detailed part hierarchies, expressions, and animations. Requires `ANTHROPIC_API_KEY`. Core CLI works without it.

**Art3D** (`src/art3d/`) — Style guide and prompt building for Hyper3D character generation. Defines `STYLE_SUFFIX` (Disney Pixar chibi style) and `buildModelPrompt()`. Post-processing via Blender lattice deformation for eye enlargement.

**Viewer** (`src/viewer/`) — WebGL 3D viewer. Express server on :3456 with WebSocket push. Three.js client renders creatures with toon shading, morph expressions, and animation mixer.

**Sidecar** (`src/sidecar/`) — CLI entry that runs full pipeline and outputs `PetRenderData` JSON for viewer consumption.

**Encouragement** (`src/encouragement/`) — Rate-based motivational messages. Triggered by tokens/hour threshold + cooldown. Used in watch mode.

**Window** (`src/window/`) — Cross-platform terminal window spawning for watch mode.

**Store** (`src/store/`) — JSON state persistence with atomic writes and file locking.

**Config** (`src/config/`) — Zod-validated configuration with defaults.

## Data Store

Three JSON files in `~/.tomotoken/`:
- `state.json` — Current pet (including `generatedDesigns`), calibration, ingestion byte offsets, global stats
- `collection.json` — Completed pets with frames, personality, seed
- `config.json` — User configuration (Zod-validated via `src/config/schema.ts`)

All state updates are **immutable** (spread-based, returning new objects). File writes use atomic rename (`write tmp → rename`).

## Claude Code Log Format

Location: `~/.claude/projects/{project-path}/{session-uuid}.jsonl`

Each line is JSON with `type` field: `assistant` (has `message.usage` with `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`; `message.content[]` with `tool_use`), `user` (has `toolUseResult` boolean), `progress`, `summary`, `file-history-snapshot`.

Token total = input + output + cache_creation + cache_read (all are API-billable).

## Key Design Constraints

- **Deterministic ASCII art**: Same seed + traits = identical procedural ASCII output (PRNG-based)
- **Non-deterministic 3D**: LLM-generated creature designs vary per API call (intentional)
- **Optional AI in Generation**: Claude API used only for creature design; core CLI works without it
- **Immutable data**: Never mutate — always create new objects via spread
- **Incremental ingestion**: Track byte offsets per file, only read new data

## Reference Documents

開発作業の前に必ず `docs/plans/` 配下のドキュメントを参照すること。

- **`spec.md`** — 要件定義の原本（v1 core scope）。v2 拡張（Generation, Viewer, Art3D）は spec に未反映
- **`codemaps/`** — アーキテクチャ・バックエンド・フロントエンド・データモデルの詳細マップ

## Testing

Tests live in `test/` mirroring `src/` structure. Fixtures in `test/fixtures/`. Tests use temp directories (`test/tmp-*`) cleaned up in afterEach. Coverage excludes `.tsx` files and `types.ts`.
