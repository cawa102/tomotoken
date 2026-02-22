# Runbook

> Auto-generated from `package.json` on 2026-02-22

## Build & Deploy

### Build

```bash
npm run build    # tsup → dist/
npm run typecheck # verify types
npm test         # verify tests
```

Output: `dist/bin/tomotoken.js` (CLI entry point)

### Install Locally

```bash
npm link         # symlinks 'tomotoken' command globally
tomotoken show   # verify it works
```

### Publish (npm)

```bash
npm run build && npm test
npm version patch|minor|major
npm publish
```

## Running

### CLI Commands

```bash
tomotoken              # show current pet (default)
tomotoken show         # display current pet
tomotoken stats        # token statistics
tomotoken collection   # list completed pets
tomotoken view <id>    # detailed pet view
tomotoken config       # show configuration
tomotoken watch        # live mode (polls every 5s)
tomotoken window       # spawn new terminal window
tomotoken zukan        # interactive encyclopedia
tomotoken recalibrate  # recompute T0 calibration
tomotoken rescan       # re-ingest all logs from scratch
```

### 3D Viewer

```bash
npm run dev:viewer     # starts Express + WebSocket on localhost:3456
```

Open `http://localhost:3456` in browser. Server pushes `PetRenderData` via WebSocket every 5 seconds.

Egg stages (0-3) render wobbling egg models. Stage 4 (hatched) renders the character model with animations.

### Sidecar

```bash
npm run sidecar        # outputs PetRenderData JSON to stdout
```

## Common Issues

### No pet displayed / "No sessions found"

**Cause**: No Claude Code logs exist yet or wrong log path.

**Fix**:
1. Check `~/.claude/projects/` contains `.jsonl` files
2. If custom path, verify `config.json` `logPath` setting
3. Run `tomotoken rescan` to re-ingest from scratch

### Calibration shows T0 = 0 or very large

**Cause**: Insufficient log history for accurate monthly estimate.

**Fix**: Use more Claude Code sessions. T0 formula is `ceil(M / 4.75)` where M = monthly token estimate. With few sessions, the estimate can be off.

### Pet stuck at 0% progress

**Cause**: Byte offsets may be ahead of actual file content (e.g., after log rotation).

**Fix**:
```bash
tomotoken rescan       # resets all offsets and re-reads everything
```

### State file corruption

**Cause**: Interrupted write (rare, since writes are atomic via tmp+rename).

**Fix**:
1. Back up `~/.tomotoken/state.json`
2. Delete it — a fresh state will be created on next run
3. Run `tomotoken rescan` to rebuild from logs

### Lock file prevents startup

**Cause**: Previous process crashed without releasing lock.

**Fix**: Delete `~/.tomotoken/tomotoken.lock`. Lock files older than 5 minutes are auto-stale.

### 3D Viewer: WebSocket disconnects

**Cause**: Server crashed or port conflict.

**Fix**:
1. Check if port 3456 is in use: `lsof -i :3456`
2. Restart: `npm run dev:viewer`

### Egg stuck at stage 0 / no wobble

**Cause**: Progress is 0 or `computeEggStage` receives invalid input.

**Fix**:
1. Check progress via `tomotoken stats`
2. If progress > 0 but stage 0, run `tomotoken rescan`
3. Verify viewer is receiving WebSocket updates (check browser console)

### Generation fails (ANTHROPIC_API_KEY)

**Cause**: `ANTHROPIC_API_KEY` not set or expired.

**Fix**:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run sidecar
```

Core CLI works without the API key — only LLM creature design requires it.

## Data Recovery

### Restore from collection

Collection is append-only. If `state.json` is lost, completed pets are safe in `collection.json`. The current in-progress pet will be lost but a new one spawns automatically.

### Full reset

```bash
rm -rf ~/.tomotoken/    # delete all state
tomotoken               # fresh start, re-ingests logs
```

## Monitoring

This is a local CLI tool — no server monitoring needed for core usage.

For 3D Viewer server:
- Health check: `curl http://localhost:3456/api/pet`
- WebSocket: connect to `ws://localhost:3456`
- Logs: stdout/stderr from `npm run dev:viewer`
