# Open Source UX Design

## Overview

Tomotoken をオープンソース公開する際のユーザー体験設計。
Blender/Three.js の役割整理、LLM プロバイダー汎用化、初回起動体験、セットアップフローを定義する。

## Background

現状の 3D パイプラインは Blender（オフライン後処理）と Three.js（ランタイムレンダリング）の 2 層構成。
公開時、ユーザーが全ツールチェーンをセットアップする負担を最小化しつつ、初回体験で感情的なフックを提供する。

## Architecture: Blender vs Three.js

### Blender（開発時・オフライン）

- Hyper3D 生成モデルの後処理専用
- 3 つの処理: ラティス変形（目拡大 1.6x）、デシメーション（20K 面）、スムーズシェーディング（60°）
- Blender MCP アドオン経由で Claude Code から操作
- `.mcp.json` はリポジトリに同梱済み（クローン時に自動設定）

### Three.js（ランタイム・ブラウザ）

- WebGL 3D ビューアーのレンダリングエンジン
- GLB モデルのロード、トゥーンシェーディング、モーフターゲット、アニメーション
- ユーザーのブラウザで動作（追加インストール不要）

### 結論

Blender はランタイムでは使用しない。3D モデル後処理（キャラ生成時）にのみ必要。
Three.js のみでの開発は後処理の品質を維持できないため、Blender は必須依存。

## LLM Provider Abstraction

### 対応プロバイダー

Anthropic と OpenAI の 2 社対応。config で切替。

### インターフェース

```typescript
interface LLMProvider {
  generateText(prompt: string, system: string): Promise<string>
}
```

### 設定

```json
{
  "llm": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "apiKey": "sk-..."
  }
}
```

- `provider`: `"anthropic"` | `"openai"`
- `model`: ユーザーが自由に指定。未指定時はプロバイダーごとのデフォルト
- `apiKey`: 環境変数もフォールバック対応（`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`）

### デフォルトモデル

| プロバイダー | デフォルト |
|---|---|
| Anthropic | claude-sonnet-4-20250514 |
| OpenAI | gpt-4o |

### 実装

```
src/generation/
  ├── designer.ts           # リファクタ: LLMProvider を注入
  ├── llm-provider.ts       # NEW: インターフェース定義
  ├── anthropic-provider.ts # NEW: Anthropic SDK 実装
  └── openai-provider.ts    # NEW: OpenAI SDK 実装
```

- プロンプトは完全に共通（キャラデザイン生成のテキスト生成のみ）
- `designer.ts` は依存性逆転でプロバイダーを注入
- 将来の新モデル対応は config の `model` 変更のみ（コード変更不要）

## First-Run Experience

### コンセプト

「これまでのあなた」— 初回起動で過去の Claude Code 使用履歴からオリジナルキャラクターを即座に生成。
感情的なフックとして機能し、2 体目以降の卵育成への動機付けになる。

### 検出ロジック

```
state.json が存在しない OR (collection が空 AND currentPet が未生成)
  → 初回フロー発動
```

### 初回インジェスション

1. 全ログファイルをスキャン → タイムスタンプでソート
2. **新しい方から** 1B トークン分のみ抽出
3. その範囲内で性格分析を実行
4. 1B 未満の場合は全量を使用（300M でも 1 体生成）
5. 1 体目を即座に「完了済み」としてコレクションに追加

### パフォーマンス

- 4B トークン（1,684 ファイル、540MB）で初回スキャン 5〜10 秒
- 一般的なユーザーは 1 秒未満
- 50MB チャンク読み込み + インクリメンタルオフセットで効率的

### 2 体目以降

- 通常の卵育成フロー（1B トークン/体）
- インクリメンタル差分読み込み（10〜50ms）

## Startup Validation

### バリデーション順序

```
tomotoken 起動
  1. LLM API キー確認
     ✗ → "API キーが未設定です。README の Setup > API Key を参照してください"
  2. Blender 実行パス検出（which blender or config 値）
     ✗ → "Blender が見つかりません。インストール手順: README の Setup > Blender"
  3. MCP 接続テスト（blender-mcp ping）
     ✗ → "Blender MCP アドオンが未設定です。手順: README の Setup > Blender > Addon"
  4. 全て OK → 通常起動 or 初回フロー
```

### 実装

```typescript
// src/validation/startup.ts
interface ValidationResult {
  ok: boolean
  errors: ValidationError[]
}

interface ValidationError {
  component: 'api_key' | 'blender' | 'mcp'
  message: string
  helpUrl: string
}
```

## Setup Flow (Documentation-Based)

CLI ウィザードは作らない。十分なドキュメンテーションで案内。

### Prerequisites

- Node.js 18+
- Blender 4.x
- LLM API Key（Anthropic or OpenAI）

### README 構成

```
README.md
├── Overview（キャラクター画像付き紹介）
├── Features
├── Prerequisites
├── Setup
│   ├── 1. Clone & Install
│   ├── 2. Blender Setup
│   │   ├── ダウンロード & インストール
│   │   ├── blender-mcp アドオン追加手順（スクリーンショット付き）
│   │   └── アドオンの有効化確認
│   ├── 3. API Key 設定
│   │   ├── Anthropic
│   │   └── OpenAI
│   └── 4. 設定確認 (tomotoken 起動 → バリデーション)
├── Usage
├── How It Works
├── Configuration
└── Contributing
```

### MCP 設定

`.mcp.json` がリポジトリに同梱済み。クローン時に自動で設定される。
ユーザーは Blender + アドオンのインストールのみ行えば MCP 接続が有効になる。

## Design Decisions

| 判断 | 理由 |
|---|---|
| Blender 必須 | 後処理（目拡大・デシメーション・スムージング）の品質維持 |
| LLM 2 社のみ | YAGNI。主要 2 社で大半のユーザーをカバー |
| model フィールド追加 | 将来の新モデル対応をコード変更なしで実現 |
| 初回は直近 1B のみ | 古いログは現在のユーザー像を反映しない |
| 1B 未満でも生成 | 「すぐ体験できる」を優先。閾値で門前払いしない |
| CLI ウィザードなし | API キー入力に CLI を使うサービスは少ない。ドキュメントで十分 |
| セットアップ必須 | デグレード体験は提供しない。フルパイプラインか何もなし |
| フル検証 | 起動時に全依存を検証し、不足は具体的なエラーで案内 |
