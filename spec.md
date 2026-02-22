# spec.md — Tomotoken

Specification (v3 — Web-only Architecture)

## 1. Background

Tomotoken is a local web application for Claude Code users that visualizes token usage as a growing 3D pet character. As the user consumes tokens, the pet grows through egg stages and eventually hatches into a unique creature. Completed pets enter a collection gallery (collection gallery). The primary goal is to make usage fun to look back on.

---

## 2. Objectives

### 2.1 Primary Objective
- Provide a fun, low-friction visualization of Claude Code usage:
  - Token consumption grows a character through egg stages (0-4) into a hatched creature.
  - When a character completes (1 billion tokens), a new character spawns.
  - Users can view a collection of completed characters in a web gallery (collection gallery).

### 2.2 Secondary Objectives
- Capture "personality" from usage patterns using **local-only heuristics** (no LLM required).
- 3D rendering with toon shading, morph expressions, and animations.
- Optional LLM-based creature design for unique 3D characters (Anthropic or OpenAI).
- Optional Hyper3D model generation with Blender post-processing.

### 2.3 Non-Goals
- No cloud sync, no accounts, no social sharing.
- No quests/gamified tasks.
- No complex state simulation (hunger/energy/etc.).

---

## 3. Scope

### 3.1 In Scope

1) **Local log ingestion**
   - Read Claude Code logs from `~/.claude/projects/**/*.jsonl` (including subagent logs).
   - Aggregate token usage per session.
   - Incremental ingestion via byte offset tracking.

2) **Pet growth & spawn loop**
   - Pet accumulates tokens; progress = consumed_tokens / TOKENS_PER_PET.
   - When progress >= 1.0, pet completes and is stored in collection; new pet spawns.
   - Fixed cost: TOKENS_PER_PET = 1,000,000,000 (1 billion tokens).

3) **Monthly scaling reset**
   - Month boundary resets only the spawn index counter.
   - The currently active pet continues without any reset or changes.

4) **Personality extraction (no AI required)**
   - Compute: usage_mix (8 categories), depth_metrics, style_metrics, traits (8 axes) (see §7).
   - Use these to parameterize creature visual parameters and for display in the gallery.

5) **3D Web Viewer**
   - Express server on localhost:3456 with WebSocket push.
   - Main page: current pet 3D viewer (Three.js with toon shading).
   - Egg stages 0-3 with wobble animation, stage 4 hatches into character.

6) **Collection Gallery**
   - Web page at `/collection` showing card grid of completed pets.
   - Card: snapshot thumbnail, archetype, completion date, token count.
   - Modal overlay with 3D viewer and personality details.

7) **Snapshot System**
   - Client-side canvas capture on pet completion.
   - Server-side storage and serving of PNG thumbnails.

8) **LLM Creature Design (Optional)**
   - Generate unique CreatureDesign via Claude API or OpenAI.
   - Stage-aware generation maintains visual coherence across growth stages.
   - Core app works without API key — falls back to PRNG-based creature params.

### 3.2 Out of Scope
- CLI commands (all interaction via web browser).
- ASCII art rendering (replaced by 3D viewer).
- Terminal window spawning.
- Encouragement messages.

---

## 4. Deliverables

1) Web application package (Node.js, cross-platform)
2) Config file support (JSON, Zod-validated)
3) Local JSON store for: app state, collection, configuration, snapshots
4) Developer documentation (CLAUDE.md, codemaps, README)
5) Test suite: unit tests for all domains, 80%+ coverage

---

## 5. Assumptions & Constraints

### 5.1 Key Constraints
- Must work without AI/LLM calls (LLM is optional enhancement).
- Must not require complicated setup (`npm start` launches everything).
- Must be safe: do not upload/store raw prompt content beyond what is required locally.

### 5.2 Claude Code Logs
- Location: `~/.claude/projects/{project-path}/{session-uuid}.jsonl`
- Each line is JSON with `type` field: `assistant`, `user`, `progress`, `summary`, `file-history-snapshot`.
- Token fields on assistant messages: `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`.
- Support incremental ingestion (byte offset tracking per file).
- Allow user to override log directory path via config.

### 5.3 Privacy/Security
- Default: store only derived metrics (counts, ratios, token totals, filenames/extensions).
- Do not store full message text by default.
- Configurable via `privacy.storeRawMessages`.

---

## 6. Functional Requirements

### 6.1 Token Accounting

`tokens_total = input + output + cache_creation + cache_read` (all API-billable).

The app must compute: per-session tokens, daily tokens, all-time total tokens.

### 6.2 Pet Lifecycle

Each pet has:
- `petId` (UUID)
- `spawnedAt` timestamp
- `requiredTokens` = TOKENS_PER_PET (1,000,000,000)
- `consumedTokens` accumulated over time
- derived `progress` = consumedTokens / requiredTokens
- derived personality (usageMix, depthMetrics, styleMetrics, traits)
- `generatedDesigns` — optional LLM-generated CreatureDesign per stage

Completion:
- If progress >= 1.0, mark pet as complete with `completedAt` timestamp.
- Store final personality profile and seed.
- Immediately spawn next pet.

### 6.3 Egg Stages

5 visual stages based on progress:

| Stage | Progress | Appearance |
|-------|----------|------------|
| 0 | 0-24% | Pristine egg |
| 1 | 25-49% | Small cracks |
| 2 | 50-74% | Many cracks |
| 3 | 75-99% | Large fractures, wobble intensifies |
| 4 | 100% | Hatched character |

Egg stages use pre-built GLB models (`egg-stage-{0-3}.glb`). Stage 4 loads an archetype-specific character model or LLM-generated design.

### 6.4 Monthly Reset Rule

- Month boundary resets ONLY `spawnIndexCurrentMonth` (used for future spawn ordering).
- Current pet continues without changes to requiredTokens or consumedTokens.

### 6.5 Growth — Fixed Cost

Each pet requires exactly TOKENS_PER_PET (1,000,000,000) tokens to complete.

This replaces the earlier dynamic calibration (T0/g formula). The fixed cost was chosen for simplicity and predictability.

### 6.6 Pet Completion & Token Overflow

When ingesting a token delta that exceeds remaining tokens:
```
remaining = delta_tokens
while remaining > 0:
  need = requiredTokens - consumedTokens
  if remaining < need:
    consumedTokens += remaining
    remaining = 0
  else:
    consumedTokens += need
    remaining -= need
    complete current pet
    spawnIndexCurrentMonth += 1
    spawn new pet with requiredTokens = TOKENS_PER_PET
```

### 6.7 Snapshot Capture

- Timing: client-side, on pet completion (petId change detected in WebSocket stream).
- Method: `canvas.toBlob("image/png")` → `POST /api/snapshot/:petId`.
- Storage: `~/.tomotoken/snapshots/{petId}.png`.
- Security: petId validated against `^[a-zA-Z0-9][a-zA-Z0-9_-]*$` (path traversal prevention).

### 6.8 First-Run Experience

On first launch (no existing state):
1. Scan all available Claude Code logs.
2. Extract recent token usage.
3. Compute initial personality from historical sessions.
4. Create first pet with accumulated progress.

---

## 7. Personality Extraction (No AI)

Goal: produce stable personality signatures without semantic LLM analysis and without storing raw message content.

### 7.1 usage_mix (8 categories)

Each session is classified into one or more categories. The final `usage_mix` is a distribution over time.

Categories:
1) Implementation (feature coding)
2) Debug & Fix (edit-test loops)
3) Refactor & Cleanup (format/lint/rename/restructure)
4) Research & Comprehension (read/grep heavy, minimal edits)
5) Docs & Writing (markdown/docs editing)
6) Planning & Design (task breakdown, ADRs, structured notes)
7) Ops & Environment (install/build/docker/CI/env setup)
8) Security & Dependency (audit/scanner, lockfile updates, vuln checks)

Classification signals:
- File extensions edited (e.g., .md → Docs)
- Tool transition patterns (edit→test loops → Debug)
- Bash command keywords (test/lint/format/install/docker/audit/etc.)
- Tool distribution ratios

Output: `usageMix`: Record<CategoryId, number> (sum = 1.0)

### 7.2 depth_metrics

- `editTestLoopCount`: occurrences of edit-then-test within a session
- `repeatEditSameFileCount`: repeated edits to same file
- `phaseSwitchCount`: changes between modes (read→edit→bash→edit)
- `totalSessions`: total sessions ingested

### 7.3 style_metrics

Computed from user message text (if available locally; raw text not persisted):
- `bulletRatio`: proportion of lines starting with -, *, 1.
- `questionRatio`: count(?) / total characters
- `codeblockRatio`: presence/frequency of ``` blocks
- `avgMessageLen`, `messageLenStd`
- `headingRatio`: lines starting with #

### 7.4 Tool Bias Handling

- Do not classify via raw counts (read/write/grep dominate).
- Prefer transition patterns and keyword signals.
- Use caps within scoring logic per signal type.

### 7.5 Traits (8 Axes)

Traits aligned 1:1 with usage_mix categories:

| Trait | Maps From | Meaning |
|-------|-----------|---------|
| Builder | Implementation | building features / writing code |
| Fixer | Debug & Fix | finding and fixing issues via iteration |
| Refiner | Refactor & Cleanup | cleanup, restructure, maintainability |
| Scholar | Research & Comprehension | reading, understanding, exploring |
| Scribe | Docs & Writing | documentation and writing-heavy work |
| Architect | Planning & Design | structured planning and design |
| Operator | Ops & Environment | environment setup, CI, containers |
| Guardian | Security & Dependency | audits, dependency hygiene, security |

Scoring (0-100, deterministic):
- `trait_score_base = round(usage_mix_ratio * 100)`
- `delta ∈ [-10, +10]` per trait from depth/style signals
- `trait_score = clamp(0, 100, trait_score_base + delta)`

### 7.6 Archetype + Subtype

- Archetype = trait with highest score
- Subtype = trait with second-highest score
- Displayed in: main page, collection cards, modal detail

### 7.7 When to Capture

- Continuous update: recompute personality on each ingestion cycle.
- On completion: store final personality snapshot in completed pet record.

---

## 8. Creature Visual System

### 8.1 Creature Parameters (Deterministic)

Derived from SHA-256 seed → mulberry32 PRNG + personality traits:
- Body shape: headRatio, bodyRoundness, topHeavy, eyeSize, eyeSpacing
- Features: earPresence, hornPresence, tailPresence, wingPresence
- Growth: limbStage (0-5), progress-adjusted parameters
- 20+ continuous parameters for unique variation

Same seed + traits = identical creature parameters (deterministic via PRNG).

### 8.2 Color Palette

10-slot ANSI 256 palette derived from traits + depth + style metrics:
- Slots: transparent, outline, body, secondary, highlight, eye white, pupil, mouth, accent1, accent2
- Converted to hex for 3D rendering.

### 8.3 3D Rendering

- GLB models loaded per archetype (pre-built or Hyper3D generated)
- Three.js with toon shading (MeshToonMaterial gradient maps)
- Post-processing: bloom, FXAA, color grading (EffectComposer)
- Toon outline effect
- Morph target expressions (eye/mouth shapes)
- AnimationMixer for skeletal clips

### 8.4 LLM Creature Design (Optional)

When API key is configured:
- Claude API or OpenAI generates `CreatureDesign` (Zod-validated)
- Structure: part hierarchies (1-50 parts), expressions, personality name/quirk
- Japanese-language prompts for token efficiency
- Stage-aware generation (designs stored per egg stage)

### 8.5 Hyper3D + Blender Pipeline (Optional)

For 3D model generation:
1. Generate model via Hyper3D (character description + style suffix)
2. Blender post-processing:
   - Smooth shading (shade_smooth_by_angle 60°)
   - Decimate to 20,000 faces (COLLAPSE mode)
   - Lattice deformation for eye enlargement (1.6x scale, vertex group constrained)
3. Export as GLB

Style: Disney Pixar chibi (huge head, tiny body, large shiny eyes, vibrant colors).

### 8.6 Determinism

- Creature parameters: deterministic (same seed + traits = same output)
- LLM-generated designs: intentionally non-deterministic (each generation unique)
- This is a deliberate design decision — each pet should feel unique.

---

## 9. Web Application

### 9.1 Startup

```bash
npm start  # → Express server → http://localhost:3456
```

Startup flow:
1. `validateStartup()` — check API key + Blender (warnings, not blocking for core)
2. First-run detection → build initial state if needed
3. Express server launch on port 3456 (configurable via VIEWER_PORT env)
4. WebSocket polling (5s interval) for real-time pet updates

### 9.2 Pages

| Page | URL | Purpose |
|------|-----|---------|
| Main | `/` | Current pet 3D viewer with radar chart and progress |
| Collection | `/collection` | Collection gallery — card grid + modal detail |

Navigation: floating circular buttons (bottom-right) linking between pages.

### 9.3 REST API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/pet` | Current pet PetRenderData (JSON) |
| GET | `/api/collection` | All completed pets (summaries with hasSnapshot) |
| GET | `/api/collection/:petId` | Single completed pet detail (full personality) |
| GET | `/api/collection/:petId/render` | PetRenderData for completed pet (3D viewer) |
| POST | `/api/snapshot/:petId` | Save PNG snapshot (image/png body, 2MB limit) |
| GET | `/api/snapshot/:petId` | Serve stored PNG snapshot |

### 9.4 WebSocket

- Connection on `/` path
- Push PetRenderData JSON every 5 seconds (server polls pipeline)
- Initial data sent on connection
- Clients tracked in Set, cleaned up on close/error

### 9.5 Collection Page

Card grid layout:
- Responsive: `auto-fill, minmax(240px, 1fr)`
- Each card: snapshot thumbnail (or placeholder), archetype name, completion date, token count
- Click → modal overlay with:
  - 3D viewer (Three.js via viewer-core.js)
  - Personality info (archetype, subtype, trait badges)
  - Date range (spawn → completion)
  - Token consumption

---

## 10. Data Storage

### 10.1 Storage Location

`~/.tomotoken/` containing:
- `state.json` — current pet, ingestion byte offsets, global stats
- `collection.json` — completed pets (immutable append-only)
- `config.json` — user configuration (Zod-validated)
- `snapshots/{petId}.png` — pet completion screenshots

### 10.2 Key Records

**AppState** (`state.json`):
- version, currentMonth, currentPet (PetRecord), ingestionState (file offsets), globalStats, lastEncouragementShownAt

**PetRecord**:
- petId, spawnedAt, requiredTokens, consumedTokens, spawnIndex, personalitySnapshot, generatedDesigns

**CompletedPet** (`collection.json`):
- petId, spawnedAt, completedAt, requiredTokens, consumedTokens, spawnIndex, personality (PersonalitySnapshot), seed

**Config** (`config.json`):
- logPath?, animation (enabled, fps), encouragement (enabled, threshold, cooldown), privacy (storeRawMessages), llm (provider, model, apiKey?)

### 10.3 Atomicity
- File writes via temp file + rename.
- File locking via PID lockfile (5-min stale threshold).
- All state updates are immutable (spread-based, returning new objects).

### 10.4 Rescan
No dedicated rescan command. To re-ingest all logs: `rm ~/.tomotoken/state.json && npm start`.

---

## 11. Engineering Requirements

### 11.1 Performance
- Incremental ingestion must handle large logs without reprocessing all history.
- WebSocket polling must be lightweight (5s interval, skip if no clients connected).

### 11.2 Reliability
- Corrupt/partial JSONL lines must not crash the app; skip with warnings.
- Server errors return proper HTTP status codes with error messages.

### 11.3 Security
- Validate petId against safe regex before filesystem operations (path traversal prevention).
- Sanitize file paths; never execute untrusted content.
- Do not store raw message bodies by default.
- API keys via environment variables or config (never hardcoded).
- Snapshot upload limited to 2MB.

---

## 12. Testing & Acceptance Criteria

### 12.1 Unit Tests
- Token aggregation correctness from fixture logs
- Monthly reset behavior: spawn index resets, current pet unchanged
- Completion logic: complete at progress >= 1.0, overflow handling
- Creature params: same seed + traits = same output (deterministic)
- Trait scoring: baseline from usage_mix, bounded deltas, stable archetype/subtype
- Collection API: buildCollectionResponse, findPetById, buildCompletedPetRenderData
- Snapshot: save, retrieve, list, path traversal rejection
- Config: Zod validation, defaults, LLM provider configuration

### 12.2 Acceptance Criteria
- User runs `npm start` and sees:
  - 3D pet viewer at localhost:3456 (egg or hatched character)
  - Progress bar and radar chart
  - Floating button to collection page
- Collection page shows completed pets as card grid with modal detail
- Pet completion triggers snapshot capture
- Monthly boundary: spawn index resets, current pet persists
- Core app works without API key (LLM features gracefully disabled)

---

## 13. Implementation Phases (Completed)

Phase 1: Log ingestion + aggregation + storage
Phase 2: Progression engine (pets, completion, monthly reset)
Phase 3: Personality metrics (heuristics) + Traits
Phase 4: 3D viewer + toon shading + egg system
Phase 5: LLM creature design + Hyper3D pipeline (optional)
Phase 6: Web migration (CLI removal, collection page, snapshot system)

---

## Appendix A — Config Example (JSON)

```json
{
  "logPath": "~/.claude/projects",
  "animation": {
    "enabled": true,
    "fps": 3
  },
  "encouragement": {
    "enabled": true,
    "tokensPerHourThreshold": 50000,
    "cooldownHours": 3
  },
  "privacy": {
    "storeRawMessages": false
  },
  "llm": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-6-20250620",
    "apiKey": "sk-..."
  }
}
```

## Appendix B — Category IDs
impl, debug, refactor, research, docs, planning, ops, security

## Appendix C — Trait IDs
builder, fixer, refiner, scholar, scribe, architect, operator, guardian

## Appendix D — PetRenderData Contract

```typescript
{
  creatureParams: CreatureParams,  // 20+ body shape parameters
  palette: string[],               // 10 hex color strings
  progress: number,                // 0.0 - 1.0
  petId: string,
  seed: string,
  archetype: string,               // highest trait
  subtype: string,                 // second-highest trait
  stage: 0 | 1 | 2 | 3 | 4,      // egg stage
  traits: Record<string, number>,  // 8 traits (0-100)
  creatureDesign: CreatureDesign | null  // LLM-generated (optional)
}
```
