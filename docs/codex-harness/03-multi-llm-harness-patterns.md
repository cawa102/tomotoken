# Multi-LLM Harness Patterns

マルチLLMハーネスのパターン、既存ツール、アーキテクチャに関する調査レポート。

## 目次

1. [2026年のハーネスパラダイム](#2026年のハーネスパラダイム)
2. [既存ツール・プロジェクト](#既存ツールプロジェクト)
3. [主要パターン](#主要パターン)
4. [シェルスクリプトオーケストレーション](#シェルスクリプトオーケストレーション)
5. [ハーネスアーキテクチャ比較](#ハーネスアーキテクチャ比較)
6. [各アプローチの長所・短所](#各アプローチの長所短所)
7. [実例・ケーススタディ](#実例ケーススタディ)
8. [Claude Code × Codex 統合への示唆](#claude-code--codex-統合への示唆)

---

## 2026年のハーネスパラダイム

### ハーネスとは何か

エージェントハーネスとは、AIモデルをラップして長時間タスクを管理するインフラストラクチャ層である。Phil Schmid はこれを次のアナロジーで説明している：

| 概念 | コンピュータ | エージェント |
|------|-------------|-------------|
| CPU | プロセッサ | LLMモデル |
| RAM | メモリ | コンテキストウィンドウ |
| OS | オペレーティングシステム | **エージェントハーネス** |
| アプリ | ユーザーアプリケーション | エージェントロジック |

ハーネスは「プロンプトプリセット、ツールコールのハンドリング、ライフサイクルフック、計画・ファイルシステムアクセス・サブエージェント管理などの機能」を提供する。

### モデルよりハーネスが重要

Can Bölük の研究 "The Harness Problem" は、**ハーネスの変更だけで15のLLMのコーディング性能が劇的に向上した**ことを実証した：

- Grok Code Fast 1: **6.7% → 68.3%**（10倍の改善）
- MiniMax: 2倍以上に向上
- Grok 4 Fast: 出力トークン61%削減

> 「弱いモデルほどハーネス最適化の恩恵が大きく、機械的な障害が実際のコーディング能力を覆い隠していた」

### Anthropic / OpenAI のハーネス戦略

**Anthropic** は長時間エージェント向けに二段階アプローチを採用：
1. **Initializer Agent**: 環境セットアップ（init.sh、進捗ファイル、gitコミット、機能リスト）
2. **Coding Agent**: インクリメンタルな実装（1機能ずつ、テスト→コミット→進捗更新）

**OpenAI** はハーネスエンジニアリングで以下を重視：
- コンテキストは希少資源 → 巨大な指示ファイルではなく「地図」を渡す
- Depth-first（深さ優先）: 大きな目標を小さなブロック（設計→コード→レビュー→テスト）に分解
- アーキテクチャ制約の強制: カスタムリンター + 構造テスト + 「taste invariants」

---

## 既存ツール・プロジェクト

### agent-mux

**概要**: 1つのCLIでCodex、Claude Code、OpenCodeのエージェントを統一的にスポーンする。

**主な機能**:
- 統一出力契約（JSON）: `success`, `engine`, `response`, `timed_out`, `duration_ms`, `activity`
- エフォートスケールドタイムアウト: low(2分) / medium / high / xhigh(40分)
- ハートビートプロトコル: 15秒ごとにstderrに進捗シグナル
- アクティビティトラッキング: 変更ファイル、実行コマンド、読取ファイル、MCPコール

**重要パターン**: "Claude plans, Codex executes code, Claude verifies" — 計画→実行→検証の分離

```
Claude Code (計画) → agent-mux → Codex (実装) → agent-mux → Claude Code (検証)
```

### Cub

**概要**: Claude Code / Codex / Gemini / OpenCodeをラップし、構造化された自律タスク実行を提供するCLIツール。

**ワークフロー**:
1. タスク選択（依存関係解決、優先度ソート）
2. プロンプト生成（runloop指示 + プロジェクトアーキテクチャ + タスク詳細）
3. ハーネス呼び出し（設定されたAIツールに委任）
4. 検証・記録（終了コード、gitコミット、トークン使用量、成果）

**ガードレール**: トークン/コスト上限、回路ブレーカー、クリーンgit状態強制。

### myclaude

**概要**: Claude Code、Codex、Gemini、OpenCodeにまたがるマルチエージェントオーケストレーションワークフロー。

**モジュール構成**:
- `do`: 5フェーズオーケストレーション（推奨）
- `omo`: バグ調査・修正向けマルチエージェント
- `bmad`: 6つの専門エージェントによるエンタープライズアジャイル
- `sparv`: Specify→Plan→Act→Review→Vault

### aider（Architect/Editorモード）

**概要**: 2つの異なるLLMで「推論」と「編集」を分離するデュアルモデルアーキテクチャ。

**アーキテクチャ**:
- **Architect**: 問題解決に専念し、解法を自然言語で記述
- **Editor**: 解法を正確なファイル編集指示に変換

**ベンチマーク結果**:
- o1-preview + DeepSeek/o1-mini: **85% pass rate**（SOTA）
- o1-preview + Claude 3.5 Sonnet: **82.7%**
- DeepSeekは複数のArchitectモデルに対して優秀なEditor

### llm-argumentation-protocol

**概要**: LLM間の構造化された敵対的コンサルテーションプロトコル。

**フェーズ構造**（最大8イテレーション）:
1. フェーズ1-2: 新しい議論の提示
2. フェーズ3-5: 防御のみの応答
3. フェーズ6-8: 最終判定

**エビデンスゲート**: 実行エビデンス（テスト結果、ログ）＞テキスト引用（file:line参照）＞主張のみ

---

## 主要パターン

### Pattern 1: LLM-as-Judge（審判パターン）

あるLLMが生成したコードを、別のLLM（審判）が評価するパターン。

```
Generator LLM ──(code)──> Judge LLM ──(verdict + score)──> Result
```

**手法**:
- **Single Output**: 個別のLLM出力をスコアリング
- **Pairwise**: 2つの出力から「勝者」を選択（LLM Arenaの自動版）
- **Few-shot**: 評価例を含めることでGPT-4の一貫性が65.0%→77.5%に向上

**コードレビューへの応用**:
- 大規模モデル（GPT-4o、DeepSeek-V2.5）がone-shotで最も高い評価精度
- 出力ベース評価では、微調整モデルよりSOTAモデルが優位

**バイアス軽減策**:
- 位置バイアス対策: (A,B)と(B,A)の両方向で評価（Swapping Operation）
- マルチエージェント協調: 「陪審」、ディベート、ロールプレイによる合意形成

### Pattern 2: Debate/Adversarial Review（討論・敵対的レビュー）

複数のLLMが互いの推論を批評し合い、合意に収束するパターン。

```
LLM A ──(position)──> LLM B ──(critique)──> LLM A ──(defense)──> Consensus
```

**研究成果**:
- 数学的推論の大幅な改善、事実のハルシネーション削減
- CourtEval/DEBATEフレームワーク: 人間の判断との相関でSOTA
- D3フレームワーク: 敵対的議論 + 多様な専門家視点で質的差異を発見
- コンセンサスオプティマイザー: 各エージェントの投票を信頼度で重み付け → **4-6%の精度向上、事実エラー30%以上削減**

**コードレビューでの知見**:
- 敵対的コメントによるLLMコードレビュアーの操作は、予想より困難（arXiv:2602.16741）
- 高度な戦略は単純な戦略と同程度の効果 → LLMレビュアーはロバスト

### Pattern 3: Architect/Editor（設計者/編集者分離）

推論と実装を異なるモデルに分担させるパターン。aiderが実証。

```
User Request → Architect LLM → Solution Description → Editor LLM → File Edits
```

**利点**:
- 各モデルが専門タスクに集中
- 強力な推論モデル（o1等）を安価なEditorと組み合わせ可能
- コスト最適化とパフォーマンスの両立

### Pattern 4: Builder/Reviewer（構築者/レビュア分離）

一方のLLMがコードを生成し、別のLLMがレビューするパターン。

```
Claude Code (build) → コード変更 → Codex (review) → フィードバック → Claude Code (修正)
```

**SmartScope Blog の提案する決定基準**:
- One-shot タスク → Codex
- 対話的探索 → Claude Code
- 大規模リファクタリング → Codex
- デバッグ調査 → Claude Code

### Pattern 5: Cross-Verification（クロス検証）

複数のLLM（異なるプロバイダー）で同じタスクを実行し、結果を比較・統合するパターン。

```
Task → [Claude, GPT-4, DeepSeek] → Cross-Verification → Best Result
```

**CVCP（Cross-Verification Collaboration Protocol）の成果**:
- GPT-4 + DeepSeek-Coder + Claude-3.5 の3モデル使用
- DeepSeek-Coder + CVCP: Pass@1が**22.3→29.0**（30%向上）
- マルチエージェント使用で精度が**32.8%→72.4%**（39.7ポイント向上）

---

## シェルスクリプトオーケストレーション

### 基本パターン: タスクベースルーティング

```bash
#!/bin/bash
# タスク内容に基づいてClaude CodeまたはCodexに自動ルーティング

TASK="$1"

# キーワードベースのルーティング
if echo "$TASK" | grep -qiE "batch|automate|refactor|test"; then
    echo "→ Codex CLIにルーティング"
    codex exec --sandbox read-only "$TASK"
elif echo "$TASK" | grep -qiE "investigate|why|debug|explain"; then
    echo "→ Claude Codeにルーティング"
    claude -p "$TASK"
fi
```

### Builder/Reviewer ハーネス

```bash
#!/bin/bash
# Claude Code (builder) → Codex (reviewer) パイプライン

TASK="$1"
WORKSPACE=$(pwd)

# Phase 1: Claude Codeで実装
echo "=== Phase 1: Building with Claude Code ==="
claude -p "Implement the following: $TASK" \
    --output-format json > /tmp/build-result.json

# Phase 2: git diffを取得
DIFF=$(git diff)

# Phase 3: Codexでレビュー
echo "=== Phase 2: Reviewing with Codex ==="
codex exec \
    -c model="gpt-5.3-codex" \
    --sandbox read-only \
    "Review this diff for bugs, security issues, and code quality:
$DIFF

Focus on: error handling, type safety, security.
Output format: severity (CRITICAL/HIGH/MEDIUM/LOW), file, line, issue, fix."
```

### Codex を Claude Code 内で実行（Headless）

```bash
# Claude Codeのスキルとして定義
codex exec \
    -c model="gpt-5.3-codex" \
    -c model_reasoning_effort="xhigh" \
    --sandbox read-only \
    --ephemeral \
    "Review the code in src/ directory for potential issues"
```

**重要フラグ**:
- `--sandbox read-only`: ファイルの読取りのみ許可（書込み・作成・削除不可）
- `--ephemeral`: セッション永続化を無効化

### agent-mux を使った統合パイプライン

```bash
# agent-mux: 統一CLI経由でマルチエンジン実行
agent-mux run \
    --engine codex \
    --effort high \
    --prompt "Implement feature X with tests"

# 結果は統一JSONフォーマット:
# { success, engine, response, timed_out, duration_ms, activity }
```

---

## ハーネスアーキテクチャ比較

### Pipe-based（パイプベース）

```
stdin → LLM A → stdout → pipe → stdin → LLM B → stdout
```

**実装**: シェルパイプ、`codex exec` + `claude -p`

| 項目 | 評価 |
|------|------|
| 実装容易性 | ★★★★★ |
| 柔軟性 | ★★☆☆☆ |
| エラーハンドリング | ★★☆☆☆ |
| 状態管理 | ★☆☆☆☆ |

**最適用途**: 単純なレビューパイプライン、ワンショットタスク

### File-based（ファイルベース）

```
LLM A → output.json → [harness reads] → LLM B → result.json
```

**実装**: 一時ファイル経由の中間結果、gitリポジトリを共有コンテキストとして利用

| 項目 | 評価 |
|------|------|
| 実装容易性 | ★★★★☆ |
| 柔軟性 | ★★★☆☆ |
| エラーハンドリング | ★★★☆☆ |
| 状態管理 | ★★★★☆ |

**最適用途**: マルチステップワークフロー、進捗追跡が必要な場合

### API-based（APIベース）

```
Orchestrator → [API call to Model A] → process → [API call to Model B] → aggregate
```

**実装**: agent-mux、Cub、LangChain、Agent SDK

| 項目 | 評価 |
|------|------|
| 実装容易性 | ★★★☆☆ |
| 柔軟性 | ★★★★★ |
| エラーハンドリング | ★★★★★ |
| 状態管理 | ★★★★★ |

**最適用途**: 複雑なオーケストレーション、プロダクション環境

### CLI Wrapper（CLIラッパーベース）

```
Wrapper CLI → [spawn Claude Code] → [spawn Codex] → unified output
```

**実装**: agent-mux、Cub

| 項目 | 評価 |
|------|------|
| 実装容易性 | ★★★★☆ |
| 柔軟性 | ★★★★☆ |
| エラーハンドリング | ★★★★☆ |
| 状態管理 | ★★★★☆ |

**最適用途**: 開発者ワークフロー、エージェント間のコンテキスト共有

---

## 各アプローチの長所・短所

### LLM-as-Judge

| 長所 | 短所 |
|------|------|
| スケーラブルな自動評価 | 審判モデル自体のバイアス |
| 人間レビューのコスト削減 | 位置バイアス問題 |
| 一貫した基準適用 | 微妙なバグの見落とし可能性 |
| Few-shotで精度向上可能 | 評価基準の設計が重要 |

### Debate/Adversarial

| 長所 | 短所 |
|------|------|
| エラー発見率向上（39.7pt向上） | APIコスト高（複数ラウンド） |
| ハルシネーション削減 | 収束に時間がかかる |
| 多角的視点の獲得 | 実装の複雑さ |
| ロバストな結論 | 両方のモデルが同じ誤りを持つ場合は無力 |

### Architect/Editor

| 長所 | 短所 |
|------|------|
| 各モデルの得意分野を活用 | 2つのAPIコール必要 |
| コスト最適化（安価なEditorを使用可能） | Architect-Editor間の意図伝達ロス |
| ベンチマークで高い成果（85% SOTA） | デバッグが複雑化 |

### Builder/Reviewer

| 長所 | 短所 |
|------|------|
| 直感的なワークフロー | フィードバックループの遅延 |
| 異なるモデルの強みを組合せ | コンテキストの重複 |
| 自動化が容易 | レビュアーの修正適用が別ステップ |

### Cross-Verification

| 長所 | 短所 |
|------|------|
| 最も高い精度（72.4%） | 最もコスト高（3モデル並列） |
| モデル固有のバイアスを相殺 | 結果統合のロジックが複雑 |
| 重要なコードに最適 | レイテンシが加算 |

---

## 実例・ケーススタディ

### Case 1: The Harness Problem（Can Bölük, 2026/02）

**問題**: LLMベンチマークのスコア差がモデル性能ではなく編集ツールの実装に起因していた。

**3つの編集ツール戦略**:
1. **Patch Format**（OpenAI/Codex）: diff形式 → 非Codexモデルで50.7%失敗率
2. **String Replace**（Claude/Gemini）: 正確な文字列マッチ → ホワイトスペースで頻繁に失敗
3. **Neural Approach**（Cursor）: 編集専用70Bモデルを訓練

**Hashline解決策**: 各行に2-3文字のコンテンツハッシュを付与 → 再現要件の排除 + 検証可能なアンカー

**結果**: ハーネス変更だけで、弱いモデルが最も大きな恩恵を受けた。

### Case 2: Anthropic の長時間エージェントハーネス

**アプローチ**: Initializer + Coding Agent の二段階。

**重要な教訓**:
- 機能リストを全て「failing」で初期化 → エージェントの「早期勝利宣言」防止
- テスト削除・編集の禁止を明示
- ブラウザ自動化ツール（Puppeteer MCP）の提供で検証品質が劇的に向上
- 各セッション開始時: `pwd` → git log読取り → 進捗ファイル読取り → 最優先機能選択

### Case 3: aider Architect/Editor ベンチマーク

**検証**: 複数のArchitect/Editor組み合わせをテスト。

**発見**:
- o1-preview（Architect）+ DeepSeek（Editor）: コストパフォーマンス最良
- DeepSeekは「驚くほど効果的なEditor」として複数のArchitectモデルに対応
- 自己ペアリング（同じモデルをArchitectとEditorの両方に）でも性能向上

### Case 4: CVCP マルチモデルコード検証

**設定**: GPT-4 + DeepSeek-Coder + Claude-3.5 による3モデルクロス検証。

**プロトコル**:
1. 対称性検出
2. 対称性ガイド付き敵対的テスト
3. ラウンドトリップレビュー（RTRP）
4. 非同期投票解決（AVR）

**成果**: 単一エージェントの32.8%から、最良の2エージェント構成で79.3%まで向上。

---

## Claude Code × Codex 統合への示唆

### 推奨アーキテクチャ

調査結果から、Claude Code → Codex フィードバックハーネスに最適なパターンは**Builder/Reviewer + File-based**の組み合わせ：

```
┌─────────────────────────────────────────────────┐
│                  Harness Layer                    │
│                                                   │
│  1. Claude Code (Builder)                         │
│     └─ 実装 → git commit → diff出力               │
│                                                   │
│  2. Diff を一時ファイルへ書出し                      │
│     └─ /tmp/review-input.md                       │
│                                                   │
│  3. Codex CLI (Reviewer) - headless/read-only     │
│     └─ codex exec --sandbox read-only             │
│     └─ 構造化レビュー結果をJSONで出力               │
│                                                   │
│  4. Claude Code (Integrator)                      │
│     └─ レビュー結果を解析                           │
│     └─ 修正適用 or 却下判断                        │
│                                                   │
│  5. 最終検証 → git commit                          │
└─────────────────────────────────────────────────┘
```

### 実装の優先度

1. **Phase 1（MVP）**: パイプベースの単純なBuilder/Reviewer
   - `claude -p` → `git diff` → `codex exec --sandbox read-only`
   - シェルスクリプト1ファイルで実装可能

2. **Phase 2**: ファイルベースの状態管理追加
   - レビュー結果の構造化保存
   - フィードバックループの自動化

3. **Phase 3**: API/CLIラッパーによるフル統合
   - agent-mux スタイルの統一出力契約
   - エフォートスケーリング、タイムアウト、アクティビティトラッキング

### 設計原則（業界の知見から）

1. **Start Simple**: 複雑な制御フローを避け、堅牢なアトミックツールを提供
2. **Build to Delete**: モジュラーに保ち、モデル進化に対応
3. **Context is Scarce**: 巨大な指示ではなく「地図」を渡す
4. **Depth-first**: 大きな目標を小さなブロック（設計→コード→レビュー→テスト）に分解
5. **Git as State**: gitリポジトリをエージェント間の共有コンテキストとして活用

---

## 参考リンク

- [The Harness Problem - Can Bölük](https://blog.can.ac/2026/02/12/the-harness-problem/)
- [Agent Harness 2026 - Phil Schmid](https://www.philschmid.de/agent-harness-2026)
- [Effective Harnesses for Long-Running Agents - Anthropic](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Harness Engineering - OpenAI](https://openai.com/index/harness-engineering/)
- [Harness Engineering - Martin Fowler / Birgitta Böckeler](https://martinfowler.com/articles/exploring-gen-ai/harness-engineering.html)
- [2025 Was Agents, 2026 Is Agent Harnesses - Aakash Gupta](https://aakashgupta.medium.com/2025-was-agents-2026-is-agent-harnesses-heres-why-that-changes-everything-073e9877655e)
- [aider Architect Mode](https://aider.chat/2024/09/26/architect.html)
- [Codex × Claude Code Integration - SmartScope](https://smartscope.blog/en/ai-development/practices/codex-claude-code-workflow-integration/)
- [agent-mux](https://github.com/buildoak/agent-mux)
- [Cub CLI](https://github.com/lavallee/cub)
- [myclaude](https://github.com/cexll/myclaude)
- [LLM Argumentation Protocol](https://github.com/Alex-R-A/llm-argumentation-protocol)
- [Running Headless Codex CLI Inside Claude Code](https://amanhimself.dev/blog/running-headless-codex-cli-inside-claude-code/)
- [CVCP - Cross-Verification Collaboration Protocol](https://www.mdpi.com/2073-8994/17/10/1660)
- [LLM-as-a-Judge Guide - Evidently AI](https://www.evidentlyai.com/llm-guide/llm-as-a-judge)
- [Multi-Agent Debate Strategies - Emergent Mind](https://www.emergentmind.com/topics/multi-agent-debate-mad-strategies)
- [Adversarial Multi-Agent Evaluation - OpenReview](https://openreview.net/forum?id=06ZvHHBR0i)
- [LLM Code Reviewers Adversarial Study - arXiv](https://arxiv.org/html/2602.16741)
