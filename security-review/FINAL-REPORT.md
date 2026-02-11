# Tomotoken Security Review — Final Consolidated Report

**Date:** 2026-02-11
**Target:** Tomotoken CLI (TypeScript/Node.js)
**Branch:** main
**Commit:** dd70f0c
**Reviewers:** 3-agent parallel security team (Semgrep, Supply Chain, OWASP Logic)

---

## Verdict: **Approve with Changes**

The project has a strong security posture for a local-only CLI tool. No CRITICAL or HIGH vulnerabilities found. 3 MEDIUM issues should be addressed before production release.

---

## Category Status Overview

| Category | Status | Source |
|----------|--------|--------|
| Static Analysis (Semgrep) | Pass | Teammate A |
| IaC Configuration | N/A | Teammate A (no IaC files) |
| Known CVEs (npm audit) | Pass | Teammate B |
| License Compliance | Pass | Teammate B |
| Secret Detection | Pass | Teammate B |
| Injection | Pass | Teammate C |
| Path Traversal | Warning | Teammate C (Finding #2) |
| Security Misconfiguration | Warning | Teammates A+C (Finding #1) |
| Race Conditions | Warning | Teammate C (Finding #3) |
| Sensitive Data Exposure | Pass | Teammate C |
| XSS / CSRF / Auth | N/A | Local CLI tool |
| XXE / SSRF | N/A | No XML, no network |

---

## Issue Summary

| # | Severity | Title | Source | Status |
|---|----------|-------|--------|--------|
| 1 | MEDIUM | Config file permissions not restrictive | A + C | Fix recommended |
| 2 | MEDIUM | Unsanitized logPath enables directory traversal | C | Fix recommended |
| 3 | MEDIUM | Race condition on concurrent state writes | C | Fix recommended |
| 4 | LOW | JSON.parse prototype pollution (theoretical) | C | No action needed |
| 5 | LOW | Unbounded collection growth | C | Optional fix |
| 6 | LOW | Silent error swallowing in config/state loading | C | Optional fix |
| 7 | LOW | Hostname in deterministic seed | C | No action needed |
| 8 | INFO | No .env pattern in .gitignore | B | Recommended |
| 9 | INFO | OSV-Scanner not installed | B | Recommended for CI |
| 10 | INFO | TruffleHog not installed | B | Recommended for CI |
| 11 | INFO | saveConfig() lacks atomic write pattern | A | Consistency improvement |

---

## Issue Details

### 1. [MEDIUM] Config File Written Without Restrictive Permissions

**Detecting Teammate:** A (INFO-01) + C (Finding #1) — C is authoritative (deeper analysis)
**Location:** `src/config/loader.ts:20-26`
**CWE:** CWE-732 (Incorrect Permission Assignment for Critical Resource)
**OWASP:** A05:2021 — Security Misconfiguration

**Impact:** Config file (`~/.tomotoken/config.json`) may be world-readable depending on umask. Contains `logPath` revealing filesystem structure and user preferences.

**Remediation:**
```typescript
export function saveConfig(config: Config, path: string = CONFIG_PATH): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  writeFileSync(path, JSON.stringify(config, null, 2), { encoding: "utf-8", mode: 0o600 });
}
```

---

### 2. [MEDIUM] Unsanitized logPath Config Enables Directory Traversal

**Detecting Teammate:** C (Finding #2) — **Needs Human Review**
**Location:** `src/index.ts:20-21`, `src/config/schema.ts:13`
**CWE:** CWE-22 (Improper Limitation of a Pathname to a Restricted Directory)
**OWASP:** A01:2021 — Broken Access Control

**Impact:** A malicious or corrupted config could redirect the scanner to arbitrary directories. Combined with Finding #1 (world-writable config), another user could manipulate the scan path. The `expandHome()` utility exists but is never called on `logPath`.

**Remediation:**
```typescript
// In config/schema.ts:
logPath: z.string().optional().refine(
  (p) => !p || (p.startsWith(homedir()) || p.startsWith("~/")),
  "logPath must be within home directory"
),

// In index.ts, use expandHome():
const logDir = expandHome(config.logPath ?? CLAUDE_PROJECTS_DIR);
```

---

### 3. [MEDIUM] Race Condition in Concurrent State File Writes

**Detecting Teammate:** C (Finding #3) — **Needs Human Review**
**Location:** `src/store/store.ts:25-31`, `src/index.ts:176-177`
**CWE:** CWE-362 (Concurrent Execution using Shared Resource with Improper Synchronization)
**OWASP:** Race Conditions

**Impact:** If two `tomotoken` processes run simultaneously, last-writer-wins could lose ingestion progress, duplicate pet completions, or corrupt global stats. No file locking mechanism exists.

**Remediation:**
Option A: Add advisory file locking with `proper-lockfile` npm package.
Option B: Document single-instance assumption and add a PID lockfile check at startup.

---

### 4. [LOW] JSON.parse Prototype Pollution — Theoretical

**Detecting Teammate:** C (Finding #4)
**Location:** `src/ingestion/parser.ts:11`, `src/store/store.ts:39`, `src/config/loader.ts:13`
**CWE:** CWE-1321 (Improperly Controlled Modification of Object Prototype Attributes)

**Impact:** None on Node.js 18+. Modern V8 handles `JSON.parse` safely. Defense-in-depth only.

**Remediation:** No action needed.

---

### 5. [LOW] Unbounded Collection Growth

**Detecting Teammate:** C (Finding #5)
**Location:** `src/store/store.ts:104-112`
**CWE:** CWE-770 (Allocation of Resources Without Limits or Throttling)

**Impact:** Over years of use, `collection.json` could grow to several MB. Each pet includes 4 ASCII art frames. Unlikely to cause real issues for a CLI tool.

**Remediation (Optional):**
```typescript
const MAX_COLLECTION_SIZE = 500;
const pets = [...collection.pets, pet];
// Trim oldest if exceeding cap
```

---

### 6. [LOW] Silent Error Swallowing in Config and State Loading

**Detecting Teammate:** C (Finding #6)
**Location:** `src/config/loader.ts:15`, `src/store/store.ts:41`
**CWE:** CWE-755 (Improper Handling of Exceptional Conditions)

**Impact:** Corrupted config/state files silently reset to defaults. User loses configuration and ingestion progress without any indication.

**Remediation (Optional):**
```typescript
} catch (err) {
  console.error(`Warning: Failed to parse ${path}, using defaults: ${err instanceof Error ? err.message : String(err)}`);
  return createDefaultConfig();
}
```

---

### 7. [LOW] Hostname Used in Deterministic Seed

**Detecting Teammate:** C (Finding #7)
**Location:** `src/art/seed.ts:4-8`
**CWE:** CWE-200 (Exposure of Sensitive Information to an Unauthorized Actor)

**Impact:** Hostname is SHA-256 hashed with pet UUID — not practically recoverable. Very low risk.

**Remediation:** No action needed.

---

### 8-11. [INFO] Operational Recommendations

| # | Recommendation | Action |
|---|---------------|--------|
| 8 | Add `.env*` to `.gitignore` | Defensive — no env files exist |
| 9 | Install OSV-Scanner | Broader CVE coverage in CI |
| 10 | Install TruffleHog | Automated secret scanning in CI |
| 11 | Use atomic write in `saveConfig()` | Consistency with `store.ts` pattern |

---

## Duplicate Resolution

| Finding | Teammate A | Teammate C | Authority |
|---------|-----------|-----------|-----------|
| Config file permissions | INFO-01 | Finding #1 | **Teammate C** (deeper impact analysis) |
| Non-atomic saveConfig | INFO-02 | — | Teammate A (only reporter) |

No duplicates between Teammate B and others — B found zero code-level issues, only tooling recommendations.

---

## Positive Security Practices (10 confirmed)

1. **Symlink rejection** in scanner.ts and incremental.ts (`lstatSync`)
2. **Bounded reads** — 50MB max per cycle (`MAX_READ_BYTES`)
3. **Line length limits** — 1MB max per JSONL line (`MAX_LINE_LENGTH`)
4. **Atomic file writes** with random suffix temp files
5. **Restrictive permissions** — 0o600 files, 0o700 dirs (on state files)
6. **Zod schema validation** on all config input
7. **Immutable data patterns** — spread-based, readonly types
8. **Zero shell execution** — no child_process, exec, eval, Function
9. **Type whitelist** — only 5 known JSONL types accepted
10. **JSON.parse in try/catch** — all 3 parse sites handle errors

---

## Tool Coverage

| Tool | Status | Findings |
|------|--------|----------|
| Semgrep v1.136.0 | Ran (217 rules, 64 files) | 0 |
| Checkov | Skipped (no IaC) | N/A |
| npm audit | Ran (315 packages) | 0 vulnerabilities |
| OSV-Scanner | Not installed | — |
| TruffleHog | Not installed | — |
| Manual secret grep | Ran | 0 |
| OWASP logic review | Ran (all 50 source files) | 3 MEDIUM, 4 LOW |

---

## Final Verdict

**Approve with Changes** — Fix the 3 MEDIUM issues before production release:
1. Add restrictive permissions to `saveConfig()` — 5 minutes
2. Add `logPath` validation in Zod schema + call `expandHome()` — 10 minutes
3. Add PID lockfile or document single-instance assumption — 15-30 minutes

The codebase demonstrates mature security patterns for a local CLI tool. The attack surface is minimal by design (no network, no auth, no shell execution). Supply chain is clean with zero known CVEs and all MIT/Apache-2.0 licenses.
