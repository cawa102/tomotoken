# Contributing Guide

> Auto-generated from `package.json` on 2026-02-22

## Prerequisites

- Node.js >= 18
- npm

## Setup

```bash
git clone <repo-url>
cd tomotoken
npm install
```

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `npm run build` | `tsup` | Build project to `dist/` |
| `npm run dev` | `tsup --watch` | Build in watch mode |
| `npm start` | `node dist/bin/tomotoken.js` | Run CLI |
| `npm test` | `vitest run` | Run all tests |
| `npm run test:watch` | `vitest` | Tests in watch mode |
| `npm run test:coverage` | `vitest run --coverage` | Tests with 80% coverage thresholds |
| `npm run lint` | `eslint src/ bin/ --ext .ts,.tsx` | Lint source files |
| `npm run typecheck` | `tsc --noEmit` | Type check without emitting |
| `npm run dev:viewer` | `tsup + node` | Build and run 3D viewer server on :3456 |
| `npm run sidecar` | `tsup + node` | Build and run sidecar (outputs PetRenderData JSON) |

## Development Workflow

1. Create a feature branch from `main`
2. Write tests first (TDD: RED -> GREEN -> REFACTOR)
3. Implement changes
4. Run `npm test` — all tests must pass
5. Run `npm run typecheck` — no type errors
6. Commit with conventional format: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`

## Architecture

Five core domains flow left-to-right, plus subsystems:

```
Ingestion → Progression → Personality → Art → UI
     ↕            ↕            ↕         ↕      ↕
                    JSON Store (3 files)

Subsystems: Generation, Art3D, Viewer, Sidecar, Encouragement, Window
```

Each domain has a barrel export (`index.ts`) as its public API. See `codemaps/architecture.md` for details.

## Testing

- Framework: **vitest**
- Test directory: `test/` (mirrors `src/` structure)
- Fixtures: `test/fixtures/`
- Coverage target: **80%** (excludes `.tsx` and `types.ts`)
- Temp directories: `test/tmp-*` (cleaned in `afterEach`)

```bash
# Run single test file
npx vitest run test/ingestion/parser.test.ts

# Run with coverage
npm run test:coverage
```

## Key Constraints

- **Immutable data**: Never mutate — always spread to create new objects
- **No AI/network calls** in core domains (only in `src/generation/`)
- **Egg hatching**: 5-stage progression (EggStage 0-4: pristine → hatched)
- **3D pipeline**: Hyper3D generation → Blender post-processing → GLB → Three.js viewer
- **Incremental ingestion**: Track byte offsets, only read new data

## Dependencies

### Runtime

| Package | Purpose |
|---------|---------|
| `@anthropic-ai/sdk` | Claude API for creature design generation |
| `chalk` | ANSI 256 color output |
| `commander` | CLI argument parsing |
| `ink` + `react` | React-based CLI rendering |
| `three` | 3D viewer scene graph (used by viewer client) |
| `uuid` | Pet ID generation |
| `zod` | Config schema validation |

### Dev

| Package | Purpose |
|---------|---------|
| `express` + `ws` | 3D viewer server |
| `tsup` | Bundler |
| `typescript` | Type checking |
| `vitest` + `@vitest/coverage-v8` | Testing + coverage |
| `eslint` | Linting |

## Environment Variables

No environment variables are required for core functionality. The tool reads Claude Code logs from `~/.claude/projects/` and stores state in `~/.tomotoken/`.

Optional:
- `ANTHROPIC_API_KEY` — Required only for `src/generation/` (LLM creature design). Not needed for core CLI usage.

## Data Directories

| Path | Purpose |
|------|---------|
| `~/.tomotoken/state.json` | Current pet, calibration, ingestion offsets |
| `~/.tomotoken/collection.json` | Completed pets archive |
| `~/.tomotoken/config.json` | User configuration (optional) |
| `~/.claude/projects/` | Claude Code log files (read-only) |
