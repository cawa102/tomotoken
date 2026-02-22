# Web App Migration Design

## Overview

TomotokenをCLI/TUIアプリから単一Webアプリに転換する。
Ink TUI、commander CLI、ASCII artパイプラインを削除し、Three.js viewerをメインアプリに昇格。
図鑑機能をWeb UIとして新規実装。

## Page Structure

2ページ構成:

- `/` — メインページ（現在の3Dビューア。変更なし）
- `/zukan` — 図鑑ページ（新規）

ナビゲーション: フローティングボタン（画面の隅にアイコン、ページ間を行き来）

フロントエンド技術: vanilla HTML + JS（ES modules）。フレームワーク不使用。

## Zukan Page

### Layout

カードグリッド（レスポンシブ）。

各カードの内容:
- サムネイル画像（PNG、スナップショット）
- アーキタイプ名
- 完了日
- カラーパレット（小さいドット表示）

### Detail Modal

カードクリック → モーダルオーバーレイ:
- Three.js 3Dビューア（メインページのレンダラコードを再利用）
- 性格情報（アーキタイプ、サブタイプ、8トレイトのレーダーチャート）
- 日付（spawn〜completion）
- トークン数

### Snapshot Generation

- タイミング: ペット完了時、クライアント側で `renderer.domElement.toDataURL("image/png")` 実行
- サーバーへ `POST /api/snapshot/:petId`
- 保存先: `~/.tomotoken/snapshots/{petId}.png`
- 配信: `GET /api/snapshot/:petId` で静的ファイルとして返す

## API Endpoints

### New

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/collection` | 完了ペット一覧（petId, archetype, traits, dates, tokens, hasSnapshot） |
| GET | `/api/collection/:petId` | 単体ペット詳細（personality + CreatureDesign） |
| POST | `/api/snapshot/:petId` | スナップショットPNG受信・保存 |
| GET | `/api/snapshot/:petId` | スナップショットPNG配信 |

### Existing (unchanged)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/pet` | 現在のペットのPetRenderData |
| WebSocket | `/` | 5秒ポーリングでPetRenderData push |

### Collection Response Format

```json
{
  "pets": [
    {
      "petId": "abc12345",
      "archetype": "builder",
      "subtype": "fixer",
      "traits": { "builder": 85, "fixer": 72 },
      "consumedTokens": 1000000000,
      "spawnedAt": "2026-01-15T...",
      "completedAt": "2026-02-10T...",
      "hasSnapshot": true
    }
  ]
}
```

`frames` と `colorFrames`（ASCII art）はレスポンスから除外。

## Deletion Targets

### Directories (delete entirely)

- `src/ui/` — Ink TUIコンポーネント全体
- `src/art/` — ASCIIアート生成パイプライン全体
- `src/window/` — ターミナルウィンドウ生成
- `src/encouragement/` — 応援メッセージ

### Files to Rewrite

- `bin/tomotoken.ts` — commander全コマンド削除、Express server起動のみに書き換え
- `src/index.ts` — Ink/CLI依存のインポート削除
- `src/sidecar/render-data.ts` — frames, colorFrames生成を削除（ASCII art依存を切る）
- `src/store/types.ts` — CompletedPetから frames, colorFrames フィールド削除

### Dependencies to Remove (package.json)

- `ink` — TUI framework
- `react`, `@types/react` — Ink dependency
- `commander` — CLI routing
- `chalk` — ANSI color (ASCII art用)

### Tests to Delete

- `test/ui/` — TUIコンポーネントテスト
- `test/art/` — ASCIIアートテスト
- `test/window/` — ウィンドウ生成テスト
- `test/encouragement/` — 応援メッセージテスト

## Startup Flow

### User Experience

```bash
npm start  # → Express起動 → localhost:3456
```

### bin/tomotoken.ts (after rewrite)

1. `validateStartup()` でAPIキー + Blenderチェック
2. 初回起動なら `buildFirstRunState()` で初期ペット生成
3. `runFull()` でパイプライン実行（ingestion → progression → personality）
4. Express server起動（port 3456）
5. WebSocketポーリング開始（5秒間隔）
6. コンソールに `Tomotoken running at http://localhost:3456` を表示

### npm scripts

| Script | Change |
|--------|--------|
| `start` | viewer server起動（旧 `dev:viewer` の役割を引き継ぐ） |
| `build` | tsupビルド（変更なし） |
| `test` | vitest（削除後のテストのみ） |
| `dev:viewer` | 削除（`start` に統合） |
| `sidecar` | 削除（server内部で直接呼ぶ） |

### Rescan

専用コマンドは削除。`rm ~/.tomotoken/state.json` してから `npm start` で代替。READMEに記載。

## Main Page Changes

変更なし。現在の3Dビューア（3Dキャンバス + レーダーチャート + プログレスバー）をそのまま維持。
stats情報は載せない。ペット体験に集中。

フローティングボタン（図鑑アイコン）のみ追加。
