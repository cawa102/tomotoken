# Generate Creature Design

テンプレートベースのシステムでTomotokenペットのカスタマイズを生成します。
体の形状はテンプレートで固定済み — あなたが決めるのは色・アクセサリー・表情・性格です。

## 手順

1. コンテキストを取得:
```bash
npx tsx src/generation/cli.ts --context
```

2. 出力されたJSONを読み、以下を理解する:
   - `stage` — 現在の成長ステージ (0-5)
   - `stageDescription` — ステージの説明
   - `prompt` — カスタマイズ生成用プロンプト（性格・特性データ含む）
   - `customizationHint` — Customization JSONの制約
   - `templateId` — 使用するテンプレート (例: "humanoid")
   - `existingStages` — 既にデザインが存在するステージ一覧

3. `prompt` の指示に従い、**Customization JSON** を生成する。性格データとステージに合わせた色・アクセサリーを選ぶ。

### Customization JSONフォーマット

```json
{
  "bodyColor": "#RRGGBB",
  "accentColor": "#RRGGBB",
  "eyeColor": "#RRGGBB",
  "accessoryColor": "#RRGGBB",
  "showAccessories": ["hat", "scarf", "backpack", "glasses"],
  "animationStyle": "calm",
  "expressions": {
    "default": { "eyes": { "shape": "round" }, "mouth": { "shape": "flat" } },
    "happy": { "eyes": { "shape": "happy" }, "mouth": { "shape": "smile" } },
    "sleepy": { "eyes": { "shape": "sleepy" }, "mouth": { "shape": "flat" } },
    "focused": { "eyes": { "shape": "sparkle" }, "mouth": { "shape": "flat" } }
  },
  "personality": { "name": "キャラ名", "quirk": "一言性格" }
}
```

**フィールド説明:**
- `bodyColor` — メインの体色 (hex)
- `accentColor` — 耳・脚・尻尾のアクセント色 (hex)
- `eyeColor` — 瞳の色 (hex)
- `accessoryColor` — アクセサリーの色 (hex)
- `showAccessories` — 付けるアクセサリー。選択肢: `hat`, `scarf`, `backpack`, `glasses`（ステージに合った数を選ぶ。低ステージは少なく、高ステージは多く）
- `animationStyle` — `"calm"`, `"energetic"`, `"sleepy"` のいずれか
- `expressions` — 4つの表情 (default, happy, sleepy, focused)。eyes の shape: `round`, `happy`, `sleepy`, `sparkle`。mouth の shape: `smile`, `open`, `flat`, `pout`
- `personality` — `name` (キャラ名) と `quirk` (一言性格)

4. 生成したCustomization JSONを検証・保存:
```bash
echo '<生成したJSON>' | npx tsx src/generation/cli.ts --save
```

5. 検証エラーが出たら、エラーメッセージに基づいてJSONを修正し、再度 `--save` を試みる。

6. 保存成功後、ビューアー (`npm run dev:viewer`) を起動中であれば次回ポーリングで反映される。テンプレートのジオメトリにカスタマイズが適用された完全なCreatureDesignとして保存される。
