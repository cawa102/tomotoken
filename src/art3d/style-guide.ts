/**
 * 3D キャラクター生成のスタイルガイド。
 * Hyper3D テキストプロンプトの共通サフィックスとして使用し、
 * 全キャラクターの「絵のタッチ」を統一する。
 *
 * プロンプト構成（重要 — キャラ先頭）:
 *   "{キャラ固有の記述}, {STYLE_SUFFIX}"
 *   キャラ特徴を先頭に置かないと、スタイル指定に負けてアイデンティティが消える。
 *
 * 目指すスタイル: ディズニー・ピクサー映画のキャラクター
 *   - 頭:体 = 1:1〜2:1 の子ども寄り比率（2〜3頭身）
 *   - 大きめの虹彩 + キャッチライト（光の点）
 *   - 角の少ない丸みのあるシルエット、抱きしめたくなる親しみやすさ
 *   - リッチで鮮やかな配色
 *   - 質感のあるマテリアル（布、金属、肌）
 *
 * 後処理（Blender ラティス変形）:
 *   - 目の拡大（顔幅の約35%へ）
 *
 * 統一しない要素（個性として許容）:
 *   - 服装・アクセサリー
 *   - ポーズ
 *   - カラーパレット
 *   - 表情（自然に生成されるものをそのまま使用）
 */

/**
 * 全キャラクター共通のスタイルサフィックス。
 * キャラクター固有の記述の **後ろ** に付与する。
 */
export const STYLE_SUFFIX = [
  // レンダリングスタイル
  "Disney Pixar style",
  "huge head tiny body",
  "round chubby shape",
  "large shiny eyes with catchlight",
  "smooth 3D rendering",
  "vibrant colors",

  // 技術的指定
  "white background",
  "full body",
].join(", ");

/** @deprecated STYLE_PREFIX は STYLE_SUFFIX に統合。互換性のため残す。 */
export const STYLE_PREFIX = STYLE_SUFFIX;

/**
 * キャラクター固有の記述をスタイルサフィックスと結合して
 * Hyper3D 用の最終プロンプトを生成する。
 *
 * プロンプト構成: "{キャラ記述}, {スタイル}"
 * キャラ特徴を先頭に置くことで、アイデンティティが保たれる。
 *
 * @param characterDescription - personality 分析から生成されたキャラクター固有の記述
 * @returns Hyper3D に送信する完全なプロンプト
 */
export function buildModelPrompt(characterDescription: string): string {
  return `${characterDescription}, ${STYLE_SUFFIX}`;
}
