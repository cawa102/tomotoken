# Teammate B: Supply Chain + Secret Detection Report

**Project:** Tomotoken
**Date:** 2026-02-11
**Scope:** Dependency audit, license review, secret detection, supply chain health

---

## 1. npm audit Results

**Status: CLEAN — 0 vulnerabilities**

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High     | 0 |
| Moderate | 0 |
| Low      | 0 |
| Info     | 0 |

**Dependency totals:**
- Production: 48 packages
- Dev: 268 packages
- Optional: 53 packages
- Total: 315 packages (lockfileVersion 3)

Raw results saved to: `security-review/npm-audit-results.json`

---

## 2. OSV-Scanner Results

**Status: NOT AVAILABLE**

`osv-scanner` is not installed on this system. Recommendation: Install via `brew install osv-scanner` or `go install github.com/google/osv-scanner/cmd/osv-scanner@latest` for additional vulnerability detection beyond npm's advisory database.

---

## 3. Secret Detection

### 3.1 TruffleHog

**Status: NOT AVAILABLE**

`trufflehog` is not installed on this system.

### 3.2 Manual Secret Scan

**Status: CLEAN — No secrets found**

Patterns searched:
- API key patterns: `sk-proj-`, `sk-ant-`, `ghp_`, `gho_`, `glpat-`, `xoxb-`, `xoxp-`, `AKIA*`, `AIza*` — **No matches**
- Generic secret patterns: `api_key`, `apiKey`, `secret`, `password`, hardcoded token assignments — **No matches**
- Private keys: `BEGIN PRIVATE KEY`, `BEGIN RSA` — **No matches**
- `.env` files: **None present** in repository
- Git history: No `.env`, `.pem`, `.key`, `.p12`, `.pfx` files ever committed
- Git history secret patterns: No API keys/tokens found in any historical commits
- `process.env.*` usage in source: **None** — project is fully local, no env vars needed

### 3.3 Dangerous Code Patterns

- `eval()` / `new Function()`: **Not used**
- `child_process` / `exec` / `spawn`: **Not used**
- `fs.readFileSync` / `fs.writeFileSync` in `src/`: **Not used** (file I/O uses Node.js `fs/promises`)

---

## 4. License Analysis

### Production Dependencies

| Package | Version | License | Risk |
|---------|---------|---------|------|
| chalk | 5.6.2 | MIT | None |
| commander | 13.1.0 | MIT | None |
| ink | 5.2.1 | MIT | None |
| react | 18.3.1 | MIT | None |
| uuid | 11.1.0 | MIT | None |
| zod | 3.25.76 | MIT | None |

### Dev Dependencies

| Package | Version | License | Risk |
|---------|---------|---------|------|
| typescript | 5.9.3 | Apache-2.0 | None |
| tsup | 8.5.1 | MIT | None |
| vitest | 3.2.4 | MIT | None |
| eslint | 9.39.2 | MIT | None |
| ink-testing-library | 4.0.0 | MIT | None |
| @vitest/coverage-v8 | 3.2.4 | MIT | None |

**GPL contamination: NONE** — All production dependencies are MIT licensed. TypeScript uses Apache-2.0 (permissive, compatible with MIT). No copyleft licenses detected.

---

## 5. Supply Chain Health Assessment

### Lifecycle Scripts

Only **1 package** with lifecycle scripts found:
- `esbuild` — `postinstall: "node install.js"` (expected behavior: downloads platform-specific native binary)

No suspicious or unexpected lifecycle scripts detected.

### Version Pinning Strategy

- All 15 direct dependencies use **caret ranges** (`^x.y.z`) — standard practice
- No wildcard (`*`) or `latest` version specifiers — **good**
- `package-lock.json` is present and uses lockfileVersion 3 — **ensures reproducible builds**

### .gitignore Coverage

```
node_modules/  ✅
dist/          ✅
coverage/      ✅
*.tsbuildinfo  ✅
.DS_Store      ✅
```

**Missing from .gitignore (recommendations):**
- `.env` / `.env.*` — Should be added preemptively even though no env files exist
- `security-review/` — Temporary scan artifacts (optional)

---

## 6. Findings Summary

| # | Severity | Category | Finding | Recommendation |
|---|----------|----------|---------|----------------|
| 1 | INFO | .gitignore | No `.env` pattern in .gitignore | Add `.env*` to .gitignore preemptively |
| 2 | INFO | Tooling | OSV-Scanner not installed | Install for broader vulnerability coverage |
| 3 | INFO | Tooling | TruffleHog not installed | Install for automated secret scanning in CI |

---

## 7. Overall Assessment

**Supply chain health: EXCELLENT**

- Zero known vulnerabilities in all 315 packages
- All licenses are permissive (MIT / Apache-2.0) with no GPL contamination risk
- No secrets or credentials found in code or git history
- No dangerous code patterns (eval, child_process, etc.)
- No suspicious lifecycle scripts in dependencies
- Lock file present ensuring reproducible builds
- Project is entirely local (no network calls, no env vars needed)

The Tomotoken project has a clean supply chain with minimal attack surface. The only recommendations are informational: adding `.env*` to .gitignore as a defensive measure and installing OSV-Scanner/TruffleHog for CI pipeline integration.
