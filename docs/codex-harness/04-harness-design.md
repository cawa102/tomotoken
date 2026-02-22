# Claude Code × Codex フィードバックハーネス設計書

> 作成日: 2026-02-20
> 基盤調査: 01-codex-capabilities.md, 02-claude-code-automation.md, 03-multi-llm-harness-patterns.md

---

## 1. 概要

Claude Code で実装計画を生成し、Codex CLI に評価・フィードバックさせるハーネスの設計。業界の知見（Builder/Reviewer パターン、LLM-as-Judge）を踏まえ、段階的に構築可能なアーキテクチャを提案する。

### ゴール

```
Claude Code (計画生成) → Codex (評価・フィードバック) → Claude Code (修正・反映)
```

### 設計原則

1. **Start Simple** — シェルスクリプト1本で動作するMVPから始める
2. **Git as State** — git リポジトリをエージェント間の共有コンテキストとして利用
3. **構造化出力** — JSON Schema で機械可読なフィードバックを強制
4. **Read-Only Review** — Codex はレビュー時にコードを変更しない（`--sandbox read-only`）
5. **Immutable Flow** — 各ステップの入出力はファイルとして永続化

---

## 2. アーキテクチャ

### 全体フロー

```
┌──────────────────────────────────────────────────────────────┐
│                     Harness Script                            │
│                                                              │
│  ┌─────────────┐    plan.md    ┌─────────────┐              │
│  │ Claude Code  │ ──────────→  │   Codex CLI  │              │
│  │ (Planner)    │              │ (Reviewer)   │              │
│  │              │              │              │              │
│  │ --permission │  review.json │ --sandbox    │              │
│  │   -mode plan │ ←────────── │  read-only   │              │
│  └─────────────┘              │ --output     │              │
│         │                     │  -schema     │              │
│         │ feedback            └─────────────┘              │
│         ▼                                                    │
│  ┌─────────────┐                                            │
│  │ Claude Code  │                                            │
│  │ (Reviser)    │  → revised-plan.md                        │
│  └─────────────┘                                            │
└──────────────────────────────────────────────────────────────┘
```

### ファイル構成

```
project/
├── scripts/
│   └── harness.sh              # メインハーネススクリプト
├── schemas/
│   ├── plan-review.schema.json # Codex レビュー出力の JSON Schema
│   └── plan-output.schema.json # Claude Code 計画出力の JSON Schema
├── prompts/
│   ├── review-prompt.md        # Codex に渡すレビュープロンプトテンプレート
│   └── revise-prompt.md        # Claude Code に渡す修正プロンプトテンプレート
└── docs/
    └── plans/                  # 計画の保存先（既存）
```

---

## 3. Phase 1: MVP（シェルスクリプト）

最小限の実装。1つのシェルスクリプトで Claude Code → Codex → 結果表示を行う。

### 3.1 レビュースキーマ

```json
{
  "type": "object",
  "properties": {
    "verdict": {
      "type": "string",
      "enum": ["approve", "revise", "reject"],
      "description": "計画全体の判定"
    },
    "confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "判定の確信度"
    },
    "summary": {
      "type": "string",
      "description": "レビューの要約（1-3文）"
    },
    "strengths": {
      "type": "array",
      "items": { "type": "string" },
      "description": "計画の強み"
    },
    "findings": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "severity": {
            "type": "string",
            "enum": ["critical", "high", "medium", "low"]
          },
          "category": {
            "type": "string",
            "enum": [
              "architecture",
              "feasibility",
              "security",
              "performance",
              "testing",
              "missing-requirement",
              "over-engineering",
              "other"
            ]
          },
          "title": { "type": "string", "maxLength": 80 },
          "description": { "type": "string" },
          "suggestion": { "type": "string" }
        },
        "required": ["severity", "category", "title", "description"]
      }
    },
    "missing_considerations": {
      "type": "array",
      "items": { "type": "string" },
      "description": "計画で見落とされている考慮事項"
    }
  },
  "required": ["verdict", "confidence", "summary", "findings"],
  "additionalProperties": false
}
```

### 3.2 ハーネススクリプト

```bash
#!/bin/bash
set -euo pipefail

# ============================================================
# Claude Code × Codex フィードバックハーネス (MVP)
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PLANS_DIR="$PROJECT_ROOT/docs/plans"
SCHEMAS_DIR="$PROJECT_ROOT/schemas"
REVIEW_SCHEMA="$SCHEMAS_DIR/plan-review.schema.json"

# --- 設定 ---
CLAUDE_MODEL="${CLAUDE_MODEL:-opus}"
CODEX_MODEL="${CODEX_MODEL:-gpt-5.2-codex}"
MAX_BUDGET_USD="${MAX_BUDGET_USD:-5.00}"
MAX_TURNS="${MAX_TURNS:-15}"

# --- カラー出力 ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

usage() {
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  plan <prompt>     Claude Code で計画を生成"
    echo "  review <plan.md>  Codex で計画をレビュー"
    echo "  loop <prompt>     計画生成 → レビュー → 修正の全サイクル"
    echo ""
    echo "Environment:"
    echo "  CLAUDE_MODEL      Claude モデル (default: opus)"
    echo "  CODEX_MODEL       Codex モデル (default: gpt-5.2-codex)"
    echo "  MAX_BUDGET_USD    コスト上限 (default: 5.00)"
    exit 1
}

# --- Step 1: Claude Code で計画生成 ---
generate_plan() {
    local prompt="$1"
    local output_file="$2"

    echo -e "${BLUE}[1/3] Claude Code で計画を生成中...${NC}"

    claude -p "$prompt" \
        --permission-mode plan \
        --model "$CLAUDE_MODEL" \
        --output-format text \
        --max-turns "$MAX_TURNS" \
        --max-budget-usd "$MAX_BUDGET_USD" \
        > "$output_file"

    echo -e "${GREEN}  → 計画を保存: $output_file${NC}"
}

# --- Step 2: Codex でレビュー ---
review_plan() {
    local plan_file="$1"
    local review_output="$2"

    echo -e "${BLUE}[2/3] Codex で計画をレビュー中...${NC}"

    codex exec \
        -m "$CODEX_MODEL" \
        --sandbox read-only \
        --output-schema "$REVIEW_SCHEMA" \
        -o "$review_output" \
        --ephemeral \
        - <<REVIEW_PROMPT
あなたはシニアソフトウェアアーキテクトです。
以下の実装計画を厳密にレビューしてください。

## レビュー対象の計画

$(cat "$plan_file")

## プロジェクトのコンテキスト

$(cat "$PROJECT_ROOT/CLAUDE.md" 2>/dev/null || echo "CLAUDE.md not found")

## 評価基準

1. **技術的実現可能性**: 計画通りに実装可能か
2. **アーキテクチャの妥当性**: 既存設計との整合性
3. **リスクと見落とし**: セキュリティ、パフォーマンス、エッジケース
4. **テスト戦略**: 十分なカバレッジが見込めるか
5. **YAGNI/KISS**: 過剰な抽象化や不要な機能がないか

critical/high の問題がなければ approve、あれば revise を判定してください。
REVIEW_PROMPT

    echo -e "${GREEN}  → レビュー結果を保存: $review_output${NC}"
}

# --- Step 3: レビュー結果の表示 ---
display_review() {
    local review_file="$1"

    echo ""
    echo "=========================================="
    echo -e "${BLUE}  Codex Review Results${NC}"
    echo "=========================================="

    local verdict
    verdict=$(jq -r '.verdict' "$review_file")
    local confidence
    confidence=$(jq -r '.confidence' "$review_file")
    local summary
    summary=$(jq -r '.summary' "$review_file")

    case "$verdict" in
        approve) echo -e "  Verdict: ${GREEN}APPROVE${NC} (confidence: $confidence)" ;;
        revise)  echo -e "  Verdict: ${YELLOW}REVISE${NC} (confidence: $confidence)" ;;
        reject)  echo -e "  Verdict: ${RED}REJECT${NC} (confidence: $confidence)" ;;
    esac

    echo ""
    echo "  Summary: $summary"

    # Strengths
    local strength_count
    strength_count=$(jq -r '.strengths // [] | length' "$review_file")
    if [ "$strength_count" -gt 0 ]; then
        echo ""
        echo -e "  ${GREEN}Strengths:${NC}"
        jq -r '.strengths[] | "    + " + .' "$review_file"
    fi

    # Findings
    local finding_count
    finding_count=$(jq -r '.findings | length' "$review_file")
    if [ "$finding_count" -gt 0 ]; then
        echo ""
        echo -e "  ${YELLOW}Findings ($finding_count):${NC}"
        jq -r '.findings[] | "    [\(.severity | ascii_upcase)] [\(.category)] \(.title)\n      → \(.description)\n      💡 \(.suggestion // "N/A")\n"' "$review_file"
    fi

    # Missing considerations
    local missing_count
    missing_count=$(jq -r '.missing_considerations // [] | length' "$review_file")
    if [ "$missing_count" -gt 0 ]; then
        echo ""
        echo -e "  ${RED}Missing Considerations:${NC}"
        jq -r '.missing_considerations[] | "    ! " + .' "$review_file"
    fi

    echo "=========================================="
}

# --- Full Loop: 計画 → レビュー → 修正 ---
full_loop() {
    local prompt="$1"
    local timestamp
    timestamp=$(date +%Y%m%d-%H%M%S)
    local plan_file="$PLANS_DIR/${timestamp}-plan.md"
    local review_file="$PLANS_DIR/${timestamp}-review.json"
    local revised_file="$PLANS_DIR/${timestamp}-plan-revised.md"

    mkdir -p "$PLANS_DIR"

    # Step 1: 計画生成
    generate_plan "$prompt" "$plan_file"

    # Step 2: レビュー
    review_plan "$plan_file" "$review_file"

    # Step 3: 結果表示
    display_review "$review_file"

    # Step 4: 判定に応じた処理
    local verdict
    verdict=$(jq -r '.verdict' "$review_file")

    if [ "$verdict" = "approve" ]; then
        echo -e "\n${GREEN}計画が承認されました。実装を開始できます。${NC}"
        echo "Plan: $plan_file"
    elif [ "$verdict" = "revise" ]; then
        echo -e "\n${YELLOW}修正が必要です。Claude Code で修正中...${NC}"

        claude -p "以下の計画に対するレビューフィードバックを反映して、計画を修正してください。

## 元の計画
$(cat "$plan_file")

## レビューフィードバック
$(cat "$review_file")

修正した計画全文を出力してください。" \
            --permission-mode plan \
            --model "$CLAUDE_MODEL" \
            --output-format text \
            --max-turns "$MAX_TURNS" \
            > "$revised_file"

        echo -e "${GREEN}  → 修正済み計画: $revised_file${NC}"
        echo -e "${YELLOW}必要に応じて再度 review を実行してください:${NC}"
        echo "  $0 review $revised_file"
    else
        echo -e "\n${RED}計画が却下されました。要件を見直してください。${NC}"
    fi
}

# --- Main ---
case "${1:-}" in
    plan)
        shift
        [ $# -eq 0 ] && usage
        timestamp=$(date +%Y%m%d-%H%M%S)
        mkdir -p "$PLANS_DIR"
        generate_plan "$*" "$PLANS_DIR/${timestamp}-plan.md"
        ;;
    review)
        shift
        [ $# -eq 0 ] && usage
        plan_file="$1"
        review_file="${plan_file%.md}-review.json"
        review_plan "$plan_file" "$review_file"
        display_review "$review_file"
        ;;
    loop)
        shift
        [ $# -eq 0 ] && usage
        full_loop "$*"
        ;;
    *)
        usage
        ;;
esac
```

### 3.3 使い方

```bash
# 計画のみ生成
./scripts/harness.sh plan "ユーザー認証機能を実装する"

# 既存の計画をレビュー
./scripts/harness.sh review docs/plans/2026-02-20-auth-impl.md

# フルサイクル（計画 → レビュー → 修正）
./scripts/harness.sh loop "ユーザー認証機能を実装する"
```

---

## 4. Phase 2: SDK パイプライン（TypeScript）

より高度な制御が必要な場合のTypeScript実装。セッション管理、構造化出力、フィードバックループの自動化を提供。

### 4.1 アーキテクチャ

```typescript
// harness.ts — 型定義
interface PlanReview {
  readonly verdict: "approve" | "revise" | "reject";
  readonly confidence: number;
  readonly summary: string;
  readonly strengths: readonly string[];
  readonly findings: readonly Finding[];
  readonly missing_considerations: readonly string[];
}

interface Finding {
  readonly severity: "critical" | "high" | "medium" | "low";
  readonly category: string;
  readonly title: string;
  readonly description: string;
  readonly suggestion?: string;
}

interface HarnessConfig {
  readonly claudeModel: string;
  readonly codexModel: string;
  readonly maxBudgetUsd: number;
  readonly maxTurns: number;
  readonly maxIterations: number;  // revise ループの最大回数
  readonly plansDir: string;
  readonly schemasDir: string;
}
```

### 4.2 SDK 統合のイメージ

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import { Codex } from "@openai/codex-sdk";
import { readFile, writeFile } from "fs/promises";

async function runHarness(prompt: string, config: HarnessConfig): Promise<void> {
  let iteration = 0;
  let plan = "";
  let review: PlanReview | null = null;

  while (iteration < config.maxIterations) {
    // Step 1: Claude Code で計画生成（または修正）
    const planPrompt = iteration === 0
      ? prompt
      : `以下のフィードバックを反映して計画を修正:\n${JSON.stringify(review)}\n\n元の計画:\n${plan}`;

    for await (const msg of query({
      prompt: planPrompt,
      options: {
        permissionMode: "plan",
        model: config.claudeModel,
        maxTurns: config.maxTurns,
        maxBudgetUsd: config.maxBudgetUsd,
        settingSources: ["project"],
        systemPrompt: { type: "preset", preset: "claude_code" }
      }
    })) {
      if ("result" in msg) plan = msg.result;
    }

    // 計画をファイルに保存
    const planPath = `${config.plansDir}/iteration-${iteration}-plan.md`;
    await writeFile(planPath, plan);

    // Step 2: Codex でレビュー
    const codex = new Codex();
    const thread = codex.startThread();
    const reviewResult = await thread.run(
      `シニアアーキテクトとして以下の計画をレビュー:\n\n${plan}`
    );

    review = JSON.parse(reviewResult) as PlanReview;

    // レビュー結果を保存
    const reviewPath = `${config.plansDir}/iteration-${iteration}-review.json`;
    await writeFile(reviewPath, JSON.stringify(review, null, 2));

    // Step 3: 判定
    if (review.verdict === "approve") {
      console.log(`✓ Plan approved after ${iteration + 1} iteration(s)`);
      break;
    }

    if (review.verdict === "reject") {
      console.log(`✗ Plan rejected. Review: ${review.summary}`);
      break;
    }

    console.log(`↻ Revision needed (iteration ${iteration + 1})`);
    iteration++;
  }
}
```

---

## 5. Phase 3: MCP サーバー統合

Codex を MCP サーバーとして Claude Code から直接呼び出す高度な統合。

### 5.1 設定

```json
// .claude/settings.json
{
  "mcpServers": {
    "codex-reviewer": {
      "command": "npx",
      "args": ["-y", "@openai/codex", "mcp-server"],
      "env": {
        "CODEX_API_KEY": "${OPENAI_API_KEY}"
      }
    }
  }
}
```

### 5.2 Claude Code 内からの呼び出し

MCP 統合により、Claude Code のセッション内で Codex をツールとして呼び出せる：

```
Claude Code セッション
  ├─ 計画を生成
  ├─ MCP: codex-reviewer.codex("計画をレビューして")
  ├─ フィードバックを受信
  └─ 計画を修正
```

これにより、単一の Claude Code セッション内で計画 → レビュー → 修正のサイクルが完結する。

---

## 6. コスト見積もり

### Phase 1（MVP シェルスクリプト）1サイクルあたり

| ステップ | モデル | 推定トークン | 推定コスト |
|----------|--------|-------------|-----------|
| 計画生成 | Claude Opus | ~10K in / ~3K out | ~$0.20 |
| レビュー | gpt-5.2-codex | ~15K in / ~2K out | ~$0.15 |
| 修正（revise時） | Claude Opus | ~20K in / ~3K out | ~$0.35 |
| **合計（approve）** | | | **~$0.35** |
| **合計（revise 1回）** | | | **~$0.70** |

### コスト最適化オプション

- 計画生成に `sonnet` を使用: ~60% コスト削減
- レビューに `codex-mini-latest` を使用: ~70% コスト削減
- `--max-budget-usd` で上限設定

---

## 7. 推奨ロードマップ

| Phase | スコープ | 実装量 | 前提条件 |
|-------|---------|--------|----------|
| **1. MVP** | シェルスクリプト + JSON Schema | 1ファイル (~200行) | Codex CLI + Claude Code インストール済 |
| **2. SDK** | TypeScript ハーネス + セッション管理 | ~3ファイル (~500行) | npm パッケージ追加 |
| **3. MCP** | Claude Code 内統合 | 設定のみ | Codex MCP サーバー対応 |

### MVP 実装の最小ステップ

1. `schemas/plan-review.schema.json` を作成
2. `scripts/harness.sh` を作成
3. `codex login` でCodex認証
4. `./scripts/harness.sh loop "タスク内容"` で動作確認

---

## 8. 既存ツールとの比較・選択指針

| ツール | 特徴 | 採用判断 |
|--------|------|----------|
| **agent-mux** | 統一CLI、JSON契約 | 複数エージェント運用時に検討 |
| **Cub** | タスク管理、依存解決 | プロジェクト管理統合時に検討 |
| **myclaude** | 5フェーズオーケストレーション | エンタープライズ向け |
| **自作ハーネス（本設計）** | シンプル、カスタマイズ自由 | **MVP として推奨** |

本設計は自作ハーネスとして最小限から始め、必要に応じて agent-mux や Cub のパターンを取り込む方針。

---

## 参考資料

- [01-codex-capabilities.md](./01-codex-capabilities.md) — Codex CLI の機能詳細
- [02-claude-code-automation.md](./02-claude-code-automation.md) — Claude Code の自動化・SDK
- [03-multi-llm-harness-patterns.md](./03-multi-llm-harness-patterns.md) — マルチLLMハーネスのパターン
