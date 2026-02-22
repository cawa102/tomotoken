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
npm start                   # Start web server on localhost:3456
```

## Architecture

Four core domains flow left-to-right, plus subsystems for 3D rendering and LLM generation:

```
Ingestion → Progression → Personality → Creature
     ↕            ↕            ↕           ↕
                    JSON Store (3 files)

Subsystems: Generation, Art3D, Viewer, Sidecar
```

### Core Domains

**Ingestion** (`src/ingestion/`) — Scans `~/.claude/projects/**/*.jsonl` (including `subagents/agent-*.jsonl`), parses Claude Code log entries, aggregates per-session token metrics. Supports incremental reads via byte offset tracking.

**Progression** (`src/progression/`) — Each pet requires a fixed `TOKENS_PER_PET` (1 billion tokens). Advances pet progress, handles completion overflow (one delta can complete multiple pets). Tracks egg stages (0–4) based on progress percentage.

**Personality** (`src/personality/`) — Classifies sessions into 8 categories via weighted scoring of 4 signals (file extensions, tool transitions, bash keywords, tool distribution). Computes depth/style metrics. Maps to 8 trait scores → archetype (highest) + subtype (second).

**Creature** (`src/creature/`) — Deterministic creature visual parameters from SHA-256 seed → mulberry32 PRNG. Derives body shape (head ratio, body width, limb stage), ANSI 256 color palettes, and progress-adjusted parameters. Exports `deriveCreatureParams`, `adjustParamsForProgress`, `generatePalette`, `paletteToHexArray`.

### Subsystems

**Generation** (`src/generation/`) — Optional LLM-based creature design via Claude API (`@anthropic-ai/sdk`) or OpenAI. Generates detailed part hierarchies, expressions, and animations. Requires API key. Core app works without it.

**Art3D** (`src/art3d/`) — Style guide and prompt building for Hyper3D character generation. Defines `STYLE_SUFFIX` (Disney Pixar chibi style) and `buildModelPrompt()`. Post-processing via Blender lattice deformation for eye enlargement.

**Viewer** (`src/viewer/`) — Express web server on :3456 with WebSocket push. Serves two pages: main page (current pet 3D viewer) and `/collection` (collection gallery). REST API endpoints:
- `GET /api/pet` — Current pet PetRenderData
- `GET /api/collection` — List of completed pets with summaries
- `GET /api/collection/:petId` — Completed pet detail
- `GET /api/collection/:petId/render` — PetRenderData for completed pet 3D viewer
- `GET/POST /api/snapshot/:petId` — PNG snapshot serve/save

Three.js client renders creatures with toon shading, morph expressions, animation mixer, and post-processing (bloom, FXAA).

**Sidecar** (`src/sidecar/`) — Runs full pipeline and builds `PetRenderData` JSON for viewer consumption.

**Store** (`src/store/`) — JSON state persistence with atomic writes and file locking.

**Config** (`src/config/`) — Zod-validated configuration with defaults. LLM provider abstraction supports Anthropic and OpenAI.

**First-Run** (`src/first-run/`) — Detects first launch, extracts recent token usage, and creates initial pet from existing Claude Code activity.

**Validation** (`src/validation/`) — Startup checks for API keys and Blender installation.

## Data Store

Three JSON files plus a snapshots directory in `~/.tomotoken/`:
- `state.json` — Current pet (including `generatedDesigns`), ingestion byte offsets, global stats
- `collection.json` — Completed pets with personality and seed
- `config.json` — User configuration (Zod-validated via `src/config/schema.ts`)
- `snapshots/` — PNG thumbnails of completed pets (captured client-side)

All state updates are **immutable** (spread-based, returning new objects). File writes use atomic rename (`write tmp → rename`).

## Claude Code Log Format

Location: `~/.claude/projects/{project-path}/{session-uuid}.jsonl`

Each line is JSON with `type` field: `assistant` (has `message.usage` with `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`; `message.content[]` with `tool_use`), `user` (has `toolUseResult` boolean), `progress`, `summary`, `file-history-snapshot`.

Token total = input + output + cache_creation + cache_read (all are API-billable).

## Key Design Constraints

- **Deterministic creature params**: Same seed + traits = identical visual parameters (PRNG-based)
- **Non-deterministic 3D**: LLM-generated creature designs vary per API call (intentional)
- **Optional AI in Generation**: LLM API used only for creature design; core app works without it
- **Immutable data**: Never mutate — always create new objects via spread
- **Incremental ingestion**: Track byte offsets per file, only read new data

## Reference Documents

開発作業の前に必ず以下のドキュメントを参照すること。

- **`spec.md`** — 要件定義（v3: Web-only architecture、全機能反映済み）
- **`codemaps/`** — アーキテクチャ・バックエンド・フロントエンド・データモデルの詳細マップ
- **`docs/plans/`** — 設計ドキュメントと実装計画

## Testing

Tests live in `test/` mirroring `src/` structure. Fixtures in `test/fixtures/`. Tests use temp directories (`test/tmp-*`) cleaned up in afterEach. Coverage excludes `types.ts`.
