# LLM-Driven Character Design

## Overview

PRNG ベースの決定論的キャラクター生成を廃止し、Claude API (Sonnet 4.6) で
キャラクターを生成する。各キャラクターは Claude の創造的解釈により唯一無二。

## Core Concept

- **生成トリガー**: ステージ進行時（0→1→2→3→4→5）に Claude API を1回呼ぶ
- **出力**: Claude がパーツリスト (JSON) を自由に生成。各パーツは Three.js プリミティブの組み合わせ
- **スタイル**: ローポリ・トイ（Crossy Road 風、flatShading）
- **表情**: 目 + 口の形状バリエーションを Claude が定義
- **質感**: 各パーツの roughness, metalness, color も Claude が決定
- **保存**: 生成結果を `state.json` に保存（ステージごとにキャッシュ）
- **フォールバック**: API 不可時は既存 PRNG ベース生成

## Data Flow

```
Personality Traits + Stage + Previous Parts
  ↓
designer.ts: Claude API (Sonnet 4.6)
  ↓
schema.ts: Zod validation
  ↓
state.json に generatedDesign 保存
  ↓
WebSocket push → buildFromDesign() → 3D 描画
```

## JSON Schema: CreatureDesign

```typescript
interface CreatureDesign {
  parts: Part[];
  expressions: Record<string, Expression>;
  personality: { name: string; quirk: string };
}

interface Part {
  name: string;           // 自由命名
  primitive: "sphere" | "box" | "cylinder" | "cone" | "torus" | "capsule";
  position: [number, number, number];
  rotation: [number, number, number];   // radians
  scale: [number, number, number];
  color: string;          // "#ff8844"
  material: {
    roughness: number;    // 0.0-1.0
    metalness: number;    // 0.0-1.0
    flatShading: boolean;
  };
  children?: Part[];      // recursive
  animatable?: {
    type: "sway" | "bob" | "rotate" | "wiggle" | "flap";
    speed?: number;
    amplitude?: number;
  };
}

interface Expression {
  eyes?: { scaleY?: number; offsetY?: number; shape?: "round" | "happy" | "sleepy" | "sparkle" };
  mouth?: { scaleX?: number; scaleY?: number; shape?: "smile" | "open" | "flat" | "pout" };
}
```

## Claude Prompt Design

```
あなたはキャラクターデザイナーです。
Three.jsで描画されるローポリ・トイスタイルの小さなクリーチャーをデザインしてください。

## このクリーチャーの性格データ
- アーキタイプ: {archetype} ({subtype}寄り)
- 特性スコア: builder={n}, fixer={n}, ...
- 深度: セッション数={n}, 編集テストループ={n}
- スタイル: コードブロック率={n}, 質問率={n}

## 現在のステージ: {stage}/5
- 0=卵 → 1=幼体 → 2=子供 → 3=青年 → 4=完成 → 5=マスター

## 前ステージのパーツ (継続性のため)
{previousParts as JSON}

## 制約
- 使えるプリミティブ: sphere, box, cylinder, cone, torus, capsule
- 各パーツには position, rotation, scale, color, material を指定
- ローポリ・トイスタイル (flatShading推奨)
- 全体で高さ1.5〜2.0ユニットに収まるサイズ
- ステージに応じた複雑さ（卵は単純、完成は詳細）
- 必ず両手両足があること（ステージ2以降）
- 表情セット(default, happy, sleepy, focused)を含める

以下のJSON形式で出力:
{schema}
```

## Animation System

| type | motion | example |
|------|--------|---------|
| `sway` | pendulum rotation | arms, antennae |
| `bob` | Y-axis up/down | whole body, floating parts |
| `rotate` | continuous rotation | decorations, propellers |
| `wiggle` | micro-oscillation | ears, tail |
| `flap` | open/close | wings, fins |

## Expression Triggers

| expression | trigger condition |
|------------|-------------------|
| `default` | normal state |
| `happy` | progress increasing, tokens growing |
| `sleepy` | late night, unused for a while |
| `focused` | close to stage advancement |

## Architecture Changes

### Modified Files

| file | change |
|------|--------|
| `src/sidecar/render-data.ts` | PRNG → Claude API call |
| `src/store/types.ts` | Add `generatedDesign: CreatureDesign` to PetRecord |
| `src/viewer/public/js/creature.js` | Fixed builder → generic `buildFromDesign()` |
| `src/viewer/public/js/animation.js` | Fixed animations → `animatable` flag-based |
| `package.json` | Add `@anthropic-ai/sdk` |

### New Files

| file | purpose |
|------|---------|
| `src/generation/designer.ts` | Claude API call, prompt assembly, response validation |
| `src/generation/schema.ts` | CreatureDesign Zod schema |
| `src/generation/prompt.ts` | prompt template |
| `src/viewer/public/js/expression.js` | expression switching system |

## Model

- **Claude Sonnet 4.6** (`claude-sonnet-4-6`)
- Auth: `ANTHROPIC_API_KEY` environment variable
- Fallback: existing PRNG-based generation when API unavailable

## Design Constraints

- Both arms and legs required (stage 2+)
- Height 1.5-2.0 units
- Low-poly toy style (flatShading)
- Stage progression: egg (simple) → complete (detailed)
- Growth continuity: previous stage parts passed to prompt
