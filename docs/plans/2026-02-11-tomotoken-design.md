# Tomotoken - Implementation Plan

## Context

spec.md based design decisions and implementation plan for the Tomotoken project.

## Confirmed Design Decisions

| Item | Decision |
|------|----------|
| Language | TypeScript (Node.js >= 18) |
| Distribution | npm package (`npx tomotoken`) |
| TUI | Ink 5 (React for CLI) |
| Data Store | JSON files x3 (config.json, state.json, collection.json) |
| Character | Abstract creatures, AA art grade, 24x12 canvas |
| Color | ANSI 256 colors (chalk) |
| Project Name | tomotoken |
| Log Scope | ~/.claude/projects/ entire + subagents/*.jsonl |
| T0 | Fixed value computed from developer logs (M / 4.75) |
| Watch | fs.watch (Node.js standard) |
| Completion Effect | Animated |
| Bundler | tsup |
| Test | vitest |
| CLI Parser | commander |

## Implementation Phases

### Phase 1: Foundation
Config + Store + Ingestion (parser, scanner, aggregator, incremental)

### Phase 2: Progression Engine
Calibration + Pet lifecycle + Monthly reset + Overflow

### Phase 3: Personality
Classifier + Depth + Style + Traits

### Phase 4: ASCII Art
Seed + Body + Motif + Animator + Color + Renderer

### Phase 5: CLI + Ink UI
8 commands + watch mode + completion animation

### Phase 6: Polish & Release
80%+ coverage + edge cases + README + npm publish config
