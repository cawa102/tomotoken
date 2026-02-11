# spec.md — Claude Code Usage Pet (Working Title)
SOW / Specification (v1.1 — Traits Added)

## 1. Background
This project is a lightweight local application for Claude Code users that visualizes their Claude Code usage as a “pet” (ASCII / dot-style character). As the user consumes tokens, the pet grows and eventually “completes,” then a new pet spawns. The primary goal is to make usage fun to look back on (collection / “encyclopedia” feel), **without requiring any AI processing or cloud services**.

The developer receiving this document has zero prior knowledge of the project.

---

## 2. Objectives
### 2.1 Primary Objective
- Provide a fun, low-friction visualization of Claude Code usage:
  - Token consumption grows a character.
  - When a character completes, a new character spawns.
  - Users can view a collection of completed characters.

### 2.2 Secondary Objectives
- Capture “personality” from usage patterns using **local-only heuristics** (no LLM / AI calls).
- Provide subtle “idle animation” to make the pet feel alive.
- Optional “encouragement messages” during intense sessions (rate-based, not spammy).

### 2.3 Non-Goals
- No cloud sync, no accounts, no social sharing (v1).
- No LLM-based analysis/classification (explicitly excluded).
- No quests/gamified tasks (explicitly excluded).
- No complex state simulation (hunger/energy/etc.) (explicitly excluded).
- No requirement to merge/ship ccusage (may be used as reference only).

---

## 3. Scope
### 3.1 In Scope (v1)
1) Local log ingestion
- Read Claude Code transcripts / usage logs from local filesystem (format: JSONL or similar).
- Aggregate token usage per session, per day, and over time.

2) Pet growth & spawn loop
- Pet accumulates tokens; progress = consumed_tokens / required_tokens.
- When progress >= 1.0, pet completes and is stored in collection; new pet spawns.

3) Monthly scaling reset (confirmed)
- Month boundary resets only the “spawn index counter” that affects the required tokens of the *next spawned pet*.
- The currently active pet continues without any reset or changes to its required tokens.

4) Personality extraction (no AI)
- Compute:
  - usage_mix: 8-category distribution (§7)
  - depth_metrics: loop/iteration style from tool transitions (§7)
  - style_metrics: message-shape features via regex (§7)
  - Traits: interpretable personality axes derived from the above (§7.6)
- Use these metrics/traits to parameterize the generated ASCII art (procedural variation) and for display in the UI/collection.

5) Rendering & UI (CLI/TUI)
- Display current pet with idle animation frames (fixed width/height).
- Provide commands to view stats and collection (“encyclopedia”).

6) Encouragement messages (optional but recommended)
- Triggered by tokens/hour rate + cooldown (fixed thresholds; configurable).

### 3.2 Out of Scope (v1)
- Any network calls (including to Anthropic/OpenAI).
- Any requirement to install additional complex dependencies beyond app runtime.
- Any “model-aware” cost estimation (tokens-to-$ conversion) is optional and not required.

---

## 4. Deliverables
1) Application package (cross-platform CLI; macOS/Linux required; Windows optional)
2) Config file support (YAML or JSON)
3) Local database/storage (SQLite or JSON store) for:
   - app settings
   - current pet state
   - collection entries
4) Developer documentation:
   - installation
   - configuration
   - supported log formats / how to point to log path
5) User documentation:
   - quickstart
   - core commands
6) Test suite:
   - unit tests for aggregation and progression logic
   - fixture logs for deterministic outputs

---

## 5. Assumptions & Constraints
### 5.1 Key Constraints
- Must work without any AI/LLM calls.
- Must not require complicated setup for the user.
- Must be safe: do not upload/store raw prompt content beyond what is required locally.

### 5.2 Claude Code Logs
- Claude Code produces local transcript/usage logs. The app must:
  - allow user to set log directory path via config
  - support incremental ingestion (only new entries)
- Because paths/formats may vary by environment/version, log path discovery should be “best effort,” with a clear fallback to manual configuration.

### 5.3 Privacy/Security
- Default behavior: store only derived metrics (counts, ratios, token totals, filenames/extensions) and minimal message-shape stats.
- Do not store full message text by default.
- Provide a “redaction” mode: if message text is encountered, discard it after extracting regex-based shape features.

---

## 6. Functional Requirements
### 6.1 Token Accounting
Define `tokens_total` as:
- `tokens_total = tokens_input + tokens_output` if separated fields exist
- else `tokens_total = tokens` if only total exists

The app must:
- compute per-session tokens
- compute daily tokens
- compute all-time total tokens

### 6.2 Pet Lifecycle
Each pet has:
- `pet_id` (UUID)
- `spawned_at` timestamp
- `required_tokens` (T_required) fixed at spawn time
- `consumed_tokens` accumulated over time
- derived `progress = consumed_tokens / required_tokens`
- derived `personality_profile` (usage_mix/depth/style + traits)

Completion:
- if `progress >= 1.0`, mark pet as complete:
  - `completed_at` timestamp
  - store final personality profile
  - store deterministic art seed and final art parameters
- immediately spawn next pet

### 6.3 Spawn Appearance
- New pet spawns with the same “base/plain” look every time (same base template).
- Differences emerge via procedural parameterization as it grows.

### 6.4 Monthly Reset Rule (Confirmed)
- Month boundary resets ONLY the **spawn index counter** used to compute the *next* pet’s required tokens.
- The current pet continues without changes:
  - current pet `required_tokens` is not modified
  - current pet `consumed_tokens` is not reset

Implementation detail:
- Track `spawn_index_current_month` (integer).
- At local time month change:
  - set `spawn_index_current_month = 0`
- When spawning a pet:
  - `required_tokens = T0 * g^(spawn_index_current_month)`
- When a pet completes:
  - `spawn_index_current_month += 1`

### 6.5 Growth Difficulty Parameters (Confirmed)
- Growth multiplier: `g = 1.5`

Calibrating `T0` (confirmed approach):
- Let `total_tokens_all_time` be the sum of all tokens observed in the local logs.
- Let `total_days_observed` be the number of days between earliest and latest observed timestamps (define as `floor((latest - earliest)/24h) + 1` for determinism).
- Estimate monthly usage:
  - `M = (total_tokens_all_time / total_days_observed) * 30`
- Design target:
  - `T0 + T1 + T2 ≈ M` where `T1 = T0*g`, `T2 = T0*g^2`
- Therefore:
  - `T0 = M / (1 + g + g^2)`
  - with `g=1.5`, denominator = `1 + 1.5 + 2.25 = 4.75`
  - so `T0 = M / 4.75`
- `T0` must be computed at initial setup (first run after log sync) and persisted.
- `T0` remains constant unless user explicitly recalibrates/resets.

Rounding:
- Define rounding rule: default `ceil(T0)` to avoid “too easy” completion due to truncation.

### 6.6 Pet Completion & Token Overflow Handling
When ingesting a token delta, it may complete multiple pets. The app must:
- apply tokens to current pet until completion
- carry remaining tokens into subsequent spawned pets in the same ingest step
- ensure monthly spawn index is applied correctly for each spawn

Pseudo:
```
remaining = delta_tokens
while remaining > 0:
  need = required_tokens - consumed_tokens
  if remaining < need:
    consumed_tokens += remaining
    remaining = 0
  else:
    consumed_tokens += need
    remaining -= need
    complete current pet
    spawn_index_current_month += 1  # only affects next spawn
    spawn new pet with required_tokens = T0 * g^(spawn_index_current_month)
```

### 6.7 Idle Animation (Confirmed)
- Pet art is rendered in fixed-size ASCII canvas:
  - width: 24 chars (default; configurable)
  - height: 12 lines (default; configurable)
- Idle animation:
  - fixed frame count: 4 frames (default; configurable)
  - differences between frames must be small (blink/wave/hop)
- Rendering loop:
  - default FPS low (e.g., 2–4 FPS) to avoid CPU overhead
  - optional “static mode” for users who don’t want animation

### 6.8 Encouragement Messages (Optional, Recommended)
- Triggered when usage intensity is high:
  - compute rolling `tokens_per_hour` over the last 60 minutes
  - if `tokens_per_hour >= threshold` and cooldown elapsed, show a short message
- Cooldown:
  - default 3 hours
- Threshold:
  - fixed default (configurable), e.g. `threshold = 50_000 tokens/hour`
- Messages:
  - small set (5–10) with mild tone:
    - “Nice pace. Coffee break?”
    - “You’ve been going hard. Stretch?”
  - Must be non-blocking and ignorable.

---

## 7. Personality Extraction (No AI)
Goal: produce stable personality signatures without semantic LLM analysis and without storing raw message content.

### 7.1 usage_mix (8 categories) — Confirmed Set
Each session is classified into one primary category (or scored into multiple and normalized). The final `usage_mix` is a distribution over time.

Categories:
1) Implementation (feature coding)
2) Debug & Fix (edit-test loops)
3) Refactor & Cleanup (format/lint/rename/restructure)
4) Research & Comprehension (read/grep heavy, minimal edits)
5) Docs & Writing (markdown/docs editing)
6) Planning & Design (task breakdown, ADRs, structured notes)
7) Ops & Environment (install/build/docker/CI/env setup)
8) Security & Dependency (audit/scanner, lockfile updates, vuln checks)

Classification signals (examples; heuristic-based):
- File extensions edited (e.g., .md => Docs)
- Tool transition patterns (edit→test loops => Debug)
- Bash command keywords (test/lint/format/install/docker/audit/etc.)
- Ratio of edit vs read/grep events

Output:
- `usage_mix`: map category -> ratio (sum=1.0)

### 7.2 depth_metrics (loop/iteration)
Compute metrics without semantic analysis:
- `edit_test_loop_count`: number of occurrences of (edit then test command) within a session
- `repeat_edit_same_file_count`: repeated edits to same file
- `phase_switch_count`: changes between modes (read->edit->bash->edit etc.)
- `session_duration_sec` (if available)

Output:
- a small numeric set persisted per session; aggregated per pet window if needed

### 7.3 style_metrics (shape-only regex features)
Computed from user message text IF available locally; do not persist raw text.
Features:
- `bullet_ratio`: proportion of lines starting with -, *, 1., 2., etc.
- `question_ratio`: count(?) / total_chars or per message basis
- `codeblock_ratio`: presence/frequency of ``` blocks
- `avg_message_len`, `message_len_std`
- `heading_ratio`: lines starting with # (optional)

Output:
- aggregated rolling stats over the pet’s lifetime (or at spawn snapshot)

### 7.4 Tool Bias Handling
Because read/write/grep may dominate:
- Do not classify via raw counts.
- Prefer transition patterns and keyword signals.
- Use caps within scoring logic per signal type to avoid single tool inflating classification.

### 7.5 When to capture personality
Default approach (recommended):
- Continuous update: recompute/aggregate personality metrics over the active pet’s lifetime periodically (e.g., every ingest batch or hourly).
- On completion: store the final aggregated metrics into the completed pet record.

---

## 7.6 Traits (Interpretable Personality Axes) — Added
### 7.6.1 Purpose
Traits provide an interpretable “who is this pet?” layer that:
- summarises personality as human-readable labels for UI/collection
- stabilises art differentiation beyond tiny numeric differences
- requires **no AI**

### 7.6.2 Trait Set (8)
Traits are aligned 1:1 with the 8 usage_mix categories for implementation simplicity:

| Trait | Maps From usage_mix | Meaning |
|---|---|---|
| Builder | Implementation | building features / writing code |
| Fixer | Debug & Fix | finding and fixing issues via iteration |
| Refiner | Refactor & Cleanup | cleanup, restructure, format, maintainability |
| Scholar | Research & Comprehension | reading, understanding, exploring codebase |
| Scribe | Docs & Writing | documentation and writing-heavy work |
| Architect | Planning & Design | structured planning and design breakdown |
| Operator | Ops & Environment | environment setup, CI, containers, tooling |
| Guardian | Security & Dependency | audits, dependency hygiene, security checks |

### 7.6.3 Trait Scoring (0–100, deterministic)
Baseline:
- `trait_score_base = round(usage_mix_ratio * 100)`

Small deterministic adjustments (bounded; must not flip the primary nature easily):
- Compute `delta` per trait using depth/style signals.
- Apply with clamp:
  - `trait_score = clamp(0, 100, trait_score_base + delta)`
- Adjustment bounds:
  - `delta ∈ [-10, +10]` per trait (default)
  - Overall goal: usage_mix remains the main driver.

Example adjustments (non-exhaustive):
- Fixer: +min(10, 2 * edit_test_loop_count_normalised)
- Refiner: +min(10, lint_or_format_command_hits * 2)
- Architect: +min(10, bullet_ratio_high_bonus + heading_ratio_bonus)
- Scholar: +min(10, long_read_phase_bonus)
- Operator: +min(10, ops_command_hits * 2)
- Guardian: +min(10, security_command_hits * 2)
- Scribe: +min(10, docs_extension_edit_bonus)

### 7.6.4 Archetype + Subtype
- `Archetype` = trait with highest score
- `Subtype` = trait with second-highest score
- These two labels must be shown in:
  - current pet screen
  - completed pet collection entry

### 7.6.5 Persistence
For each pet, persist:
- full trait vector (8 scores)
- archetype, subtype
- optionally: top3 usage_mix categories for auditability

---

## 8. Procedural ASCII Art Generation (No AI)
### 8.1 Requirements
- Deterministic generation from:
  - `seed` (derived from user_id hash + pet_id)
  - `progress` (0..1)
  - traits + personality metrics (usage_mix/depth/style)
- No asset library requirement; art is produced algorithmically.
- Must output:
  - base frame (frame 0)
  - 3 additional idle frames (frames 1..3)

### 8.2 Canvas Constraints
- Must never exceed width/height.
- Must use ASCII by default (optionally allow extended chars).
- Frames must be visually similar (small diffs).

### 8.3 Growth Visual Rules
- Early progress changes size (body footprint) up to a defined maximum size within canvas.
- After reaching max body footprint, progress increases “detail density” and animation nuance:
  - pattern density, shading, accessories via procedural marks, etc.
- Avoid finite unlock lists where possible to reduce “seen it before” effect.

### 8.4 Trait-to-Visual Mapping (Added)
Art must reflect traits in a consistent, deterministic way:
- Archetype influences:
  - primary silhouette variation (within constraints)
  - signature motif (e.g., wrench-like mark for Fixer; scroll-like mark for Scribe), implemented procedurally
  - preferred idle gesture (blink/wave/hop variants)
- Subtype influences:
  - secondary patterning / accessory accent
- usage_mix can modulate:
  - motif density distribution (where patterns appear)
- depth/style metrics can modulate:
  - animation amplitude slightly (still “small diffs”)
  - line/bullet heaviness → more “structured” patterning

### 8.5 Output Format
Store frames as arrays of strings:
- `frames: string[4][height]`
Store metadata:
- `motifs`, `signature_tags`, `archetype`, `subtype`

---

## 9. UI / Commands (CLI/TUI)
### 9.1 Core Commands
- `pet show` : show current pet + progress + today/session stats + **Archetype/Subtype**
- `pet stats` : show token usage summaries (today / week / month / all-time)
- `pet collection` : list completed pets (with timestamps, **Archetype/Subtype**, brief tags)
- `pet view <pet_id>` : show stored frames and metrics for a completed pet (incl. traits vector)
- `pet config` : show current config and log path
- `pet recalibrate` : recompute M and T0 from current logs (explicit action)
- `pet rescan` : force re-ingest logs

### 9.2 Always-On Mode (Optional)
- `pet watch` : tail logs, update stats live, animate idle frames
- Must be lightweight; allow `--no-animate`

---

## 10. Data Storage
### 10.1 Storage Options
- SQLite recommended for reliability (preferred).
- JSON store acceptable if simpler.

### 10.2 Tables / Records (Minimum)
- `settings`: log_path, canvas size, thresholds, cooldowns, T0, g, etc.
- `ingestion_state`: last_ingested_timestamp / last_file_offset
- `pets_current`: current pet state (incl. required_tokens, consumed_tokens, traits snapshot/rolling)
- `pets_completed`: completed pet records (incl. final traits vector, archetype/subtype, frames)
- `session_metrics`: optional store for debugging and analytics (usage_mix classification inputs)

### 10.3 Determinism Requirements
- Given same logs and same config, pet completion sequence and art must be reproducible.

---

## 11. Engineering Requirements
### 11.1 Performance
- Incremental ingestion must handle large logs without reprocessing all history every run.
- Watch mode CPU usage must be low.

### 11.2 Reliability
- Corrupt/partial JSONL lines must not crash the app; skip with warnings.
- Provide “dry-run” mode for ingestion debugging.

### 11.3 Security
- No network calls.
- Do not store raw message bodies by default.
- Sanitize file paths; never execute untrusted content.

---

## 12. Testing & Acceptance Criteria
### 12.1 Unit Tests
- Token aggregation correctness from fixture logs
- Monthly reset behavior:
  - confirm only spawn index resets; current pet unchanged
- Required token calculation:
  - verify `M` from (total_tokens/total_days)*30
  - verify `T0 = M/4.75` for g=1.5
- Completion logic:
  - complete pet at progress>=1; spawn next with incremented index
  - overflow handling completes multiple pets if applicable
- Deterministic art generation:
  - fixed seed produces fixed frames
- Trait scoring:
  - baseline maps from usage_mix
  - deltas are bounded and deterministic
  - archetype/subtype selection stable

### 12.2 Acceptance Criteria (Definition of Done)
- User can point app to a log directory and see:
  - current pet rendering (4 frames idle)
  - live progress (tokens consumed)
  - archetype/subtype labels
  - completed pets in collection (with labels)
- Monthly boundary:
  - spawn index resets; current pet persists unchanged
- No AI calls / no network usage verified.
- Setup is simple:
  - one config file + log path, or CLI flags.

---

## 13. Implementation Plan (Suggested)
Phase 1: Log ingestion + aggregation + storage  
Phase 2: Progression engine (pets, completion, monthly reset)  
Phase 3: Personality metrics (heuristics) + Traits + deterministic ASCII generator (4 frames)  
Phase 4: CLI/TUI UX + watch mode + packaging  
Phase 5: Tests, docs, release  

---

## 14. Open Questions (Optional, can default)
These do not block MVP; provide defaults:
- Default log path auto-detection (best effort)
- Default tokens/hour threshold for encouragement (default 50,000)
- Canvas size defaults (24x12)
- Whether to store per-session metrics for debugging (default on, can be off)

---

## Appendix A — Config Example (YAML)
```yaml
log_path: "/path/to/claude/logs"
canvas:
  width: 24
  height: 12
  frames: 4
animation:
  enabled: true
  fps: 3
growth:
  g: 1.5
  t0_rounding: "ceil"
encouragement:
  enabled: true
  tokens_per_hour_threshold: 50000
  cooldown_hours: 3
privacy:
  store_raw_messages: false
```

## Appendix B — usage_mix Category IDs
- impl, debug, refactor, research, docs, planning, ops, security

## Appendix C — Trait IDs
- builder, fixer, refiner, scholar, scribe, architect, operator, guardian
