# tomotoken

Tomotoken turns your Claude Code token usage into a pet. It reads your local session logs, counts the tokens, and grows a creature that hatches from an egg, develops a personality from your coding habits, and eventually completes. Then you get a new egg.

Every billion tokens produces one pet.

## What you get

- ASCII pet in your terminal, procedurally generated from a seed, 4-frame animation, ANSI 256 color
- 3D character in the browser via Three.js, designed by an LLM, optionally post-processed with Blender
- Personality traits computed from how you actually use Claude Code (file types, tools, bash habits, session depth)
- A collection of completed pets you can browse in an interactive encyclopedia

## Requirements

- Node.js 18+
- Blender 4.x in your PATH
- API key: `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`
- Claude Code installed and used (reads `~/.claude/projects/` logs)

## Install

```bash
git clone https://github.com/anthropics/tomotoken.git
cd tomotoken
npm install
npm run build
```

To get the `tomotoken` command globally:

```bash
npm link
```

## Setup

Set your API key as an environment variable:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Or put it in `~/.tomotoken/config.json`:

```json
{
  "llm": {
    "provider": "anthropic",
    "apiKey": "sk-ant-..."
  }
}
```

OpenAI works too:

```json
{
  "llm": {
    "provider": "openai",
    "model": "gpt-5.2",
    "apiKey": "sk-..."
  }
}
```

The default provider is Anthropic with `claude-sonnet-4-6-20250620`. The default OpenAI model is `gpt-5.2`.

## Usage

```bash
tomotoken              # show your current pet
tomotoken watch        # live mode, polls every 5s, animates
tomotoken stats        # token usage summaries
tomotoken collection   # list completed pets
tomotoken view <id>    # detailed view of a completed pet
tomotoken zukan        # interactive encyclopedia
tomotoken window       # open in a new terminal window
tomotoken config       # show current config
tomotoken rescan       # re-read all logs from scratch
```

`watch` is probably the one you want running in a side terminal while you work.

## How it works

Tomotoken reads Claude Code's JSONL session logs from `~/.claude/projects/`. It counts input tokens, output tokens, cache creation tokens, and cache read tokens from each API call.

Five stages run in sequence:

1. **Ingestion** reads logs and tracks byte offsets so it only processes new data on each run.
2. **Progression** accumulates tokens toward the current pet. One pet per billion tokens. If a single delta crosses the threshold, overflow carries to the next pet.
3. **Personality** classifies your sessions by coding behavior (file extensions edited, tool transitions, bash commands, tool distribution) and computes 8 trait scores. The highest trait becomes the archetype, the second becomes the subtype.
4. **Art** generates deterministic ASCII frames from the pet's SHA-256 seed and trait parameters via a PRNG.
5. **UI** renders everything with Ink (React for the terminal).

The 3D pipeline runs separately. An LLM writes a creature description from the pet's personality. Hyper3D generates a 3D model from that description. Blender post-processes it (lattice deformation for eye enlargement, decimation to 20K faces, smooth shading at 60 degrees). Three.js renders the result in the browser at `localhost:3456`.

## First run

On first launch, tomotoken looks at your recent Claude Code sessions and creates your first pet from that activity. So you don't start from a blank egg -- you get a pet based on what you've already been doing.

## Configuration

Config lives at `~/.tomotoken/config.json`. Everything has defaults, so this file is optional.

| Key | Default | What it does |
|-----|---------|-------------|
| `logPath` | `~/.claude/projects` | Where to find Claude Code logs |
| `canvas.width` | 32 | ASCII art width |
| `canvas.height` | 24 | ASCII art height |
| `canvas.frames` | 4 | Animation frame count |
| `animation.enabled` | true | Enable/disable animation |
| `animation.fps` | 2 | Animation speed |
| `encouragement.enabled` | true | Motivational messages in watch mode |
| `encouragement.tokensPerHourThreshold` | 50000 | Token rate to trigger encouragement |
| `privacy.storeRawMessages` | false | Store raw message content |
| `llm.provider` | `"anthropic"` | `"anthropic"` or `"openai"` |
| `llm.model` | per provider | Model ID override |
| `llm.apiKey` | from env | API key override |

## Data storage

Three JSON files in `~/.tomotoken/`:

| File | Contents |
|------|----------|
| `state.json` | Current pet, ingestion byte offsets, global stats |
| `collection.json` | Completed pets with personality, ASCII frames, seed |
| `config.json` | User configuration |

All writes are atomic (write to temp file, then rename). State objects are never mutated in place.

## Development

```bash
npm test              # vitest, 356 tests
npm run test:coverage # 80% coverage thresholds
npm run typecheck     # tsc --noEmit
npm run build         # tsup → dist/
npm run dev:viewer    # Three.js viewer at localhost:3456
```

Tests live in `test/` mirroring the `src/` structure. Fixtures in `test/fixtures/`.

## Project structure

```
src/
  ingestion/     Log scanning and token counting
  progression/   Pet advancement (1B tokens per pet)
  personality/   Session classification and trait computation
  art/           Procedural ASCII art generation
  ui/            Ink components (show, watch, zukan)
  generation/    LLM-based creature design (optional)
  art3d/         Hyper3D prompt building and style guide
  viewer/        Three.js WebGL viewer server
  sidecar/       Pipeline runner, outputs JSON for viewer
  encouragement/ Rate-based motivational messages
  window/        Cross-platform terminal window spawning
  store/         JSON state persistence
  config/        Zod-validated configuration
```

## License

MIT
