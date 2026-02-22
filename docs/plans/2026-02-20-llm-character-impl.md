# LLM-Driven Character Design Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** PRNG ベースのキャラクター生成を Claude API (Sonnet 4.6) ベースに置換し、毎回唯一無二の 3D キャラクターを生成する

**Architecture:** Claude API がステージ進行時にキャラクターの JSON パーツリストを生成し、Three.js ビルダーが汎用的にプリミティブを組み立てて描画する

**Tech Stack:** @anthropic-ai/sdk, Zod, Three.js, Express + WebSocket

---

## Task 1: Install @anthropic-ai/sdk

**Files:**
- Modify: `package.json`

**Step 1: Install the SDK**

```bash
npm install @anthropic-ai/sdk
```

**Step 2: Verify installation**

```bash
node -e "const { Anthropic } = require('@anthropic-ai/sdk'); console.log('OK')" 2>/dev/null || node -e "import('@anthropic-ai/sdk').then(m => console.log('OK'))"
```

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @anthropic-ai/sdk dependency"
```

---

## Task 2: Define CreatureDesign Zod Schema

**Files:**
- Create: `src/generation/schema.ts`
- Create: `src/generation/index.ts`
- Test: `test/generation/schema.test.ts`

**Step 1: Write the failing test**

```typescript
// test/generation/schema.test.ts
import { describe, it, expect } from "vitest";
import { creatureDesignSchema } from "../../src/generation/schema.js";

describe("creatureDesignSchema", () => {
  const validDesign = {
    parts: [
      {
        name: "body",
        primitive: "sphere",
        position: [0, 0.5, 0],
        rotation: [0, 0, 0],
        scale: [0.5, 0.6, 0.4],
        color: "#ff8844",
        material: { roughness: 0.7, metalness: 0.05, flatShading: true },
      },
    ],
    expressions: {
      default: {
        eyes: { scaleY: 1.0, shape: "round" },
        mouth: { scaleX: 1.0, shape: "smile" },
      },
    },
    personality: { name: "Patches", quirk: "always curious" },
  };

  it("accepts a valid CreatureDesign", () => {
    const result = creatureDesignSchema.safeParse(validDesign);
    expect(result.success).toBe(true);
  });

  it("accepts nested children parts", () => {
    const withChildren = {
      ...validDesign,
      parts: [
        {
          ...validDesign.parts[0],
          children: [
            {
              name: "hat",
              primitive: "cone",
              position: [0, 0.3, 0],
              rotation: [0, 0, 0],
              scale: [0.2, 0.3, 0.2],
              color: "#3366cc",
              material: { roughness: 0.5, metalness: 0.1, flatShading: true },
            },
          ],
        },
      ],
    };
    const result = creatureDesignSchema.safeParse(withChildren);
    expect(result.success).toBe(true);
  });

  it("accepts parts with animatable property", () => {
    const withAnim = {
      ...validDesign,
      parts: [
        {
          ...validDesign.parts[0],
          animatable: { type: "bob", speed: 1.5, amplitude: 0.1 },
        },
      ],
    };
    const result = creatureDesignSchema.safeParse(withAnim);
    expect(result.success).toBe(true);
  });

  it("rejects invalid primitive type", () => {
    const bad = {
      ...validDesign,
      parts: [{ ...validDesign.parts[0], primitive: "pyramid" }],
    };
    const result = creatureDesignSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const bad = { parts: [], expressions: {} };
    const result = creatureDesignSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects invalid color format", () => {
    const bad = {
      ...validDesign,
      parts: [{ ...validDesign.parts[0], color: "red" }],
    };
    const result = creatureDesignSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("accepts all valid primitive types", () => {
    for (const prim of ["sphere", "box", "cylinder", "cone", "torus", "capsule"]) {
      const design = {
        ...validDesign,
        parts: [{ ...validDesign.parts[0], primitive: prim }],
      };
      expect(creatureDesignSchema.safeParse(design).success).toBe(true);
    }
  });

  it("accepts all valid animation types", () => {
    for (const type of ["sway", "bob", "rotate", "wiggle", "flap"]) {
      const design = {
        ...validDesign,
        parts: [{
          ...validDesign.parts[0],
          animatable: { type },
        }],
      };
      expect(creatureDesignSchema.safeParse(design).success).toBe(true);
    }
  });

  it("accepts all valid expression shapes", () => {
    const design = {
      ...validDesign,
      expressions: {
        default: { eyes: { shape: "round" }, mouth: { shape: "smile" } },
        happy: { eyes: { shape: "happy" }, mouth: { shape: "open" } },
        sleepy: { eyes: { shape: "sleepy" }, mouth: { shape: "flat" } },
        focused: { eyes: { shape: "sparkle" }, mouth: { shape: "pout" } },
      },
    };
    expect(creatureDesignSchema.safeParse(design).success).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run test/generation/schema.test.ts
```

Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/generation/schema.ts
import { z } from "zod";

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const materialSchema = z.object({
  roughness: z.number().min(0).max(1),
  metalness: z.number().min(0).max(1),
  flatShading: z.boolean(),
});

const animatableSchema = z.object({
  type: z.enum(["sway", "bob", "rotate", "wiggle", "flap"]),
  speed: z.number().optional(),
  amplitude: z.number().optional(),
});

const vec3Schema = z.tuple([z.number(), z.number(), z.number()]);

const basePartSchema = z.object({
  name: z.string().min(1),
  primitive: z.enum(["sphere", "box", "cylinder", "cone", "torus", "capsule"]),
  position: vec3Schema,
  rotation: vec3Schema,
  scale: vec3Schema,
  color: hexColorSchema,
  material: materialSchema,
  animatable: animatableSchema.optional(),
});

// Recursive schema for children
type Part = z.infer<typeof basePartSchema> & { children?: Part[] };
const partSchema: z.ZodType<Part> = basePartSchema.extend({
  children: z.lazy(() => partSchema.array()).optional(),
});

const eyeExpressionSchema = z.object({
  scaleY: z.number().optional(),
  offsetY: z.number().optional(),
  shape: z.enum(["round", "happy", "sleepy", "sparkle"]).optional(),
});

const mouthExpressionSchema = z.object({
  scaleX: z.number().optional(),
  scaleY: z.number().optional(),
  shape: z.enum(["smile", "open", "flat", "pout"]).optional(),
});

const expressionSchema = z.object({
  eyes: eyeExpressionSchema.optional(),
  mouth: mouthExpressionSchema.optional(),
});

const personalitySchema = z.object({
  name: z.string().min(1),
  quirk: z.string().min(1),
});

export const creatureDesignSchema = z.object({
  parts: z.array(partSchema).min(1),
  expressions: z.record(z.string(), expressionSchema),
  personality: personalitySchema,
});

export type CreatureDesign = z.infer<typeof creatureDesignSchema>;
export type Part = z.infer<typeof partSchema>;
export type Expression = z.infer<typeof expressionSchema>;
```

```typescript
// src/generation/index.ts
export { creatureDesignSchema, type CreatureDesign, type Part, type Expression } from "./schema.js";
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run test/generation/schema.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/generation/schema.ts src/generation/index.ts test/generation/schema.test.ts
git commit -m "feat: add CreatureDesign Zod schema for LLM-generated characters"
```

---

## Task 3: Create prompt template

**Files:**
- Create: `src/generation/prompt.ts`
- Test: `test/generation/prompt.test.ts`

**Step 1: Write the failing test**

```typescript
// test/generation/prompt.test.ts
import { describe, it, expect } from "vitest";
import { buildPrompt } from "../../src/generation/prompt.js";
import type { DepthMetrics, StyleMetrics } from "../../src/store/types.js";

describe("buildPrompt", () => {
  const traits: Record<string, number> = {
    builder: 50, fixer: 30, refiner: 20, scholar: 40,
    scribe: 10, architect: 60, operator: 25, guardian: 35,
  };
  const depth: DepthMetrics = {
    editTestLoopCount: 5, repeatEditSameFileCount: 2,
    phaseSwitchCount: 3, totalSessions: 10,
  };
  const style: StyleMetrics = {
    bulletRatio: 0.3, questionRatio: 0.1, codeblockRatio: 0.4,
    avgMessageLen: 120, messageLenStd: 40, headingRatio: 0.2,
  };

  it("includes archetype and subtype", () => {
    const prompt = buildPrompt({
      archetype: "architect", subtype: "builder",
      traits, depth, style, stage: 2, previousParts: null,
    });
    expect(prompt).toContain("architect");
    expect(prompt).toContain("builder");
  });

  it("includes stage number", () => {
    const prompt = buildPrompt({
      archetype: "builder", subtype: "fixer",
      traits, depth, style, stage: 4, previousParts: null,
    });
    expect(prompt).toContain("4");
  });

  it("includes trait scores", () => {
    const prompt = buildPrompt({
      archetype: "builder", subtype: "fixer",
      traits, depth, style, stage: 1, previousParts: null,
    });
    expect(prompt).toContain("builder=50");
    expect(prompt).toContain("architect=60");
  });

  it("includes previous parts when provided", () => {
    const prev = [{ name: "body", primitive: "sphere" }];
    const prompt = buildPrompt({
      archetype: "builder", subtype: "fixer",
      traits, depth, style, stage: 3,
      previousParts: prev,
    });
    expect(prompt).toContain('"body"');
    expect(prompt).toContain("sphere");
  });

  it("includes arms/legs constraint for stage >= 2", () => {
    const prompt = buildPrompt({
      archetype: "builder", subtype: "fixer",
      traits, depth, style, stage: 2, previousParts: null,
    });
    expect(prompt).toMatch(/両手両足|arms.*legs|limbs/i);
  });

  it("returns a non-empty string", () => {
    const prompt = buildPrompt({
      archetype: "builder", subtype: "fixer",
      traits, depth, style, stage: 0, previousParts: null,
    });
    expect(prompt.length).toBeGreaterThan(100);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run test/generation/prompt.test.ts
```

**Step 3: Write minimal implementation**

```typescript
// src/generation/prompt.ts
import type { DepthMetrics, StyleMetrics } from "../store/types.js";
import type { Part } from "./schema.js";

export interface PromptInput {
  readonly archetype: string;
  readonly subtype: string;
  readonly traits: Record<string, number>;
  readonly depth: DepthMetrics;
  readonly style: StyleMetrics;
  readonly stage: number;
  readonly previousParts: readonly Part[] | null;
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
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run test/generation/prompt.test.ts
```

**Step 5: Update barrel export**

```typescript
// src/generation/index.ts — add export
export { buildPrompt, type PromptInput } from "./prompt.js";
```

**Step 6: Commit**

```bash
git add src/generation/prompt.ts src/generation/index.ts test/generation/prompt.test.ts
git commit -m "feat: add Claude prompt template for character generation"
```

---

## Task 4: Create designer module (Claude API caller)

**Files:**
- Create: `src/generation/designer.ts`
- Test: `test/generation/designer.test.ts`

**Step 1: Write the failing test**

テストでは実際の API は呼ばない。Anthropic SDK をモックし、レスポンスの解析とバリデーションを検証する。

```typescript
// test/generation/designer.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateCreatureDesign } from "../../src/generation/designer.js";
import type { DepthMetrics, StyleMetrics } from "../../src/store/types.js";

// Mock the Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
    __mockCreate: mockCreate,
  };
});

describe("generateCreatureDesign", () => {
  const traits: Record<string, number> = {
    builder: 50, fixer: 30, refiner: 20, scholar: 40,
    scribe: 10, architect: 60, operator: 25, guardian: 35,
  };
  const depth: DepthMetrics = {
    editTestLoopCount: 5, repeatEditSameFileCount: 2,
    phaseSwitchCount: 3, totalSessions: 10,
  };
  const style: StyleMetrics = {
    bulletRatio: 0.3, questionRatio: 0.1, codeblockRatio: 0.4,
    avgMessageLen: 120, messageLenStd: 40, headingRatio: 0.2,
  };

  const validResponse = {
    parts: [{
      name: "body",
      primitive: "sphere",
      position: [0, 0.5, 0],
      rotation: [0, 0, 0],
      scale: [0.5, 0.6, 0.4],
      color: "#ff8844",
      material: { roughness: 0.7, metalness: 0.05, flatShading: true },
    }],
    expressions: {
      default: { eyes: { shape: "round" }, mouth: { shape: "smile" } },
    },
    personality: { name: "Patches", quirk: "always curious" },
  };

  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const mod = await import("@anthropic-ai/sdk");
    mockCreate = (mod as any).__mockCreate;
    mockCreate.mockReset();
  });

  it("returns parsed CreatureDesign on valid API response", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(validResponse) }],
    });

    const result = await generateCreatureDesign({
      archetype: "architect", subtype: "builder",
      traits, depth, style, stage: 2, previousParts: null,
      apiKey: "test-key",
    });

    expect(result.parts).toHaveLength(1);
    expect(result.parts[0].name).toBe("body");
    expect(result.personality.name).toBe("Patches");
  });

  it("throws on invalid JSON from API", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "not valid json" }],
    });

    await expect(generateCreatureDesign({
      archetype: "builder", subtype: "fixer",
      traits, depth, style, stage: 1, previousParts: null,
      apiKey: "test-key",
    })).rejects.toThrow();
  });

  it("throws on schema validation failure", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ parts: [], expressions: {} }) }],
    });

    await expect(generateCreatureDesign({
      archetype: "builder", subtype: "fixer",
      traits, depth, style, stage: 1, previousParts: null,
      apiKey: "test-key",
    })).rejects.toThrow();
  });

  it("uses claude-sonnet-4-6 model", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(validResponse) }],
    });

    await generateCreatureDesign({
      archetype: "builder", subtype: "fixer",
      traits, depth, style, stage: 1, previousParts: null,
      apiKey: "test-key",
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-sonnet-4-6" }),
    );
  });

  it("extracts JSON from markdown code block if present", async () => {
    const wrapped = "```json\n" + JSON.stringify(validResponse) + "\n```";
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: wrapped }],
    });

    const result = await generateCreatureDesign({
      archetype: "builder", subtype: "fixer",
      traits, depth, style, stage: 1, previousParts: null,
      apiKey: "test-key",
    });

    expect(result.parts).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run test/generation/designer.test.ts
```

**Step 3: Write minimal implementation**

```typescript
// src/generation/designer.ts
import Anthropic from "@anthropic-ai/sdk";
import { creatureDesignSchema, type CreatureDesign } from "./schema.js";
import { buildPrompt, type PromptInput } from "./prompt.js";
import type { Part } from "./schema.js";
import type { DepthMetrics, StyleMetrics } from "../store/types.js";

export interface DesignRequest {
  readonly archetype: string;
  readonly subtype: string;
  readonly traits: Record<string, number>;
  readonly depth: DepthMetrics;
  readonly style: StyleMetrics;
  readonly stage: number;
  readonly previousParts: readonly Part[] | null;
  readonly apiKey: string;
}

/**
 * Extract JSON from a string that may be wrapped in markdown code fences.
 */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenced) return fenced[1].trim();
  return text.trim();
}

/**
 * Call Claude Sonnet 4.6 to generate a CreatureDesign.
 * Validates the response against the Zod schema.
 */
export async function generateCreatureDesign(request: DesignRequest): Promise<CreatureDesign> {
  const client = new Anthropic({ apiKey: request.apiKey });

  const promptInput: PromptInput = {
    archetype: request.archetype,
    subtype: request.subtype,
    traits: request.traits,
    depth: request.depth,
    style: request.style,
    stage: request.stage,
    previousParts: request.previousParts,
  };

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: buildPrompt(promptInput) }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in Claude response");
  }

  const jsonStr = extractJson(textBlock.text);
  const parsed = JSON.parse(jsonStr);
  const validated = creatureDesignSchema.parse(parsed);
  return validated;
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run test/generation/designer.test.ts
```

**Step 5: Update barrel export**

```typescript
// src/generation/index.ts — add export
export { generateCreatureDesign, type DesignRequest } from "./designer.js";
```

**Step 6: Commit**

```bash
git add src/generation/designer.ts src/generation/index.ts test/generation/designer.test.ts
git commit -m "feat: add Claude API designer for character generation"
```

---

## Task 5: Update PetRecord to store generated design

**Files:**
- Modify: `src/store/types.ts`
- Modify: `test/sidecar/render-data.test.ts` (update type usage if needed)

**Step 1: Write the failing test**

```typescript
// test/store/design-storage.test.ts
import { describe, it, expect } from "vitest";
import type { PetRecord } from "../../src/store/types.js";

describe("PetRecord with generatedDesigns", () => {
  it("allows generatedDesigns field", () => {
    const pet: PetRecord = {
      petId: "test-1",
      spawnedAt: "2026-01-01T00:00:00Z",
      requiredTokens: 10000,
      consumedTokens: 5000,
      spawnIndex: 0,
      personalitySnapshot: null,
      generatedDesigns: {
        0: {
          parts: [{
            name: "egg",
            primitive: "sphere",
            position: [0, 0.5, 0],
            rotation: [0, 0, 0],
            scale: [0.5, 0.65, 0.5],
            color: "#ffcc44",
            material: { roughness: 0.7, metalness: 0, flatShading: true },
          }],
          expressions: { default: {} },
          personality: { name: "Sunny", quirk: "warm glow" },
        },
      },
    };
    expect(pet.generatedDesigns).toBeDefined();
    expect(pet.generatedDesigns?.[0]?.personality.name).toBe("Sunny");
  });

  it("allows null generatedDesigns", () => {
    const pet: PetRecord = {
      petId: "test-2",
      spawnedAt: "2026-01-01T00:00:00Z",
      requiredTokens: 10000,
      consumedTokens: 0,
      spawnIndex: 0,
      personalitySnapshot: null,
      generatedDesigns: null,
    };
    expect(pet.generatedDesigns).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run test/store/design-storage.test.ts
```

**Step 3: Modify PetRecord**

`src/store/types.ts` の `PetRecord` に以下を追加:

```typescript
import type { CreatureDesign } from "../generation/schema.js";

// PetRecord に追加するフィールド:
readonly generatedDesigns: Record<number, CreatureDesign> | null;
```

`generatedDesigns` はステージ番号 (0-5) をキーとし、各ステージの生成結果を保持。`null` は未生成状態。

**Step 4: Run test to verify it passes**

```bash
npx vitest run test/store/design-storage.test.ts
```

**Step 5: Fix all existing tests that construct PetRecord**

既存テストで `PetRecord` を構築している箇所に `generatedDesigns: null` を追加。

```bash
npx vitest run
```

全テスト PASS を確認。

**Step 6: Commit**

```bash
git add src/store/types.ts test/store/design-storage.test.ts
# 既存テストの修正も含める
git commit -m "feat: add generatedDesigns field to PetRecord for LLM-generated characters"
```

---

## Task 6: Update PetRenderData to include CreatureDesign

**Files:**
- Modify: `src/art3d/types.ts`
- Modify: `src/sidecar/render-data.ts`
- Modify: `test/sidecar/render-data.test.ts`

**Step 1: Write the failing test**

```typescript
// test/sidecar/render-data-design.test.ts
import { describe, it, expect } from "vitest";
import { buildRenderData } from "../../src/sidecar/render-data.js";
import type { AppState, DepthMetrics, StyleMetrics } from "../../src/store/types.js";

describe("buildRenderData with generatedDesigns", () => {
  const mockDesign = {
    parts: [{
      name: "body",
      primitive: "sphere" as const,
      position: [0, 0.5, 0] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      scale: [0.5, 0.6, 0.4] as [number, number, number],
      color: "#ff8844",
      material: { roughness: 0.7, metalness: 0.05, flatShading: true },
    }],
    expressions: { default: {} },
    personality: { name: "Patches", quirk: "curious" },
  };

  it("includes creatureDesign in render data when available", () => {
    const state: AppState = {
      version: 2,
      calibration: { t0: 10000, monthlyEstimate: 50000, calibratedAt: "2026-01-01T00:00:00Z" },
      spawnIndexCurrentMonth: 0,
      currentMonth: "2026-01",
      currentPet: {
        petId: "test-design",
        spawnedAt: "2026-01-15T00:00:00Z",
        requiredTokens: 10000,
        consumedTokens: 5000,
        spawnIndex: 0,
        personalitySnapshot: {
          usageMix: {},
          depthMetrics: { editTestLoopCount: 5, repeatEditSameFileCount: 2, phaseSwitchCount: 3, totalSessions: 10 },
          styleMetrics: { bulletRatio: 0.3, questionRatio: 0.1, codeblockRatio: 0.4, avgMessageLen: 120, messageLenStd: 40, headingRatio: 0.2 },
          traits: { builder: 50, fixer: 30, refiner: 20, scholar: 40, scribe: 10, architect: 60, operator: 25, guardian: 35 },
        },
        generatedDesigns: { 3: mockDesign },
      },
      ingestionState: { files: {} },
      globalStats: { totalTokensAllTime: 50000, totalSessionsIngested: 10, earliestTimestamp: "2026-01-01", latestTimestamp: "2026-01-20" },
      lastEncouragementShownAt: null,
    };

    const seed = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
    const renderData = buildRenderData(state, seed);
    expect(renderData.creatureDesign).toEqual(mockDesign);
  });

  it("returns null creatureDesign when no design for current stage", () => {
    const state: AppState = {
      version: 2,
      calibration: { t0: 10000, monthlyEstimate: 50000, calibratedAt: "2026-01-01T00:00:00Z" },
      spawnIndexCurrentMonth: 0,
      currentMonth: "2026-01",
      currentPet: {
        petId: "test-no-design",
        spawnedAt: "2026-01-15T00:00:00Z",
        requiredTokens: 10000,
        consumedTokens: 5000,
        spawnIndex: 0,
        personalitySnapshot: null,
        generatedDesigns: null,
      },
      ingestionState: { files: {} },
      globalStats: { totalTokensAllTime: 50000, totalSessionsIngested: 10, earliestTimestamp: "2026-01-01", latestTimestamp: "2026-01-20" },
      lastEncouragementShownAt: null,
    };

    const seed = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
    const renderData = buildRenderData(state, seed);
    expect(renderData.creatureDesign).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

**Step 3: Update PetRenderData and buildRenderData**

`src/art3d/types.ts` に `creatureDesign` フィールド追加。
`src/sidecar/render-data.ts` で stage に対応する `generatedDesigns[stage]` を含める。

**Step 4: Run all tests**

```bash
npx vitest run
```

**Step 5: Commit**

```bash
git add src/art3d/types.ts src/sidecar/render-data.ts test/sidecar/render-data-design.test.ts
git commit -m "feat: include CreatureDesign in PetRenderData for viewer consumption"
```

---

## Task 7: Rewrite Three.js creature builder for generic parts

**Files:**
- Rewrite: `src/viewer/public/js/creature.js`
- No test file (browser JS, manual verification)

**Step 1: Implement buildFromDesign()**

`creature.js` を書き換え:

- `buildFromDesign(design)`: Claude 出力の `CreatureDesign` からメッシュを構築
- `buildPart(partDef)`: 再帰的にプリミティブとマテリアルを生成
- `createGeometry(primitive, scale)`: primitive 文字列 → Three.js Geometry
- `buildCreature(params, palette, stage)`: PRNG フォールバック用に既存ビルダーも残す（`buildLegacyCreature` にリネーム）
- `disposeCreature(scene)`: 変更なし

**Step 2: Implement expression system**

`src/viewer/public/js/expression.js` を新規作成:

- `applyExpression(parts, expression)`: 目・口パーツの scale/position を変更
- `selectExpression(expressions, context)`: 進捗・時間帯から表情を選択

**Step 3: Manual verification**

```bash
npm run dev:viewer
```

ブラウザで http://localhost:3456 を開き、3D キャラクターが表示されることを確認。

**Step 4: Commit**

```bash
git add src/viewer/public/js/creature.js src/viewer/public/js/expression.js
git commit -m "feat: rewrite creature builder for generic LLM-generated parts"
```

---

## Task 8: Rewrite animation system for animatable flags

**Files:**
- Rewrite: `src/viewer/public/js/animation.js`

**Step 1: Implement flag-based animation**

固定アニメーション関数 → `animatable` フラグベースに書き換え:

```javascript
export function applyAnimations(group, time) {
  group.traverse((child) => {
    if (!child.userData?.animatable) return;
    const { type, speed = 1.0, amplitude = 0.1 } = child.userData.animatable;
    // type ごとの処理
  });
}
```

- `sway`: `rotation.x` or `.z` を sin で振動
- `bob`: `position.y` を sin で上下
- `rotate`: `rotation.y` を time * speed で連続回転
- `wiggle`: `rotation.z` を小刻みに振動
- `flap`: `rotation.z` を周期的に開閉

**Step 2: Manual verification**

```bash
npm run dev:viewer
```

**Step 3: Commit**

```bash
git add src/viewer/public/js/animation.js
git commit -m "feat: rewrite animation system for LLM-specified animatable flags"
```

---

## Task 9: Wire generation into sidecar pipeline

**Files:**
- Modify: `src/sidecar/render-data.ts`
- Modify: `src/viewer/server.ts`
- Test: `test/sidecar/render-data-generation.test.ts` (integration)

**Step 1: Write the failing test**

ステージ進行時に `generateCreatureDesign` が呼ばれることを検証（API モック）。

**Step 2: Implement stage-based generation trigger**

`src/viewer/server.ts` の `fetchRenderData()` を拡張:

1. `runFull()` でステートを取得
2. 現在のステージを計算
3. `state.currentPet.generatedDesigns` にそのステージのデザインがない場合:
   - `ANTHROPIC_API_KEY` が設定されていれば `generateCreatureDesign()` を呼ぶ
   - 結果を `state.json` に保存
   - `generatedDesigns[stage]` として追加
4. `buildRenderData()` に渡す

**Step 3: Implement PRNG fallback**

`ANTHROPIC_API_KEY` 未設定 or API エラー時は既存 PRNG ベースにフォールバック。

**Step 4: Manual verification**

```bash
ANTHROPIC_API_KEY=sk-... npm run dev:viewer
```

**Step 5: Commit**

```bash
git add src/sidecar/render-data.ts src/viewer/server.ts test/sidecar/render-data-generation.test.ts
git commit -m "feat: wire LLM generation into sidecar with stage-based trigger and PRNG fallback"
```

---

## Task 10: Update app.js to handle both design modes

**Files:**
- Modify: `src/viewer/public/js/app.js`

**Step 1: Update updateCreature()**

```javascript
function updateCreature(data) {
  const { creatureDesign, creatureParams, palette, stage, petId } = data;

  if (petId !== currentPetId || stage !== currentStage) {
    disposeCreature(scene);

    let result;
    if (creatureDesign) {
      result = buildFromDesign(creatureDesign);
    } else {
      result = buildLegacyCreature(creatureParams, palette, stage);
    }

    scene.add(result.group);
    currentGroup = result.group;
    currentParts = result.parts;
    currentPetId = petId;
    currentStage = stage;
    currentDesign = creatureDesign;
  }
}
```

**Step 2: Update info panel**

キャラクター名 (`personality.name`) と一言 (`personality.quirk`) を info panel に追加表示。

**Step 3: Manual verification**

**Step 4: Commit**

```bash
git add src/viewer/public/js/app.js src/viewer/public/index.html
git commit -m "feat: update viewer to render LLM-generated designs with fallback"
```

---

## Task 11: Full integration test & cleanup

**Files:**
- All test files
- Modify: `test/sidecar/prng-parity.test.ts` (update for new PetRecord shape)

**Step 1: Fix all existing tests**

`PetRecord` に `generatedDesigns` が追加されたので、全テストファイルで構築箇所を修正。

```bash
npx vitest run
```

全テスト PASS を確認。

**Step 2: Run typecheck**

```bash
npm run typecheck
```

エラーゼロを確認。

**Step 3: Run build**

```bash
npm run build
```

**Step 4: Manual end-to-end verification**

```bash
ANTHROPIC_API_KEY=sk-... npm run dev:viewer
```

1. ブラウザで http://localhost:3456 を開く
2. キャラクターが LLM 生成デザインで表示されることを確認
3. 表情が時間帯に応じて変わることを確認
4. アニメーションが `animatable` フラグに基づいて動くことを確認

**Step 5: Commit**

```bash
git add -A
git commit -m "test: fix all tests for LLM character design integration"
```
