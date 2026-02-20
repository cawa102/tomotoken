import type { DepthMetrics, StyleMetrics } from "../store/types.js";
import type { Part } from "./schema.js";

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

  const limbConstraint = input.stage >= 2
    ? "\n- 必ず両手両足があること（左右の腕と脚のパーツを含める）"
    : "";

  const previousPartsSection = input.previousParts
    ? `\n## 前ステージのパーツ (成長の連続性のため、これらを土台に発展させる)\n\`\`\`json\n${JSON.stringify(input.previousParts, null, 2)}\n\`\`\``
    : "\n## 前ステージ\nなし（初回生成）";

  return `あなたはキャラクターデザイナーです。
Three.jsで描画されるローポリ・トイスタイルの小さなクリーチャーをデザインしてください。
ユニークで愛着の湧くキャラクターを自由に想像してください。

## このクリーチャーの性格データ
- アーキタイプ: ${input.archetype} (${input.subtype}寄り)
- 特性スコア: ${traitList}
- 深度: セッション数=${input.depth.totalSessions}, 編集テストループ=${input.depth.editTestLoopCount}, フェーズ切替=${input.depth.phaseSwitchCount}
- スタイル: コードブロック率=${input.style.codeblockRatio.toFixed(2)}, 質問率=${input.style.questionRatio.toFixed(2)}, 見出し率=${input.style.headingRatio.toFixed(2)}, 平均メッセージ長=${Math.round(input.style.avgMessageLen)}
${previousPartsSection}

## 現在のステージ: ${input.stage}/5
${STAGE_DESCRIPTIONS.map(d => `- ${d}`).join("\n")}

## 制約
- 使えるプリミティブ: sphere, box, cylinder, cone, torus, capsule
- 各パーツに position [x,y,z], rotation [x,y,z] (ラジアン), scale [x,y,z], color (hex "#RRGGBB"), material {roughness, metalness, flatShading} を指定
- ローポリ・トイスタイル (flatShading: true 推奨)
- 全体で高さ1.5〜2.0ユニットに収まるサイズ (y=0 が地面)
- ステージ ${input.stage} にふさわしい複雑さ${limbConstraint}
- 動かしたいパーツには animatable: { type: "sway"|"bob"|"rotate"|"wiggle"|"flap", speed?, amplitude? } を付ける
- 表情セット (default, happy, sleepy, focused) を expressions に含める
- personality に名前 (name) と一言 (quirk) を含める

以下のJSON形式のみで出力してください（説明文不要）:
{
  "parts": [{ name, primitive, position, rotation, scale, color, material, children?, animatable? }],
  "expressions": { "default": { eyes?, mouth? }, "happy": ..., "sleepy": ..., "focused": ... },
  "personality": { "name": "...", "quirk": "..." }
}`;
}
