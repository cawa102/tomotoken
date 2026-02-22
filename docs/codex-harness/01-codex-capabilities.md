# OpenAI Codex CLI — Capabilities Research

> 調査日: 2026-02-20
> 調査目的: Claude Code の出力（実装計画・コード）を Codex CLI に評価させるハーネス構築のための基礎調査

## 1. What is Codex CLI

OpenAI が提供するターミナルベースのコーディングエージェント。Rust で構築されており、ローカルマシン上でコードの読み取り・変更・実行が可能。オープンソース（[github.com/openai/codex](https://github.com/openai/codex)）。

### Installation

```bash
# npm (推奨)
npm i -g @openai/codex

# Homebrew (macOS)
brew install --cask codex
```

### Authentication

```bash
# ChatGPT アカウントでログイン（OAuth ブラウザフロー）
codex login

# API キーで認証（CI/CD 向け）
CODEX_API_KEY=<api-key> codex exec "..."

# または
codex login --api-key "$OPENAI_API_KEY"
```

### Basic Usage

```bash
# インタラクティブモード（TUI）
codex

# 非インタラクティブモード（スクリプト/CI向け）
codex exec "リポジトリ構造を要約して"
```

### Models

| モデル | 用途 | 特徴 |
|--------|------|------|
| `gpt-5.3-codex` | フラッグシップ | 最新・最高精度。Plus/Pro/Business/Edu/Enterprise で利用可 |
| `gpt-5.2-codex` | コードレビュー推奨 | レビュー精度が最も高い |
| `gpt-5.3-codex-spark` | 高速タスク | 1000+ tokens/sec、軽量タスク向け |
| `codex-mini-latest` | コスト重視 | API: $1.50/$6.00 per 1M tokens |

## 2. Input Methods（入力方法）

Codex CLI は複数の入力方法をサポートしており、ハーネス構築において重要。

### 2.1 コマンドライン引数

```bash
codex exec "このコードをレビューして: ..."
```

### 2.2 stdin パイプ（`-` フラグ）

```bash
# ファイルの内容をプロンプトとして渡す
cat plan.md | codex exec -

# ヒアドキュメント
codex exec - <<'EOF'
以下の実装計画を評価してください:
...
EOF

# 複数ファイルの結合
cat plan.md src/main.ts | codex exec -
```

**これがハーネスの主要入力パスになる。** ファイル内容を stdin 経由でプロンプトとして送信できるため、Claude Code の出力をそのまま Codex に渡せる。

### 2.3 画像添付

```bash
codex exec -i screenshot.png "このUIの問題点を指摘して"
```

### 2.4 セッション継続

```bash
# 前のセッションを再開して追加指示
codex exec resume --last "前回の指摘を修正して"
codex exec resume <SESSION_ID> "追加のレビューをして"
```

## 3. Output Format（出力形式）

### 3.1 標準出力（デフォルト）

```bash
# stderr にプログレス、stdout に最終メッセージ
codex exec "repo構造を要約" | tee output.txt
```

### 3.2 ファイル出力（`-o` / `--output-last-message`）

```bash
codex exec "レビュー結果" -o ./review-result.txt
```

### 3.3 JSON Lines ストリーミング（`--json`）

```bash
codex exec --json "タスク" | jq
```

イベントタイプ:
- `thread.started` — スレッド開始
- `turn.started` / `turn.completed` / `turn.failed` — ターン管理
- `item.started` / `item.completed` — 個別アイテム（メッセージ、コマンド実行等）
- `error` — エラー

```json
{"type":"turn.completed","usage":{"input_tokens":24763,"output_tokens":122}}
```

### 3.4 構造化 JSON 出力（`--output-schema`）— **最重要**

JSON Schema を指定して、レスポンスを特定の構造に強制できる。**ハーネスのフィードバック取得に最適。**

```bash
codex exec "計画を評価して" \
  --output-schema ./review-schema.json \
  -o ./review-result.json
```

**review-schema.json の例:**
```json
{
  "type": "object",
  "properties": {
    "findings": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "title": { "type": "string", "maxLength": 80 },
          "body": { "type": "string" },
          "confidence_score": { "type": "number", "minimum": 0, "maximum": 1 },
          "priority": { "type": "integer", "minimum": 0, "maximum": 3 },
          "code_location": {
            "type": "object",
            "properties": {
              "absolute_file_path": { "type": "string" },
              "line_range": {
                "type": "object",
                "properties": {
                  "start": { "type": "integer", "minimum": 1 },
                  "end": { "type": "integer", "minimum": 1 }
                }
              }
            }
          }
        }
      }
    },
    "overall_correctness": {
      "type": "string",
      "enum": ["patch is correct", "patch is incorrect"]
    },
    "overall_explanation": { "type": "string" },
    "overall_confidence_score": { "type": "number", "minimum": 0, "maximum": 1 }
  },
  "required": ["findings", "overall_correctness", "overall_explanation", "overall_confidence_score"],
  "additionalProperties": false
}
```

### 3.5 CI/CD 向けの組み合わせ

```bash
# JSON ストリーミング + 最終メッセージ保存
codex exec --json --output-last-message ./summary.txt "タスク"
```

## 4. Code Review / Evaluation Capabilities

### 4.1 組み込みレビュー機能（`/review`）

インタラクティブモードで `/review` を実行すると、専用のレビューエージェントが起動:
- diff ベースのレビュー（base branch 比較、未コミット変更、特定コミット）
- コードを変更せずにフィードバックのみ返す
- LiveCodeBench でバグ検出率 88%（バグ、セキュリティ、スタイル）

### 4.2 非インタラクティブでのレビュー

```bash
# diff を渡してレビュー
git diff main...HEAD | codex exec --output-schema review-schema.json -o review.json - <<'EOF'
以下の diff をレビューしてください。
正確性、パフォーマンス、セキュリティ、保守性の観点で評価し、
アクション可能な問題のみ報告してください。

$(cat -)
EOF
```

### 4.3 計画（Plan）の評価

**ハーネスの主要ユースケース。** 実装計画の Markdown を渡して評価させる:

```bash
codex exec --output-schema plan-review-schema.json -o plan-review.json - <<'EOF'
あなたはシニアソフトウェアアーキテクトです。
以下の実装計画を評価してください:

$(cat docs/plans/implementation.md)

評価基準:
1. 技術的実現可能性
2. アーキテクチャの妥当性
3. リスクと見落とし
4. テスト戦略の網羅性
EOF
```

### 4.4 カスタムレビュー指示

`~/.codex/config.toml` でモデルやレビュー基準をカスタマイズ可能:
- 「セキュリティ脆弱性に注力」
- 「パフォーマンス問題をチェック」
- 特定のコーディング規約への準拠確認

## 5. API / SDK Options（プログラマティック利用）

### 5.1 Codex SDK（TypeScript）

```bash
npm install @openai/codex-sdk
```

```typescript
import { Codex } from "@openai/codex-sdk";

const codex = new Codex();
const thread = codex.startThread();

// 計画をレビュー
const result = await thread.run(
  "以下の実装計画を評価してください:\n" + planContent
);
console.log(result);

// フォローアップ
const followUp = await thread.run("指摘した問題の修正案を提示して");
console.log(followUp);
```

**利点:**
- Node.js 18+ で動作
- スレッドの継続・再開が可能
- CI/CD パイプラインへの組み込みが容易

### 5.2 MCP サーバーモード

Codex を MCP（Model Context Protocol）サーバーとして起動し、他のエージェントから呼び出す:

```bash
codex mcp-server
```

公開されるツール:
- `codex` — 新規セッション開始（prompt, approval-policy, sandbox, model）
- `codex-reply` — 既存セッションへの返信（prompt, threadId）

**Python Agents SDK との連携:**

```python
async with MCPServerStdio(
    name="Codex CLI",
    params={"command": "npx", "args": ["-y", "codex", "mcp-server"]},
) as codex_mcp_server:
    agent = Agent(mcp_servers=[codex_mcp_server])
```

マルチエージェントオーケストレーション（Designer → Frontend → Backend → Tester）のパターンも公式でサポート。

### 5.3 GitHub Action

```yaml
- name: Install Codex
  run: npm i -g @openai/codex

- name: Run Review
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: |
    codex exec --output-schema review-schema.json \
               -o review.json \
               --sandbox read-only \
               - < review-prompt.md
```

## 6. Key CLI Flags Reference

| フラグ | 説明 | ハーネスでの用途 |
|--------|------|------------------|
| `exec` | 非インタラクティブ実行 | 自動化の基本 |
| `-` (PROMPT) | stdin からプロンプト読み取り | 計画/コードの入力 |
| `--output-schema <path>` | JSON Schema で出力構造を強制 | レビュー結果の構造化 |
| `-o <path>` | 最終メッセージをファイルに書き出し | 結果の保存 |
| `--json` | JSONL イベントストリーム | 進捗監視 |
| `-m <model>` | モデル指定 | レビュー精度の制御 |
| `-s read-only` | 読み取り専用サンドボックス | レビュー時の安全性 |
| `-a never` | 承認不要 | 自動化向け |
| `--full-auto` | 低摩擦モード | ワンショット実行 |
| `--ephemeral` | セッションを保存しない | CI/CD 向け |
| `--skip-git-repo-check` | Git リポジトリ外でも実行可 | 柔軟なデプロイ |

## 7. Limitations and Considerations

### コスト

| 認証方式 | コスト | 制限 |
|----------|--------|------|
| ChatGPT Plus ($20/月) | サブスク込み | 30〜150 メッセージ/5時間 |
| ChatGPT Pro ($200/月) | サブスク込み | 300〜1,500 メッセージ/5時間 |
| API キー | 従量課金 | codex-mini: $1.50/$6.00/1M tokens、GPT-5: $1.25/$10.00/1M tokens |

### 技術的制約

- **Git リポジトリ必須**: デフォルトでは Git リポジトリ内でのみ動作（`--skip-git-repo-check` で回避可）
- **ネットワーク依存**: OpenAI API への接続が必須（ローカルモデルは `--oss` フラグで対応可能だが精度は低下）
- **レート制限**: ChatGPT 認証の場合、メッセージ数/時間の制限あり
- **コンテキスト長**: 大規模コードベースではコンテキストウィンドウの制約がある
- **セキュリティ**: CI/CD では API キーの管理に注意。GitHub Action では sudo 権限を落としてキーを保護するパターンが推奨

### ハーネス構築上の注意点

1. **`--output-schema` がキー**: 構造化出力により、フィードバックのパースが確実になる
2. **stdin パイプが主要入力経路**: `cat plan.md | codex exec -` のパターン
3. **`--sandbox read-only`** を使用: レビュー時はコード変更を防止
4. **モデル選択**: レビュー精度には `gpt-5.2-codex` が推奨
5. **コスト管理**: API キー利用時は従量課金。`codex-mini-latest` で低コスト運用も可能
6. **Codex SDK** を使えば TypeScript からプログラマティックに制御可能

## 8. Recommended Harness Pattern

```
Claude Code (計画生成)
    ↓ plan.md
stdin pipe → codex exec --output-schema review.json -o result.json --sandbox read-only -m gpt-5.2-codex -
    ↓ result.json
Parse & Display (構造化フィードバック)
```

最もシンプルで確実なパターン:
1. Claude Code が `docs/plans/` に計画を出力
2. シェルスクリプトが計画 + レビュープロンプトを結合
3. `codex exec` に stdin で渡し、`--output-schema` で構造化結果を取得
4. JSON をパースして表示・フィードバックループ

## Sources

- [Codex CLI — OpenAI Developers](https://developers.openai.com/codex/cli/)
- [Command line options](https://developers.openai.com/codex/cli/reference/)
- [Non-interactive mode](https://developers.openai.com/codex/noninteractive/)
- [Codex CLI features](https://developers.openai.com/codex/cli/features/)
- [Codex SDK](https://developers.openai.com/codex/sdk/)
- [Build Code Review with the Codex SDK](https://developers.openai.com/cookbook/examples/codex/build_code_review_with_codex_sdk/)
- [Use Codex with the Agents SDK](https://developers.openai.com/codex/guides/agents-sdk/)
- [Custom Prompts (deprecated)](https://developers.openai.com/codex/custom-prompts/)
- [Codex Changelog](https://developers.openai.com/codex/changelog/)
- [Codex Pricing](https://developers.openai.com/codex/pricing/)
- [GitHub — openai/codex](https://github.com/openai/codex)
