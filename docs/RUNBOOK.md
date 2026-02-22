# Runbook

> Auto-generated from `package.json` on 2026-02-22

## Build & Start

### Build

```bash
npm run build    # tsup -> dist/
npm run typecheck # verify types
npm test         # verify tests (325 tests, 55 files)
```

Output: `dist/bin/tomotoken.js` (server entry point)

### Start

```bash
npm start        # Express + WebSocket on localhost:3456
```

Open `http://localhost:3456` in browser.

- Main page (`/`): 3D pet viewer with personality radar chart and progress bar
- Collection page (`/collection`): Card grid of completed pets with modal detail

Server pushes `PetRenderData` via WebSocket every 5 seconds. Egg stages (0-3) render wobbling egg models. Stage 4 (hatched) renders the character model with animations.

### Install Globally

```bash
npm link         # symlinks 'tomotoken' command globally
tomotoken        # starts web server
```

## Common Issues

### No pet displayed / "No sessions found"

**Cause**: No Claude Code logs exist yet or wrong log path.

**Fix**:
1. Check `~/.claude/projects/` contains `.jsonl` files
2. If custom path, verify `~/.tomotoken/config.json` settings
3. Delete `~/.tomotoken/state.json` to re-ingest from scratch

### Pet stuck at 0% progress

**Cause**: Byte offsets may be ahead of actual file content (e.g., after log rotation).

**Fix**:
1. Delete `~/.tomotoken/state.json`
2. Restart: `npm start` (re-ingests all logs)

### State file corruption

**Cause**: Interrupted write (rare, since writes are atomic via tmp+rename).

**Fix**:
1. Back up `~/.tomotoken/state.json`
2. Delete it -- a fresh state will be created on next run
3. Restart the server to rebuild from logs

### Lock file prevents startup

**Cause**: Previous process crashed without releasing lock.

**Fix**: Delete `~/.tomotoken/tomotoken.lock`. Lock files older than 5 minutes are auto-stale.

### Port 3456 already in use

**Cause**: Another process or previous server instance using the port.

**Fix**:
```bash
lsof -ti:3456 | xargs kill    # kill existing process
npm start                       # restart
```

Or set a different port:
```bash
VIEWER_PORT=4000 npm start
```

### WebSocket disconnects / "Disconnected" in UI

**Cause**: Server crashed or network interruption.

**Fix**:
1. Check server console for errors
2. Restart: `npm start`
3. The client auto-reconnects with exponential backoff (1s -> 30s max)

### Egg stuck at stage 0 / no wobble

**Cause**: Progress is 0 or no new log data.

**Fix**:
1. Check `/api/pet` response: `curl http://localhost:3456/api/pet | jq .progress`
2. If progress > 0 but stage 0, restart the server
3. Verify viewer is receiving WebSocket updates (check browser console)

### Generation fails (API key)

**Cause**: `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` not set or expired.

**Fix**:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm start
```

Core app works without the API key -- only LLM creature design requires it.

### Collection page empty

**Cause**: No pets have completed yet (each pet requires ~1 billion tokens).

**Fix**: This is expected for new users. Keep using Claude Code and your pet will eventually hatch and complete.

## Data Recovery

### Restore from collection

Collection is append-only. If `state.json` is lost, completed pets are safe in `collection.json`. The current in-progress pet will be lost but a new one spawns automatically.

### Full reset

```bash
rm -rf ~/.tomotoken/    # delete all state
npm start               # fresh start, re-ingests logs
```

## Monitoring

Health check endpoints:
- `GET http://localhost:3456/api/pet` -- current pet data
- `GET http://localhost:3456/api/collection` -- completed pets
- WebSocket: connect to `ws://localhost:3456`
- Server logs: stdout/stderr from `npm start`
