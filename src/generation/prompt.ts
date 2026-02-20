import type { DepthMetrics, StyleMetrics } from "../store/types.js";

export interface PromptInput {
  readonly archetype: string;
  readonly subtype: string;
  readonly traits: Record<string, number>;
  readonly depth: DepthMetrics;
  readonly style: StyleMetrics;
  readonly stage: number;
  readonly previousParts: readonly unknown[] | null;
}

const STAGE_DESCRIPTIONS = [
  "0=卵: 単純な卵形。模様や色で個性を出す",
  "1=幼体: 小さく丸い体。手足はまだ短い",
  "2=子供: 両手両足が生え揃い、耳や尻尾が出始める",
  "3=青年: 体が大きくなり、角や模様などの装飾が増える",
  "4=完成: 全てのパーツが揃い、翼やアクセサリーも付く",
  "5=マスター: 完成形に光り輝くエフェクトや特別な装飾が加わる",
];

export function buildPrompt(input: PromptInput): string {
  const traitList = Object.entries(input.traits)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");

  const previousPartsSection = input.previousParts
    ? `\n## 前ステージのパーツ (成長の連続性のため、色やアクセサリーの参考にする)\n\`\`\`json\n${JSON.stringify(input.previousParts, null, 2)}\n\`\`\``
    : "\n## 前ステージ\nなし（初回生成）";

  return `あなたはキャラクターデザイナーです。
ヒューマノイド型のトイスタイル・クリーチャーの色・アクセサリー・表情・性格をカスタマイズしてください。
体の形状（ジオメトリ）はテンプレートで固定済みです。あなたが決めるのは見た目と性格です。

## このクリーチャーの性格データ
- アーキタイプ: ${input.archetype} (${input.subtype}寄り)
- 特性スコア: ${traitList}
- 深度: セッション数=${input.depth.totalSessions}, 編集テストループ=${input.depth.editTestLoopCount}, フェーズ切替=${input.depth.phaseSwitchCount}
- スタイル: コードブロック率=${input.style.codeblockRatio.toFixed(2)}, 質問率=${input.style.questionRatio.toFixed(2)}, 見出し率=${input.style.headingRatio.toFixed(2)}, 平均メッセージ長=${Math.round(input.style.avgMessageLen)}
${previousPartsSection}

## 現在のステージ: ${input.stage}/5
${STAGE_DESCRIPTIONS.map(d => `- ${d}`).join("\n")}

## カスタマイズ項目
- bodyColor: メインの体色 (hex "#RRGGBB")
- accentColor: 耳・脚・尻尾などのアクセント色 (hex "#RRGGBB")
- eyeColor: 瞳の色 (hex "#RRGGBB")
- accessoryColor: アクセサリーの色 (hex "#RRGGBB")
- showAccessories: 付けるアクセサリーの配列。選択肢: ["hat", "scarf", "backpack", "glasses"]（ステージにふさわしい数を選ぶ）
- animationStyle: アニメーションスタイル。"calm"（穏やか）、"energetic"（活発）、"sleepy"（眠そう）から1つ
- expressions: 表情セット (default, happy, sleepy, focused)
  - eyes: { scaleY?, offsetY?, shape?: "round"|"happy"|"sleepy"|"sparkle" }
  - mouth: { scaleX?, scaleY?, shape?: "smile"|"open"|"flat"|"pout" }
- personality: { name: キャラ名, quirk: 一言性格 }

## 色選びのヒント
- アーキタイプや特性スコアに合った色合いを選ぶ（例: builder→暖色系, scholar→寒色系）
- bodyColorとaccentColorは調和する配色にする
- ステージが高いほど華やかな色を使ってよい

以下のJSON形式のみで出力してください（説明文不要）:
{
  "bodyColor": "#RRGGBB",
  "accentColor": "#RRGGBB",
  "eyeColor": "#RRGGBB",
  "accessoryColor": "#RRGGBB",
  "showAccessories": [],
  "animationStyle": "calm",
  "expressions": { "default": { "eyes": { "shape": "round" }, "mouth": { "shape": "flat" } }, "happy": ..., "sleepy": ..., "focused": ... },
  "personality": { "name": "...", "quirk": "..." }
}`;
}
