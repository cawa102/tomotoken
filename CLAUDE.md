# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Tomotoken is a CLI tool that visualizes Claude Code token usage as a growing ASCII pet character. Pets accumulate tokens from local Claude Code logs, grow procedurally-generated ASCII art bodies, develop personality traits from usage patterns, and enter a collection when complete. No AI calls, no network — purely local.

## Commands

```bash
npm test                    # Run all tests (vitest)
npm run test:watch          # Watch mode
npm run test:coverage       # With 80% coverage thresholds
npx vitest run test/ingestion/parser.test.ts  # Single test file
npm run build               # Build with tsup → dist/
npm run typecheck           # tsc --noEmit
npm start                   # Run CLI (node dist/bin/tomotoken.js)
```

## Architecture

Five domains flow left-to-right, communicating only via barrel exports (`index.ts`):

```
Ingestion → Progression → Personality → Art → UI
     ↕            ↕            ↕         ↕      ↕
                    JSON Store (3 files)
```

**Ingestion** (`src/ingestion/`) — Scans `~/.claude/projects/**/*.jsonl` (including `subagents/agent-*.jsonl`), parses Claude Code log entries, aggregates per-session token metrics. Supports incremental reads via byte offset tracking.

**Progression** (`src/progression/`) — Calibrates T0 from historical data (`M/4.75` where `M = monthly token estimate`), advances pet progress, handles completion overflow (one delta can complete multiple pets), resets spawn index on month boundaries.

**Personality** (`src/personality/`) — Classifies sessions into 8 categories via weighted scoring of 4 signals (file extensions, tool transitions, bash keywords, tool distribution). Computes depth/style metrics. Maps to 8 trait scores → archetype (highest) + subtype (second).

**Art** (`src/art/`) — Deterministic procedural ASCII art from SHA-256 seed → mulberry32 PRNG. 8 archetype body generators, motif overlays, 4-frame idle animation (95%+ frame similarity), ANSI 256 color palettes via chalk.

**UI** (`src/ui/`) — Ink 5 (React for CLI) components. Main orchestrator at `src/index.ts` ties everything together. CLI entry at `bin/tomotoken.ts` uses commander.

## Data Store

Three JSON files in `~/.tomotoken/`:
- `state.json` — Current pet, calibration, ingestion byte offsets, global stats
- `collection.json` — Completed pets with frames, personality, seed
- `config.json` — User configuration (Zod-validated via `src/config/schema.ts`)

All state updates are **immutable** (spread-based, returning new objects). File writes use atomic rename (`write tmp → rename`).

## Claude Code Log Format

Location: `~/.claude/projects/{project-path}/{session-uuid}.jsonl`

Each line is JSON with `type` field: `assistant` (has `message.usage` with `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`; `message.content[]` with `tool_use`), `user` (has `toolUseResult` boolean), `progress`, `summary`, `file-history-snapshot`.

Token total = input + output + cache_creation + cache_read (all are API-billable).

## Key Design Constraints

- **Deterministic**: Same logs + same config = identical pet sequence and art output
- **No AI/network calls**: Everything is local heuristic-based
- **Immutable data**: Never mutate — always create new objects via spread
- **Incremental ingestion**: Track byte offsets per file, only read new data

## Reference Documents

開発作業の前に必ず `docs/plans/` 配下のドキュメントを参照すること。

- **`spec.md`** — 要件定義の原本。仕様の判断に迷ったらここを参照
- **`docs/plans/2026-02-11-tomotoken-impl.md`** — 21タスクのTDD実装計画。各タスクにテストコード・実装コード・コミットメッセージが記載済み。新規実装時はこの計画のタスク順序に従う
- **`docs/plans/2026-02-11-tomotoken-design.md`** — 技術スタック・設計判断のサマリー

## Testing

Tests live in `test/` mirroring `src/` structure. Fixtures in `test/fixtures/`. Tests use temp directories (`test/tmp-*`) cleaned up in afterEach. Coverage excludes `.tsx` files and `types.ts`.
