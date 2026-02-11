# Security Review Report: OWASP Logic Review

**Project:** Tomotoken CLI
**Reviewer:** Teammate C — OWASP Logic Review Specialist
**Date:** 2026-02-11
**Scope:** Manual code review of all source files against OWASP Top 10 categories

---

## Executive Summary

Tomotoken is a **local-only CLI tool** with no network server, no database, no authentication, and no user accounts. This dramatically reduces the OWASP attack surface. The codebase demonstrates generally good security practices: symlink rejection, atomic file writes with random suffixes, bounded read sizes, line-length limits, and Zod schema validation.

However, several issues were identified ranging from LOW to MEDIUM severity. No CRITICAL or HIGH issues were found — appropriate for a local CLI tool where the threat model is primarily malicious/corrupted local data.

### Finding Summary

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 0 | — |
| HIGH | 0 | — |
| MEDIUM | 3 | Config file permissions, logPath traversal, concurrent state corruption |
| LOW | 4 | JSON.parse prototype pollution (theoretical), unbounded collection growth, error swallowing, hostname in seed |
| INFO | 3 | N/A categories documented |

**Overall Risk Level:** 🟢 LOW

---

## MEDIUM Findings

### 1. [MEDIUM] Config File Written Without Restrictive Permissions

**Category:** Security Misconfiguration
**Location:** `src/config/loader.ts:20-26`

**Issue:**
`saveConfig()` creates the config file and directory without setting restrictive file permissions. While `store.ts:atomicWrite` correctly sets `mode: 0o600` on state/collection files and `mode: 0o700` on directories, `saveConfig()` uses the default `writeFileSync` with no `mode` option and `mkdirSync` without a `mode` option.

```typescript
// src/config/loader.ts:20-26
export function saveConfig(config: Config, path: string = CONFIG_PATH): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true }); // No mode: 0o700
  }
  writeFileSync(path, JSON.stringify(config, null, 2), "utf-8"); // No mode: 0o600
}
```

Compare with the secure pattern in `store.ts`:
```typescript
// store.ts:21-22 (GOOD)
mkdirSync(dir, { recursive: true, mode: 0o700 });
writeFileSync(tmpPath, JSON.stringify(data, null, 2), { encoding: "utf-8", mode: 0o600 });
```

**Impact:**
Config file (`~/.tomotoken/config.json`) may be world-readable depending on umask. The config contains `logPath` which reveals the user's filesystem structure. While `privacy.storeRawMessages` exists as a config option, the config file itself could leak information about the user's preferences.

**Recommended Fix:**
```typescript
export function saveConfig(config: Config, path: string = CONFIG_PATH): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  writeFileSync(path, JSON.stringify(config, null, 2), { encoding: "utf-8", mode: 0o600 });
}

export function ensureDataDir(): void {
  if (!existsSync(TOMOTOKEN_DIR)) {
    mkdirSync(TOMOTOKEN_DIR, { recursive: true, mode: 0o700 });
  }
}
```

**⚠️ Needs Human Review** — Determine if `config.json` contents are sensitive enough to warrant restricted permissions.

---

### 2. [MEDIUM] Unsanitized `logPath` Config Enables Directory Traversal

**Category:** Path Traversal / Local File Inclusion (A01:2021)
**Location:** `src/index.ts:20-21`, `src/config/schema.ts:13`

**Issue:**
The `logPath` config value is a `z.string().optional()` with no path validation. It flows directly from the config file into `scanLogFiles()` without any sanitization:

```typescript
// src/index.ts:20
const logDir = config.logPath ?? CLAUDE_PROJECTS_DIR;
const files = scanLogFiles(logDir);
```

The `expandHome()` utility exists in `src/utils/path.ts` but is **never called** on `logPath`. A user (or attacker who modifies `config.json`) could set `logPath` to any directory like `/etc`, `/`, or `../../sensitive/dir`.

While `scanLogFiles` only reads `.jsonl` files and the tool is local-only (the user can already read any file they have access to), this violates the principle of least privilege — the tool should only scan Claude Code log directories.

**Impact:**
- If `config.json` is writable by another user (see Finding #1), they could point `logPath` to a directory containing crafted `.jsonl` files designed to exploit the parser.
- The recursive `walk()` function would enumerate directory structures, potentially causing performance issues on large filesystem trees.
- In a multi-user system, could be used to confirm existence of directories the tool shouldn't know about.

**Proof of Concept:**
```json
// ~/.tomotoken/config.json
{
  "logPath": "/tmp/attacker-controlled/.jsonl-files/"
}
```

**Recommended Fix:**
```typescript
// In config/schema.ts, add validation:
logPath: z.string().optional().refine(
  (p) => !p || (p.startsWith(homedir()) || p.startsWith("~/")),
  "logPath must be within home directory"
),
```

**⚠️ Needs Human Review** — Assess whether restricting `logPath` to home directory is acceptable for all use cases.

---

### 3. [MEDIUM] Race Condition in Concurrent State File Writes

**Category:** Race Conditions (TOCTOU)
**Location:** `src/store/store.ts:25-31`

**Issue:**
The `atomicWrite` function uses a random suffix for temp file names, and `renameSync` provides atomic replacement on the same filesystem. However, if two Tomotoken processes run concurrently (e.g., user runs `tomotoken show` in two terminals), both will:

1. `loadState()` — read the same state
2. Process independently
3. `saveState()` — last writer wins, potentially losing data from the first writer

```typescript
// src/index.ts:176-177 - Both processes would execute this
saveState(state);
saveCollection(collection);
```

There is no file locking mechanism (e.g., `flock`, `lockfile`, `proper-lockfile`).

**Impact:**
- Lost ingestion progress (byte offsets reset to earlier values)
- Duplicate pet completions if both processes advance past the completion threshold
- Corrupted global stats (token counts could be counted multiple times or lost)

**Recommended Fix:**
```typescript
import { openSync, closeSync, flockSync } from "node:fs";

function withFileLock<T>(lockPath: string, fn: () => T): T {
  const fd = openSync(lockPath, "w");
  try {
    // Use advisory lock
    flockSync(fd, "ex"); // Exclusive lock
    return fn();
  } finally {
    flockSync(fd, "un");
    closeSync(fd);
  }
}
```

Alternatively, use `proper-lockfile` npm package for cross-platform support.

**⚠️ Needs Human Review** — Assess likelihood of concurrent usage. CLI tools are often run in single-instance scenarios, so this may be acceptable risk.

---

## LOW Findings

### 4. [LOW] JSON.parse on Untrusted Data — Theoretical Prototype Pollution

**Category:** Injection (A03:2021)
**Location:** `src/ingestion/parser.ts:11`, `src/store/store.ts:39`, `src/config/loader.ts:13`

**Issue:**
Three locations use `JSON.parse` on external data:

1. **`parser.ts:11`** — Parses JSONL lines from Claude Code log files
2. **`store.ts:39`** — Parses state/collection JSON (tool's own output)
3. **`loader.ts:13`** — Parses user-editable config.json

`JSON.parse` in modern V8/Node.js does **not** set `__proto__` as an own property in the standard way that causes prototype pollution. However, the parsed objects are then spread into new objects (`{ ...state, ...update }`), which copies all enumerable own properties.

```typescript
// parser.ts:11
raw = JSON.parse(line); // line from external JSONL file
```

The parsed data is used via property access with string keys (`raw.type`, `raw.message`, etc.) — not via `Object.keys()` iteration that would surface `__proto__`.

**Impact:**
Theoretical. Modern Node.js (v18+) handles `JSON.parse('{"__proto__": {"polluted": true}}')` safely — it creates an own property `__proto__` that doesn't affect the prototype chain. The spread patterns used subsequently are also safe. This is a defense-in-depth concern rather than an exploitable vulnerability.

**Recommended Fix (Optional):**
No fix needed for current Node.js versions. For defense-in-depth:
```typescript
// Optional: Use Object.create(null) based parsing
function safeParse(text: string): Record<string, unknown> | null {
  const parsed = JSON.parse(text);
  return Object.assign(Object.create(null), parsed);
}
```

---

### 5. [LOW] Unbounded Collection Growth

**Category:** Denial of Service
**Location:** `src/store/store.ts:104-112`

**Issue:**
`addCompletedPet()` appends pets to the collection indefinitely. Over months/years of use, `collection.json` could grow very large since each `CompletedPet` includes full ASCII art frames (4 frames × canvas lines).

```typescript
export function addCompletedPet(collection: Collection, pet: CompletedPet): Collection {
  return {
    ...collection,
    pets: [...collection.pets, pet],  // Unbounded growth
  };
}
```

Each completed pet stores `frames` (4 × 12 lines) and `colorFrames` (4 × 12 lines with ANSI codes), which could be ~5-10KB per pet.

**Impact:**
After hundreds of pets, `collection.json` could reach several MB. `loadCollection()` reads the entire file synchronously into memory. For a CLI tool this is unlikely to cause real issues, but it violates the principle of bounded resource usage.

**Recommended Fix (Optional):**
```typescript
const MAX_COLLECTION_SIZE = 500;

export function addCompletedPet(collection: Collection, pet: CompletedPet): Collection {
  const pets = [...collection.pets, pet];
  return {
    ...collection,
    pets: pets.length > MAX_COLLECTION_SIZE ? pets.slice(-MAX_COLLECTION_SIZE) : pets,
  };
}
```

---

### 6. [LOW] Silent Error Swallowing in Config and State Loading

**Category:** Insufficient Logging & Monitoring (A09:2021)
**Location:** `src/config/loader.ts:15`, `src/store/store.ts:41`

**Issue:**
Both `loadConfig()` and `readJson()` catch all errors silently and return defaults:

```typescript
// loader.ts:15
} catch (_err) {
  return createDefaultConfig();  // Silently ignores parse errors
}

// store.ts:41
} catch {
  return null;  // Silently ignores corrupted state
}
```

If `config.json` or `state.json` becomes corrupted (disk error, partial write from a crash), the tool silently resets to defaults. The user loses all configuration and state without any indication.

**Impact:**
- User may not realize their config has been silently reset
- Lost ingestion progress means re-scanning all files
- No forensic trail of what went wrong

**Recommended Fix:**
```typescript
export function loadConfig(path: string = CONFIG_PATH): Config {
  if (!existsSync(path)) {
    return createDefaultConfig();
  }
  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw);
    return ConfigSchema.parse(parsed);
  } catch (err) {
    console.error(`Warning: Failed to parse ${path}, using defaults: ${err instanceof Error ? err.message : String(err)}`);
    return createDefaultConfig();
  }
}
```

---

### 7. [LOW] Hostname Used in Deterministic Seed Generation

**Category:** Sensitive Data Exposure (A02:2021)
**Location:** `src/art/seed.ts:4-8`, `src/ui/components/PetView.tsx:24`

**Issue:**
The hostname is used as part of the pet art seed:

```typescript
export function generateSeed(machineId?: string, petId?: string): string {
  const machine = machineId ?? hostname();
  return sha256(`${machine}:${pet}`);
}
```

The hostname is hashed via SHA-256 before use, so it's not directly recoverable from the seed. However, if the seed is ever logged, shared, or stored alongside other metadata, the hostname could potentially be brute-forced from the hash for common hostname patterns.

The seed is stored in `collection.json` (`CompletedPet.seed`):
```typescript
return { ...pet, frames: art.frames, colorFrames: art.colorFrames, seed };
```

**Impact:**
Very low. SHA-256 is one-way, and the seed also includes the pet UUID, making rainbow table attacks impractical. However, the hostname does get baked into a persistent artifact.

**Recommended Fix:**
No code change recommended. This is an informational finding. If the user shares their `collection.json`, the hostname cannot be practically recovered from the seed hash.

---

## N/A Categories (Not Applicable)

### A07:2021 — Cross-Site Scripting (XSS)
**N/A.** Tomotoken is a CLI application using Ink (React for terminals). There is no HTML output, no web browser, and no DOM. Terminal output is plain text + ANSI codes via chalk. XSS is not possible.

### A02:2021 — Broken Authentication / A01:2021 — Broken Access Control / A08:2021 — CSRF
**N/A.** Tomotoken has no authentication system, no user accounts, no sessions, no HTTP endpoints, and no network communication. Access control is entirely delegated to filesystem permissions (the user running the CLI tool).

### A05:2021 — XML External Entities (XXE) / SSRF
**N/A.** Tomotoken does not parse XML and makes no outbound network requests. All data is local JSON/JSONL files.

---

## Positive Security Practices Observed

The codebase demonstrates several commendable security patterns:

### 1. Symlink Rejection (GOOD)
Both `scanner.ts:28` and `incremental.ts:20-22` use `lstatSync()` and explicitly reject symlinks:
```typescript
if (st.isSymbolicLink()) continue;        // scanner.ts:28
if (st.isSymbolicLink()) return { ... };   // incremental.ts:20-22
```
This prevents symlink-based directory traversal attacks where an attacker places symlinks in the log directory pointing to sensitive files.

### 2. Bounded Read Size (GOOD)
`incremental.ts:10` caps reads at 50MB per cycle:
```typescript
const MAX_READ_BYTES = 50 * 1024 * 1024; // 50 MB per read cycle
```

### 3. Line Length Limit (GOOD)
`parser.ts:7` rejects lines over 1MB:
```typescript
const MAX_LINE_LENGTH = 1_000_000; // 1MB per line
```
This prevents JSON bomb attacks via a single crafted JSONL line.

### 4. Atomic File Writes (GOOD)
`store.ts:25-31` uses temp files with random suffixes and `renameSync`:
```typescript
const suffix = randomBytes(6).toString("hex");
const tmpPath = `${filePath}.${suffix}.tmp`;
writeFileSync(tmpPath, ...);
renameSync(tmpPath, filePath);
```
This prevents partial writes from corrupting state files.

### 5. Restrictive File Permissions on State Files (GOOD)
`store.ts:22,29` sets `0o700` for directories and `0o600` for files.

### 6. Zod Schema Validation (GOOD)
`config/schema.ts` validates config with typed constraints (min/max for numbers, enum for strings), preventing arbitrary config values from causing unexpected behavior.

### 7. Immutable Data Patterns (GOOD)
All state updates use spread operators returning new objects. Types use `readonly` consistently. This prevents accidental mutation bugs.

### 8. Graceful Error Handling in File Operations (GOOD)
`scanner.ts` and `incremental.ts` wrap file operations in try/catch and gracefully skip unreadable files rather than crashing.

### 9. No Shell Execution (GOOD)
The CLI uses Commander.js for argument parsing. No user input reaches `exec()`, `spawn()`, or any shell execution function. Command injection is not possible.

### 10. No eval/Function Constructor (GOOD)
No dynamic code execution patterns were found anywhere in the codebase.

---

## Security Checklist

- [x] No hardcoded secrets
- [x] No shell execution from user input
- [x] No eval/Function constructor
- [x] No network requests
- [x] Symlinks rejected in file scanning
- [x] Read sizes bounded
- [x] JSON line length bounded
- [x] Atomic file writes for state
- [x] Zod validation on config
- [x] Immutable data patterns
- [x] Restrictive permissions on state files (0o600)
- [ ] Restrictive permissions on config file (uses default) — **Finding #1**
- [ ] logPath validated/sanitized — **Finding #2**
- [ ] File locking for concurrent access — **Finding #3**
- [x] No prototype pollution risk (modern Node.js)
- [x] Commander.js handles CLI args safely
- [x] No sensitive data in error messages

---

## Recommendations

1. **Fix Finding #1** (MEDIUM) — Add `mode: 0o600` to `saveConfig()` and `mode: 0o700` to `ensureDataDir()`. Simple one-line changes.
2. **Fix Finding #2** (MEDIUM) — Add path validation to `logPath` in the Zod schema, or at minimum call `expandHome()` and resolve it.
3. **Consider Finding #3** (MEDIUM) — Add file locking if concurrent usage is expected. Otherwise, document single-instance assumption.
4. **Fix Finding #6** (LOW) — Add `console.error` warnings when config/state parsing fails silently.
5. **No action needed** for Findings #4, #5, #7 — theoretical or very low impact.

---

> Security review performed by Claude Code security-reviewer agent (Teammate C — OWASP Logic Review)
