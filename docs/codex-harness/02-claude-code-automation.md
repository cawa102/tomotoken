# Claude Code Automation & SDK リファレンス

ハーネス構築に必要な Claude Code の自動化機能・SDK・Plan Mode の詳細調査結果。

---

## 1. CLI Headless Mode (`-p` / `--print`)

Claude Code は `-p`（`--print`）フラグで非対話モードを提供する。インタラクティブ REPL を起動せず、単一クエリを実行して結果を出力する。

### 基本構文

```bash
claude -p "プロンプト文字列"
cat file.txt | claude -p "このファイルを分析して"
```

### 主要 CLI フラグ一覧（自動化向け）

| フラグ | 説明 | 例 |
|--------|------|-----|
| `-p`, `--print` | 非対話モード（SDK モード） | `claude -p "query"` |
| `--output-format` | 出力形式: `text`(default), `json`, `stream-json` | `claude -p --output-format json "query"` |
| `--json-schema` | JSON Schema に準拠した構造化出力 | `claude -p --json-schema '{"type":"object",...}' "query"` |
| `--model` | モデル指定（`sonnet`, `opus`, フルネーム） | `claude -p --model opus "query"` |
| `--fallback-model` | プライマリモデル過負荷時のフォールバック | `claude -p --fallback-model sonnet "query"` |
| `--max-turns` | エージェントターン数上限（上限到達時エラー終了） | `claude -p --max-turns 3 "query"` |
| `--max-budget-usd` | API コスト上限（USD） | `claude -p --max-budget-usd 5.00 "query"` |
| `--allowedTools` | 自動許可するツール一覧 | `--allowedTools "Bash,Read,Edit"` |
| `--disallowedTools` | 無効化するツール | `--disallowedTools "Bash(rm *)"` |
| `--tools` | 使用可能ツールの制限 | `--tools "Bash,Edit,Read"` |
| `--system-prompt` | システムプロンプトを完全置換 | `--system-prompt "You are..."` |
| `--append-system-prompt` | デフォルトプロンプトに追記 | `--append-system-prompt "Always use TS"` |
| `--system-prompt-file` | ファイルからプロンプト読込（完全置換） | `--system-prompt-file ./prompt.txt` |
| `--append-system-prompt-file` | ファイルからプロンプト追記 | `--append-system-prompt-file ./rules.txt` |
| `--continue`, `-c` | 直近の会話を継続 | `claude -c -p "続きを実行"` |
| `--resume`, `-r` | セッション ID で会話を再開 | `claude -r "$SESSION_ID" -p "query"` |
| `--fork-session` | resume 時に新セッションをフォーク | `claude --resume abc --fork-session` |
| `--permission-mode` | 権限モード: `default`, `acceptEdits`, `bypassPermissions`, `plan` | `--permission-mode plan` |
| `--dangerously-skip-permissions` | 全権限チェックスキップ（要注意） | 本番では非推奨 |
| `--verbose` | 詳細ログ出力 | `claude -p --verbose "query"` |
| `--include-partial-messages` | ストリーミング時の部分メッセージ含有 | `--output-format stream-json --include-partial-messages` |
| `--no-session-persistence` | セッションをディスク保存しない | `claude -p --no-session-persistence "query"` |
| `--setting-sources` | 設定ソース指定 | `--setting-sources user,project` |
| `--mcp-config` | MCP サーバー設定ファイル読込 | `--mcp-config ./mcp.json` |
| `--agents` | カスタムサブエージェント定義（JSON） | `--agents '{"reviewer":{...}}'` |
| `--add-dir` | 追加作業ディレクトリ | `--add-dir ../apps ../lib` |
| `--debug` | デバッグモード（カテゴリフィルタ可） | `--debug "api,hooks"` |

---

## 2. 出力形式の詳細

### `--output-format text`（デフォルト）

プレーンテキスト出力。人間向け。

### `--output-format json`

構造化 JSON。メタデータ付き。

```bash
claude -p "Summarize this project" --output-format json
```

レスポンスに含まれるフィールド:
- `result` — テキスト結果
- `session_id` — セッション ID（後続リクエストの `--resume` に使用）
- `duration_ms` / `duration_api_ms` — 処理時間
- `total_cost_usd` — API コスト
- `usage` — トークン使用量
- `num_turns` — ターン数
- `is_error` — エラー有無
- `structured_output` — `--json-schema` 使用時の構造化出力

```bash
# jq でフィールド抽出
session_id=$(claude -p "Start review" --output-format json | jq -r '.session_id')
claude -p "Continue" --resume "$session_id" --output-format json | jq -r '.result'
```

### `--output-format stream-json`

改行区切り JSON ストリーム。リアルタイム処理向け。各行が独立した JSON オブジェクト。

```bash
claude -p "Explain recursion" --output-format stream-json --verbose --include-partial-messages
```

テキストデルタのフィルタリング例:

```bash
claude -p "Write a poem" --output-format stream-json --verbose --include-partial-messages | \
  jq -rj 'select(.type == "stream_event" and .event.delta.type? == "text_delta") | .event.delta.text'
```

### `--json-schema` による構造化出力

JSON Schema を指定すると、エージェントの作業完了後に検証済みの構造化データが `structured_output` フィールドに返される。

```bash
claude -p "Extract function names from auth.py" \
  --output-format json \
  --json-schema '{"type":"object","properties":{"functions":{"type":"array","items":{"type":"string"}}},"required":["functions"]}'
```

---

## 3. Plan Mode

### 概要

Plan Mode は Claude Code の研究/計画フェーズと実行フェーズを分離する機能。Plan Mode 中、Claude はファイル読取・検索のみ可能で、編集・コマンド実行は禁止される。

### 起動方法

- **インタラクティブ**: `Shift+Tab` を2回、または `/plan` コマンド
- **CLI**: `--permission-mode plan`
- **SDK**: `permissionMode: "plan"`

### Plan Mode 中の利用可能ツール

| 許可 | 禁止 |
|------|------|
| Read, Glob, Grep | Edit, Write |
| WebFetch, WebSearch | Bash（コマンド実行） |
| Task（リサーチ用サブエージェント） | NotebookEdit |
| TodoRead, TodoWrite | 状態変更系 MCP |

**重要**: 内部的にはファイル編集ツール自体は存在し続けるが、プランファイルの操作にのみ使用される。ツール制限はプロンプト注入による制御であり、技術的な制限ではない。

### プランの構造

プランは **Markdown ファイル** として生成される。特別なスキーマはなく、自由形式のテキスト。生成されたプランは Claude の plans ディレクトリに書き込まれる。

```json
// settings.json でプランディレクトリを設定可能（v2.1.9+）
{ "plansDirectory": "~/.claude/plans" }
```

### ExitPlanMode ツール

Plan Mode の終了時に呼ばれる内部ツール。ユーザーに計画の承認を求め、承認後にプランファイルを読み込んで実行を開始する。

```typescript
interface ExitPlanModeInput {
  plan: string;  // 承認を求めるプランテキスト
}
```

### サブエージェントアーキテクチャ

v2.0.28 以降、Plan Mode は専用の Plan Subagent を使用:
- 既存のサブエージェントを再利用（都度生成しない）
- 動的モデル選択
- Explore Subagent（Haiku 搭載）が自動的にコードベース探索を実行

### ハーネスからの Plan Mode 活用

```bash
# Plan Mode で計画のみ生成
claude -p "Implement user authentication" \
  --permission-mode plan \
  --output-format json \
  --max-turns 10

# 結果の plan テキストを取得
claude -p "..." --permission-mode plan --output-format json | jq -r '.result'
```

**注意**: Plan Mode の出力は自由形式 Markdown であり、機械可読な構造化フォーマットではない。ハーネスで活用する場合、`--json-schema` を組み合わせるか、出力をさらに LLM で解析する必要がある。

---

## 4. Claude Agent SDK

### 概要

Claude Agent SDK（旧 Claude Code SDK）は、Claude Code の内部基盤と同等のツール・エージェントループ・コンテキスト管理を提供するオープンソースライブラリ。Python と TypeScript で利用可能。

- **TypeScript**: `@anthropic-ai/claude-agent-sdk`（npm、v0.2.37+）
- **Python**: `claude-agent-sdk`（pip、v0.1.34+）

### 認証

```bash
export ANTHROPIC_API_KEY=your-api-key

# サードパーティプロバイダ
CLAUDE_CODE_USE_BEDROCK=1   # Amazon Bedrock
CLAUDE_CODE_USE_VERTEX=1    # Google Vertex AI
CLAUDE_CODE_USE_FOUNDRY=1   # Microsoft Azure AI Foundry
```

### TypeScript SDK の基本使用法

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Find and fix the bug in auth.py",
  options: { allowedTools: ["Read", "Edit", "Bash"] }
})) {
  if ("result" in message) console.log(message.result);
}
```

### 主要オプション（`Options` 型）

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `allowedTools` | `string[]` | 許可ツール一覧 |
| `disallowedTools` | `string[]` | 禁止ツール一覧 |
| `permissionMode` | `"default" \| "acceptEdits" \| "bypassPermissions" \| "plan"` | 権限モード |
| `model` | `string` | モデル指定 |
| `fallbackModel` | `string` | フォールバックモデル |
| `maxTurns` | `number` | 最大ターン数 |
| `maxBudgetUsd` | `number` | コスト上限（USD） |
| `maxThinkingTokens` | `number` | 思考トークン上限 |
| `cwd` | `string` | 作業ディレクトリ |
| `systemPrompt` | `string \| { type: "preset", preset: "claude_code", append?: string }` | システムプロンプト |
| `outputFormat` | `{ type: "json_schema", schema: JSONSchema }` | 構造化出力スキーマ |
| `continue` | `boolean` | 直近会話の継続 |
| `resume` | `string` | セッション ID で再開 |
| `forkSession` | `boolean` | セッションフォーク |
| `hooks` | `Partial<Record<HookEvent, HookCallbackMatcher[]>>` | フックコールバック |
| `agents` | `Record<string, AgentDefinition>` | カスタムサブエージェント |
| `mcpServers` | `Record<string, McpServerConfig>` | MCP サーバー設定 |
| `settingSources` | `("user" \| "project" \| "local")[]` | 設定ソース（デフォルト: なし） |
| `betas` | `SdkBeta[]` | ベータ機能（例: `context-1m-2025-08-07`） |
| `env` | `Dict<string>` | 環境変数 |
| `includePartialMessages` | `boolean` | 部分メッセージ含有 |
| `enableFileCheckpointing` | `boolean` | ファイルチェックポイント |
| `sandbox` | `SandboxSettings` | サンドボックス設定 |
| `canUseTool` | `CanUseTool` | カスタム権限関数 |
| `plugins` | `SdkPluginConfig[]` | プラグイン設定 |

### メッセージ型

`query()` が返すメッセージの主要型:

| 型 | 説明 |
|----|------|
| `SDKSystemMessage` (subtype: `init`) | 初期化メッセージ。`session_id`, `model`, `tools` 等含む |
| `SDKAssistantMessage` | アシスタント応答。`message.content` にテキスト・ツール使用含む |
| `SDKUserMessage` | ユーザー入力メッセージ |
| `SDKResultMessage` (subtype: `success`) | 最終結果。`result`, `session_id`, `total_cost_usd`, `usage`, `structured_output` 含む |
| `SDKResultMessage` (subtype: `error_*`) | エラー終了。`errors` 配列含む |
| `SDKPartialAssistantMessage` | ストリーミング部分メッセージ |
| `SDKCompactBoundaryMessage` | コンテキスト圧縮境界 |

### セッション管理

```typescript
let sessionId: string | undefined;

// 初回: セッション ID 取得
for await (const message of query({
  prompt: "Read the auth module",
  options: { allowedTools: ["Read", "Glob"] }
})) {
  if (message.type === "system" && message.subtype === "init") {
    sessionId = message.session_id;
  }
}

// 継続: コンテキスト維持
for await (const message of query({
  prompt: "Now find all callers",
  options: { resume: sessionId }
})) {
  if ("result" in message) console.log(message.result);
}
```

### サブエージェント定義

```typescript
const result = query({
  prompt: "Review this codebase",
  options: {
    allowedTools: ["Read", "Glob", "Grep", "Task"],
    agents: {
      "code-reviewer": {
        description: "Expert code reviewer",
        prompt: "Analyze code quality and suggest improvements.",
        tools: ["Read", "Glob", "Grep"],
        model: "sonnet"  // "sonnet" | "opus" | "haiku" | "inherit"
      }
    }
  }
});
```

### フック（Hooks）

SDK フックはコールバック関数で、エージェントライフサイクルの各ポイントで実行される。

利用可能なイベント:
- `PreToolUse` / `PostToolUse` / `PostToolUseFailure`
- `SessionStart` / `SessionEnd`
- `Stop` / `SubagentStart` / `SubagentStop`
- `UserPromptSubmit` / `Notification`
- `PreCompact` / `PermissionRequest`

```typescript
import { query, ClaudeAgentOptions, HookCallback } from "@anthropic-ai/claude-agent-sdk";

const logEdits: HookCallback = async (input) => {
  const filePath = (input as any).tool_input?.file_path ?? "unknown";
  console.log(`Edited: ${filePath}`);
  return {};
};

for await (const message of query({
  prompt: "Refactor utils.py",
  options: {
    permissionMode: "acceptEdits",
    hooks: {
      PostToolUse: [{ matcher: "Edit|Write", hooks: [logEdits] }]
    }
  }
})) { /* ... */ }
```

### MCP サーバー統合

```typescript
const result = query({
  prompt: "Open example.com",
  options: {
    mcpServers: {
      playwright: { command: "npx", args: ["@playwright/mcp@latest"] }
    }
  }
});
```

---

## 5. CLI vs SDK の使い分け

| ユースケース | 推奨 |
|-------------|------|
| インタラクティブ開発 | CLI |
| CI/CD パイプライン | CLI (`-p`) or SDK |
| カスタムアプリケーション | SDK |
| 単発タスク | CLI (`-p`) |
| 本番自動化 | SDK |
| ツール承認コールバック | SDK のみ |
| 構造化メッセージオブジェクト | SDK のみ |
| フック（コールバック関数） | SDK のみ |
| カスタム権限関数 | SDK のみ（`canUseTool`） |

---

## 6. ハーネス構築への統合ポイント

### パターン A: CLI パイプライン（シンプル）

```bash
#!/bin/bash
# Claude Code で計画を生成し、JSON で結果取得
PLAN=$(claude -p "Implement feature X" \
  --permission-mode plan \
  --output-format json \
  --max-turns 10 \
  --max-budget-usd 2.00 \
  | jq -r '.result')

# 計画をファイルに保存
echo "$PLAN" > plan.md

# 計画を Codex に渡して実行（別ステップ）
# codex -p "Execute this plan: $(cat plan.md)" ...
```

### パターン B: SDK パイプライン（高度な制御）

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

// Step 1: Claude Code で計画生成
let plan = "";
let sessionId = "";

for await (const message of query({
  prompt: "Design the authentication module for this project",
  options: {
    permissionMode: "plan",
    allowedTools: ["Read", "Glob", "Grep", "WebSearch"],
    maxTurns: 15,
    maxBudgetUsd: 3.00,
    model: "opus",
    settingSources: ["project"],  // CLAUDE.md を読み込む
    systemPrompt: {
      type: "preset",
      preset: "claude_code",
      append: "Output your plan in structured markdown with clear task breakdown."
    }
  }
})) {
  if (message.type === "system" && message.subtype === "init") {
    sessionId = message.session_id;
  }
  if ("result" in message) {
    plan = message.result;
  }
}

// Step 2: 計画を構造化データに変換
const tasks = await parsePlanToTasks(plan);

// Step 3: Codex API に各タスクを投入
for (const task of tasks) {
  await executeWithCodex(task);
}
```

### パターン C: 構造化出力で計画を機械可読に

```bash
claude -p "Analyze this codebase and create an implementation plan" \
  --permission-mode plan \
  --output-format json \
  --json-schema '{
    "type": "object",
    "properties": {
      "summary": { "type": "string" },
      "tasks": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": { "type": "number" },
            "title": { "type": "string" },
            "description": { "type": "string" },
            "files": { "type": "array", "items": { "type": "string" } },
            "dependencies": { "type": "array", "items": { "type": "number" } }
          },
          "required": ["id", "title", "description"]
        }
      }
    },
    "required": ["summary", "tasks"]
  }'
```

これにより `structured_output` フィールドに JSON Schema 準拠の構造化データが返される。ハーネスにとって最も有用なパターン。

### パターン D: セッション継続による段階的実行

```bash
# Step 1: 計画生成
SESSION=$(claude -p "Plan: implement auth module" \
  --permission-mode plan \
  --output-format json | jq -r '.session_id')

# Step 2: 同セッションで実行（コンテキスト維持）
claude -p "Now implement the plan" \
  --resume "$SESSION" \
  --allowedTools "Read,Edit,Write,Bash" \
  --output-format json
```

---

## 7. 重要な制約・注意点

1. **Plan Mode の出力は自由形式** — 構造化スキーマを強制するには `--json-schema` が必要
2. **`--json-schema` は print モードのみ** — インタラクティブモードでは使用不可
3. **`--max-turns` は print モードのみ** — 無限ループ防止に必須
4. **`--dangerously-skip-permissions` は本番で使用しない** — サンドボックスと `canUseTool` を代わりに使用
5. **セッション永続化** — デフォルトでセッションはディスク保存される。CI/CD では `--no-session-persistence` を検討
6. **コスト管理** — `--max-budget-usd` でコスト上限を設定。`total_cost_usd` で実際のコストを追跡
7. **CLAUDE.md の読み込み** — SDK で CLAUDE.md を読ませるには `settingSources: ["project"]` と `systemPrompt: { type: "preset", preset: "claude_code" }` の両方が必要

---

## 参考リンク

- [Claude Code Headless Mode 公式ドキュメント](https://code.claude.com/docs/en/headless)
- [CLI リファレンス](https://code.claude.com/docs/en/cli-reference)
- [Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Agent SDK TypeScript リファレンス](https://platform.claude.com/docs/en/agent-sdk/typescript)
- [Agent SDK Python リファレンス](https://platform.claude.com/docs/en/agent-sdk/python)
- [Plan Mode 解説 (Armin Ronacher)](https://lucumr.pocoo.org/2025/12/17/what-is-plan-mode/)
- [Claude Code Common Workflows](https://code.claude.com/docs/en/common-workflows)
- [Agent SDK デモリポジトリ](https://github.com/anthropics/claude-agent-sdk-demos)
