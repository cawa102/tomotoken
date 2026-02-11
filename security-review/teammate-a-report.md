# Teammate A Report: Static Analysis + IaC Inspection

**Date**: 2026-02-11
**Tool**: Semgrep v1.136.0 (OSS engine, `--config=auto`)
**Target**: Tomotoken CLI — 64 files (53 TypeScript, 6 JSON, 5 other)

---

## 1. Semgrep Results Summary

| Severity | Findings |
|----------|----------|
| Critical | 0 |
| High     | 0 |
| Medium   | 0 |
| Low      | 0 |
| **Total** | **0** |

**Rules evaluated**: 217 (166 TypeScript-specific + 48 multilang + 4 JSON)
**Files scanned**: 64
**Parse coverage**: ~100%

Raw JSON results saved to: `security-review/semgrep-results.json`

---

## 2. IaC Inspection (Checkov)

**Result: Skipped — No IaC files found.**

Verified absence of:
- `Dockerfile` / `docker-compose.yml` — not present
- `.github/workflows/*.yml` — no GitHub Actions (only `node_modules/` YAML files exist, which are third-party)
- `*.tf` / `*.tfvars` — no Terraform files
- `serverless.yml`, `k8s/`, `helm/` — none present

This is consistent with the project's design: a purely local CLI tool with no deployment infrastructure.

---

## 3. Manual Security Observations

Although Semgrep reported zero automated findings, a manual review of the 7 critical security-relevant files revealed the following observations:

### 3.1 Positive Security Patterns (Well-Implemented)

| Pattern | File | Detail |
|---------|------|--------|
| Symlink protection | `scanner.ts:28`, `incremental.ts:20-22` | Uses `lstatSync()` and skips symbolic links — mitigates symlink-based path traversal |
| Read size limit | `incremental.ts:10` | `MAX_READ_BYTES = 50MB` prevents unbounded memory allocation |
| Line size limit | `parser.ts:3` | `MAX_LINE_LENGTH = 1MB` rejects oversized lines before parsing |
| JSON parse safety | `parser.ts:11-13`, `store.ts:37-42`, `loader.ts:13-14` | All `JSON.parse()` calls wrapped in try/catch |
| Type whitelist | `parser.ts:19-20` | Only 5 known types accepted: `assistant`, `user`, `progress`, `summary`, `file-history-snapshot` |
| Atomic writes | `store.ts:25-31` | Temp file + rename pattern prevents data corruption on crash |
| Restrictive permissions | `store.ts:21,29` | Dirs: `0o700`, files: `0o600` — prevents other users from reading sensitive data |
| Schema validation | `loader.ts:14` | Config validated via Zod `ConfigSchema.parse()` before use |
| No shell execution | All files | Zero use of `child_process`, `exec`, `spawn`, `eval`, or `Function()` — eliminates command injection attack surface |
| Hardcoded paths | `constants.ts` | All file paths derived from `homedir()` + literal subpaths — no user-controlled path components |

### 3.2 Minor Observations (Informational, Not Vulnerabilities)

#### INFO-01: `saveConfig()` does not set restrictive file permissions
- **File**: `src/config/loader.ts:25`
- **Detail**: `writeFileSync(path, ..., "utf-8")` does not specify `mode: 0o600`, unlike `atomicWrite()` in `store.ts:29` which does.
- **Risk**: LOW — config.json typically contains non-sensitive preference data (animation speed, growth multiplier). Default umask usually restricts to `0o644`.
- **Recommendation**: For consistency, consider adding `{ mode: 0o600 }` to the `writeFileSync` options object.

#### INFO-02: `saveConfig()` does not use atomic write pattern
- **File**: `src/config/loader.ts:25`
- **Detail**: Direct `writeFileSync()` without the temp-file-rename pattern used in `store.ts`. A crash during write could leave a truncated config file.
- **Risk**: LOW — the loader gracefully falls back to `createDefaultConfig()` if parsing fails, so a corrupt file would not crash the app.
- **Recommendation**: Consider reusing the `atomicWrite()` helper from `store.ts` for consistency.

#### INFO-03: No path sanitization on `view <petId>` CLI argument
- **File**: `bin/tomotoken.ts:48-52`
- **Detail**: The `petId` string from CLI is passed to the React component. It is used as a lookup key against the in-memory collection, not for file operations.
- **Risk**: NONE — the value never touches the filesystem. Commander handles argument parsing safely.

---

## 4. Attack Surface Assessment

| Vector | Present? | Notes |
|--------|----------|-------|
| Network / HTTP | No | No server, no API calls, no outbound network |
| User input (CLI args) | Minimal | Only `view <petId>` accepts user input; used as in-memory lookup |
| External file parsing | Yes | Reads `~/.claude/projects/**/*.jsonl` — well-protected with size limits, try/catch, type whitelist |
| File writes | Yes | Writes to `~/.tomotoken/` — atomic writes, restrictive permissions |
| Shell execution | No | No child_process, exec, eval |
| Cryptography | Minimal | `crypto.randomBytes` for temp filenames (appropriate), SHA-256 for deterministic seed (non-security use) |
| Dependencies | See Teammate B | npm audit results handled separately |

---

## 5. Conclusion

**Overall risk: LOW.** Semgrep found zero automated findings across 217 rules. Manual review confirms strong defensive coding practices: symlink checks, size limits, atomic writes, restrictive file permissions, Zod validation, and zero shell execution. The two informational items (INFO-01, INFO-02) are minor consistency improvements, not security vulnerabilities. The application has a minimal attack surface by design — no network, no user-facing input beyond a single CLI argument used for in-memory lookup.
