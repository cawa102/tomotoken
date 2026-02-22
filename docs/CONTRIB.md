# Contributing Guide

> Auto-generated from `package.json` on 2026-02-22

## Prerequisites

- Node.js >= 18
- npm

Optional (for 3D model generation):
- Blender 4.x+ in PATH
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` environment variable

## Setup

```bash
git clone <repo-url>
cd tomotoken
npm install
npm run build
```

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `npm run build` | `tsup` | Build project to `dist/` |
| `npm run dev` | `tsup --watch` | Build in watch mode |
| `npm start` | `node dist/bin/tomotoken.js` | Start web server on localhost:3456 |
| `npm test` | `vitest run` | Run all tests |
| `npm run test:watch` | `vitest` | Tests in watch mode |
| `npm run test:coverage` | `vitest run --coverage` | Tests with 80% coverage thresholds |
| `npm run lint` | `eslint src/ bin/ --ext .ts,.tsx` | Lint source files |
| `npm run typecheck` | `tsc --noEmit` | Type check without emitting |

## Development Workflow

1. Create a feature branch from `main`
2. Write tests first (TDD: RED -> GREEN -> REFACTOR)
3. Implement changes
4. Run `npm test` -- all tests must pass
5. Run `npm run typecheck` -- no type errors
6. Commit with conventional format: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`

## Architecture

Four core domains flow left-to-right, plus subsystems:

```
Ingestion -> Progression -> Personality -> Creature
     |             |             |            |
                    JSON Store (3 files)

Subsystems: Generation, Art3D, Viewer, Sidecar, First-Run, Validation
```

Each domain has a barrel export (`index.ts`) as its public API. See `codemaps/architecture.md` for details.

## Pages

| Page | URL | Purpose |
|------|-----|---------|
| Main | `/` | 3D pet viewer with radar chart and progress bar |
| Collection | `/collection` | Card grid of completed pets with modal detail |

## Testing

- Framework: **vitest**
- Test directory: `test/` (mirrors `src/` structure)
- Fixtures: `test/fixtures/`
- Coverage target: **80%** (excludes `types.ts`)
- Temp directories: `test/tmp-*` (cleaned in `afterEach`)

```bash
# Run single test file
npx vitest run test/ingestion/parser.test.ts

# Run with coverage
npm run test:coverage
```

## Key Constraints

- **Immutable data**: Never mutate -- always spread to create new objects
- **No AI/network calls** in core domains (only in `src/generation/`)
- **Egg hatching**: 5-stage progression (EggStage 0-4: pristine -> hatched)
- **3D pipeline**: Hyper3D generation -> Blender post-processing -> GLB -> Three.js viewer
- **Incremental ingestion**: Track byte offsets, only read new data
- **Web-only**: Single `npm start` launches Express server, no CLI commands

## Dependencies

### Runtime

| Package | Purpose |
|---------|---------|
| `@anthropic-ai/sdk` | Claude API for creature design generation |
| `express` | Web server (API routes + static files) |
| `openai` | OpenAI API alternative for creature design |
| `three` | 3D viewer scene graph (client-side, bundled via CDN import map) |
| `uuid` | Pet ID generation |
| `ws` | WebSocket server for real-time pet data push |
| `zod` | Config schema validation |

### Dev

| Package | Purpose |
|---------|---------|
| `tsup` | Bundler (ESM output) |
| `typescript` | Type checking |
| `vitest` + `@vitest/coverage-v8` | Testing + coverage |
| `eslint` | Linting |

## Environment Variables

No environment variables are required for core functionality. The web server reads Claude Code logs from `~/.claude/projects/` and stores state in `~/.tomotoken/`.

Optional:
- `ANTHROPIC_API_KEY` -- LLM creature design via Anthropic Claude
- `OPENAI_API_KEY` -- LLM creature design via OpenAI (alternative)
- `VIEWER_PORT` -- Web server port (default: 3456)

## Data Directories

| Path | Purpose |
|------|---------|
| `~/.tomotoken/state.json` | Current pet, ingestion offsets, global stats |
| `~/.tomotoken/collection.json` | Completed pets archive |
| `~/.tomotoken/config.json` | User configuration (optional) |
| `~/.tomotoken/snapshots/` | PNG thumbnails of completed pets |
| `~/.claude/projects/` | Claude Code log files (read-only) |
