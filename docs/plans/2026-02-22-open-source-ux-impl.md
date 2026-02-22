# Open Source UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** LLM プロバイダー抽象化（Anthropic + OpenAI 切替）、初回起動体験（直近1Bトークンから即座にキャラ生成）、起動時バリデーション（APIキー・Blender・MCP 検証）を実装する。

**Architecture:** `src/generation/designer.ts` の Anthropic 直結を `LLMProvider` インターフェース経由に置換し、config で provider/model を切替可能にする。初回検出は state.json の有無で判定し、直近1Bトークンのみ抽出する `recentTokens` モードを ingestion に追加。起動時バリデーションは独立モジュールで API キー・Blender・MCP の3点を検証する。

**Tech Stack:** TypeScript, Zod, Vitest, `@anthropic-ai/sdk`, `openai` (新規追加)

---

## Task 1: LLM Provider Interface & Types

**Files:**
- Create: `src/generation/llm-provider.ts`
- Test: `test/generation/llm-provider.test.ts`

**Step 1: Write the failing test**

```typescript
// test/generation/llm-provider.test.ts
import { describe, it, expect } from "vitest";
import { createLLMProvider } from "../../src/generation/llm-provider.js";

describe("createLLMProvider", () => {
  it("throws on unknown provider", () => {
    expect(() =>
      createLLMProvider({ provider: "unknown" as any, model: "x", apiKey: "k" })
    ).toThrow("Unknown LLM provider: unknown");
  });

  it("returns AnthropicProvider for 'anthropic'", () => {
    const p = createLLMProvider({ provider: "anthropic", model: "claude-sonnet-4-20250514", apiKey: "test-key" });
    expect(p).toBeDefined();
    expect(p.providerName).toBe("anthropic");
  });

  it("returns OpenAIProvider for 'openai'", () => {
    const p = createLLMProvider({ provider: "openai", model: "gpt-4o", apiKey: "test-key" });
    expect(p).toBeDefined();
    expect(p.providerName).toBe("openai");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/generation/llm-provider.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/generation/llm-provider.ts
export interface LLMProviderConfig {
  readonly provider: "anthropic" | "openai";
  readonly model: string;
  readonly apiKey: string;
}

export interface LLMProvider {
  readonly providerName: string;
  generateText(prompt: string, system?: string): Promise<string>;
}

export function createLLMProvider(config: LLMProviderConfig): LLMProvider {
  switch (config.provider) {
    case "anthropic":
      return new AnthropicProvider(config.apiKey, config.model);
    case "openai":
      return new OpenAIProvider(config.apiKey, config.model);
    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}

class AnthropicProvider implements LLMProvider {
  readonly providerName = "anthropic";
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async generateText(prompt: string, _system?: string): Promise<string> {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: this.apiKey });
    const response = await client.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text content in Anthropic response");
    }
    return textBlock.text;
  }
}

class OpenAIProvider implements LLMProvider {
  readonly providerName = "openai";
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async generateText(prompt: string, system?: string): Promise<string> {
    const { OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: this.apiKey });
    const messages: Array<{ role: "system" | "user"; content: string }> = [];
    if (system) messages.push({ role: "system", content: system });
    messages.push({ role: "user", content: prompt });
    const response = await client.chat.completions.create({
      model: this.model,
      max_tokens: 4096,
      messages,
    });
    const text = response.choices[0]?.message?.content;
    if (!text) {
      throw new Error("No text content in OpenAI response");
    }
    return text;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/generation/llm-provider.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/generation/llm-provider.ts test/generation/llm-provider.test.ts
git commit -m "feat(generation): add LLM provider interface with Anthropic and OpenAI support"
```

---

## Task 2: Install OpenAI SDK Dependency

**Step 1: Install**

```bash
npm install openai
```

**Step 2: Verify**

Run: `npm ls openai`
Expected: shows `openai@X.Y.Z`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add openai SDK dependency"
```

---

## Task 3: Add LLM Config to Config Schema

**Files:**
- Modify: `src/config/schema.ts:13-54` (add `llm` field to ConfigSchema)
- Test: `test/config/schema.test.ts` (add tests for new field, create if needed)

**Step 1: Write the failing test**

```typescript
// test/config/llm-config.test.ts
import { describe, it, expect } from "vitest";
import { ConfigSchema } from "../../src/config/schema.js";

describe("ConfigSchema llm field", () => {
  it("defaults llm.provider to 'anthropic'", () => {
    const config = ConfigSchema.parse({});
    expect(config.llm.provider).toBe("anthropic");
  });

  it("defaults llm.model based on provider", () => {
    const config = ConfigSchema.parse({});
    expect(config.llm.model).toBe("claude-sonnet-4-20250514");
  });

  it("accepts openai provider with custom model", () => {
    const config = ConfigSchema.parse({
      llm: { provider: "openai", model: "gpt-4o-mini", apiKey: "sk-test" },
    });
    expect(config.llm.provider).toBe("openai");
    expect(config.llm.model).toBe("gpt-4o-mini");
  });

  it("rejects unknown provider", () => {
    expect(() =>
      ConfigSchema.parse({ llm: { provider: "gemini" } })
    ).toThrow();
  });

  it("resolves apiKey from empty string to undefined", () => {
    const config = ConfigSchema.parse({});
    expect(config.llm.apiKey).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/config/llm-config.test.ts`
Expected: FAIL — `llm` not in schema

**Step 3: Add llm field to ConfigSchema**

In `src/config/schema.ts`, add to the `ConfigSchema` z.object inside the existing schema, **after** the `privacy` field:

```typescript
  llm: z
    .object({
      provider: z.enum(["anthropic", "openai"]).default("anthropic"),
      model: z.string().optional(),
      apiKey: z.string().min(1).optional(),
    })
    .default({})
    .transform((llm) => ({
      ...llm,
      model:
        llm.model ??
        (llm.provider === "openai" ? "gpt-4o" : "claude-sonnet-4-20250514"),
    })),
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/config/llm-config.test.ts`
Expected: PASS (5 tests)

**Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All existing tests still pass

**Step 6: Commit**

```bash
git add src/config/schema.ts test/config/llm-config.test.ts
git commit -m "feat(config): add llm provider/model/apiKey to config schema"
```

---

## Task 4: Refactor designer.ts to Use LLMProvider

**Files:**
- Modify: `src/generation/designer.ts` (replace Anthropic direct usage with LLMProvider injection)
- Modify: `test/generation/designer.test.ts` (update mock to use LLMProvider)

**Step 1: Update the test mock**

Replace the entire `test/generation/designer.test.ts`. Key changes:
- Mock `../src/generation/llm-provider.js` instead of `@anthropic-ai/sdk`
- Pass `llmProvider` config in `DesignRequest` instead of `apiKey`

```typescript
// test/generation/designer.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateCreatureDesign } from "../../src/generation/designer.js";
import type { LLMProvider } from "../../src/generation/llm-provider.js";
import type { DepthMetrics, StyleMetrics } from "../../src/store/types.js";

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

  let mockProvider: LLMProvider;

  beforeEach(() => {
    mockProvider = {
      providerName: "mock",
      generateText: vi.fn(),
    };
  });

  it("returns parsed CreatureDesign on valid response", async () => {
    (mockProvider.generateText as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify(validResponse)
    );

    const result = await generateCreatureDesign({
      archetype: "architect", subtype: "builder",
      traits, depth, style, stage: 2, previousParts: null,
      provider: mockProvider,
    });

    expect(result.parts).toHaveLength(1);
    expect(result.parts[0].name).toBe("body");
    expect(result.personality.name).toBe("Patches");
  });

  it("throws on invalid JSON from provider", async () => {
    (mockProvider.generateText as ReturnType<typeof vi.fn>).mockResolvedValue("not valid json");

    await expect(generateCreatureDesign({
      archetype: "builder", subtype: "fixer",
      traits, depth, style, stage: 1, previousParts: null,
      provider: mockProvider,
    })).rejects.toThrow();
  });

  it("extracts JSON from markdown code block", async () => {
    const wrapped = "```json\n" + JSON.stringify(validResponse) + "\n```";
    (mockProvider.generateText as ReturnType<typeof vi.fn>).mockResolvedValue(wrapped);

    const result = await generateCreatureDesign({
      archetype: "builder", subtype: "fixer",
      traits, depth, style, stage: 1, previousParts: null,
      provider: mockProvider,
    });

    expect(result.parts).toHaveLength(1);
  });

  it("passes prompt to provider.generateText", async () => {
    (mockProvider.generateText as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify(validResponse)
    );

    await generateCreatureDesign({
      archetype: "builder", subtype: "fixer",
      traits, depth, style, stage: 1, previousParts: null,
      provider: mockProvider,
    });

    expect(mockProvider.generateText).toHaveBeenCalledOnce();
    const [prompt] = (mockProvider.generateText as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(prompt).toContain("builder");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/generation/designer.test.ts`
Expected: FAIL — `provider` not in DesignRequest

**Step 3: Refactor designer.ts**

Replace entire `src/generation/designer.ts`:

```typescript
import { creatureDesignSchema, type CreatureDesign } from "./schema.js";
import { buildPrompt, type PromptInput } from "./prompt.js";
import type { DepthMetrics, StyleMetrics } from "../store/types.js";
import type { LLMProvider } from "./llm-provider.js";

interface DesignRequest {
  readonly archetype: string;
  readonly subtype: string;
  readonly traits: Record<string, number>;
  readonly depth: DepthMetrics;
  readonly style: StyleMetrics;
  readonly stage: number;
  readonly previousParts: readonly unknown[] | null;
  readonly provider: LLMProvider;
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenced) return fenced[1].trim();
  return text.trim();
}

export async function generateCreatureDesign(request: DesignRequest): Promise<CreatureDesign> {
  const promptInput: PromptInput = {
    archetype: request.archetype,
    subtype: request.subtype,
    traits: request.traits,
    depth: request.depth,
    style: request.style,
    stage: request.stage,
    previousParts: request.previousParts,
  };

  const text = await request.provider.generateText(buildPrompt(promptInput));
  const jsonStr = extractJson(text);
  const parsed = JSON.parse(jsonStr);
  return creatureDesignSchema.parse(parsed);
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/generation/designer.test.ts`
Expected: PASS (4 tests)

**Step 5: Fix any callers of generateCreatureDesign**

Search for usages:

Run: `grep -rn "generateCreatureDesign" src/`

Update each caller to pass `provider` instead of `apiKey`. Key file likely: `src/index.ts` or sidecar. If there are no direct callers in src (generation is optional), skip this step.

**Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 7: Commit**

```bash
git add src/generation/designer.ts test/generation/designer.test.ts
git commit -m "refactor(generation): inject LLMProvider into designer instead of direct Anthropic SDK"
```

---

## Task 5: API Key Resolution (Config + Environment Variable)

**Files:**
- Create: `src/config/resolve-api-key.ts`
- Test: `test/config/resolve-api-key.test.ts`

**Step 1: Write the failing test**

```typescript
// test/config/resolve-api-key.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { resolveApiKey } from "../../src/config/resolve-api-key.js";

describe("resolveApiKey", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns config apiKey when present", () => {
    const result = resolveApiKey({ provider: "anthropic", apiKey: "cfg-key" });
    expect(result).toBe("cfg-key");
  });

  it("falls back to ANTHROPIC_API_KEY env var for anthropic", () => {
    process.env = { ...originalEnv, ANTHROPIC_API_KEY: "env-key" };
    const result = resolveApiKey({ provider: "anthropic" });
    expect(result).toBe("env-key");
  });

  it("falls back to OPENAI_API_KEY env var for openai", () => {
    process.env = { ...originalEnv, OPENAI_API_KEY: "env-key" };
    const result = resolveApiKey({ provider: "openai" });
    expect(result).toBe("env-key");
  });

  it("returns undefined when no key found", () => {
    process.env = { ...originalEnv };
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const result = resolveApiKey({ provider: "anthropic" });
    expect(result).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/config/resolve-api-key.test.ts`
Expected: FAIL — module not found

**Step 3: Write implementation**

```typescript
// src/config/resolve-api-key.ts
const ENV_KEYS: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
};

export function resolveApiKey(config: {
  readonly provider: string;
  readonly apiKey?: string;
}): string | undefined {
  if (config.apiKey) return config.apiKey;
  const envKey = ENV_KEYS[config.provider];
  return envKey ? process.env[envKey] : undefined;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/config/resolve-api-key.test.ts`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add src/config/resolve-api-key.ts test/config/resolve-api-key.test.ts
git commit -m "feat(config): add resolveApiKey with env variable fallback"
```

---

## Task 6: Startup Validation Module

**Files:**
- Create: `src/validation/startup.ts`
- Test: `test/validation/startup.test.ts`

**Step 1: Write the failing test**

```typescript
// test/validation/startup.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { validateStartup, type ValidationResult } from "../../src/validation/startup.js";

// Mock execSync to control Blender detection
vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

describe("validateStartup", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns error when API key is missing", () => {
    process.env = { ...originalEnv };
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const result = validateStartup({ provider: "anthropic", model: "m" });
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ component: "api_key" })
    );
  });

  it("passes when API key is in config", () => {
    const { execSync } = require("node:child_process");
    execSync.mockReturnValue(Buffer.from("/usr/bin/blender\n"));
    const result = validateStartup({
      provider: "anthropic",
      model: "m",
      apiKey: "sk-test",
    });
    const apiKeyErrors = result.errors.filter((e: any) => e.component === "api_key");
    expect(apiKeyErrors).toHaveLength(0);
  });

  it("returns error when Blender is not found", () => {
    process.env = { ...originalEnv, ANTHROPIC_API_KEY: "sk-test" };
    const { execSync } = require("node:child_process");
    execSync.mockImplementation(() => { throw new Error("not found"); });
    const result = validateStartup({ provider: "anthropic", model: "m" });
    expect(result.errors).toContainEqual(
      expect.objectContaining({ component: "blender" })
    );
  });

  it("passes all checks when everything configured", () => {
    process.env = { ...originalEnv, ANTHROPIC_API_KEY: "sk-test" };
    const { execSync } = require("node:child_process");
    execSync.mockReturnValue(Buffer.from("/usr/bin/blender\n"));
    const result = validateStartup({ provider: "anthropic", model: "m" });
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/validation/startup.test.ts`
Expected: FAIL — module not found

**Step 3: Write implementation**

```typescript
// src/validation/startup.ts
import { execSync } from "node:child_process";
import { resolveApiKey } from "../config/resolve-api-key.js";

export interface ValidationError {
  readonly component: "api_key" | "blender" | "mcp";
  readonly message: string;
  readonly helpSection: string;
}

export interface ValidationResult {
  readonly ok: boolean;
  readonly errors: readonly ValidationError[];
}

function checkApiKey(config: {
  readonly provider: string;
  readonly apiKey?: string;
}): ValidationError | null {
  const key = resolveApiKey(config);
  if (key) return null;
  const envVar = config.provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
  return {
    component: "api_key",
    message: `API key not found. Set "${envVar}" environment variable or "llm.apiKey" in ~/.tomotoken/config.json`,
    helpSection: "Setup > API Key",
  };
}

function checkBlender(): ValidationError | null {
  try {
    execSync("which blender", { stdio: "pipe" });
    return null;
  } catch {
    return {
      component: "blender",
      message: "Blender not found in PATH. Install Blender 4.x and ensure it is in your PATH.",
      helpSection: "Setup > Blender",
    };
  }
}

export function validateStartup(config: {
  readonly provider: string;
  readonly model: string;
  readonly apiKey?: string;
}): ValidationResult {
  const errors: ValidationError[] = [];

  const apiKeyError = checkApiKey(config);
  if (apiKeyError) errors.push(apiKeyError);

  const blenderError = checkBlender();
  if (blenderError) errors.push(blenderError);

  return { ok: errors.length === 0, errors };
}
```

Note: MCP connectivity check is deferred — Blender MCP requires a running Blender instance. The Blender PATH check is the practical minimum for startup.

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/validation/startup.test.ts`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add src/validation/startup.ts test/validation/startup.test.ts
git commit -m "feat(validation): add startup validation for API key and Blender"
```

---

## Task 7: First-Run Detection

**Files:**
- Create: `src/first-run/detect.ts`
- Test: `test/first-run/detect.test.ts`

**Step 1: Write the failing test**

```typescript
// test/first-run/detect.test.ts
import { describe, it, expect } from "vitest";
import { isFirstRun } from "../../src/first-run/detect.js";
import type { AppState, Collection } from "../../src/store/types.js";

const emptyCollection: Collection = { version: 2, pets: [] };

describe("isFirstRun", () => {
  it("returns true when state is null", () => {
    expect(isFirstRun(null, emptyCollection)).toBe(true);
  });

  it("returns true when collection is empty and pet has no consumed tokens", () => {
    const state: AppState = {
      version: 2,
      currentMonth: "2026-02",
      currentPet: {
        petId: "p1", spawnedAt: "2026-01-01T00:00:00Z",
        requiredTokens: 1_000_000_000, consumedTokens: 0,
        spawnIndex: 0, personalitySnapshot: null, generatedDesigns: null,
      },
      ingestionState: { files: {} },
      globalStats: {
        totalTokensAllTime: 0, totalSessionsIngested: 0,
        earliestTimestamp: null, latestTimestamp: null,
      },
      lastEncouragementShownAt: null,
    };
    expect(isFirstRun(state, emptyCollection)).toBe(true);
  });

  it("returns false when collection has pets", () => {
    const state: AppState = {
      version: 2,
      currentMonth: "2026-02",
      currentPet: {
        petId: "p2", spawnedAt: "2026-02-01T00:00:00Z",
        requiredTokens: 1_000_000_000, consumedTokens: 0,
        spawnIndex: 1, personalitySnapshot: null, generatedDesigns: null,
      },
      ingestionState: { files: {} },
      globalStats: {
        totalTokensAllTime: 1_000_000_000, totalSessionsIngested: 50,
        earliestTimestamp: "2026-01-01T00:00:00Z", latestTimestamp: "2026-02-01T00:00:00Z",
      },
      lastEncouragementShownAt: null,
    };
    const collection: Collection = {
      version: 2,
      pets: [{
        petId: "p1", spawnedAt: "2026-01-01T00:00:00Z",
        completedAt: "2026-02-01T00:00:00Z",
        requiredTokens: 1_000_000_000, consumedTokens: 1_000_000_000,
        spawnIndex: 0,
        personality: {
          usageMix: {}, depthMetrics: { editTestLoopCount: 0, repeatEditSameFileCount: 0, phaseSwitchCount: 0, totalSessions: 0 },
          styleMetrics: { bulletRatio: 0, questionRatio: 0, codeblockRatio: 0, avgMessageLen: 0, messageLenStd: 0, headingRatio: 0 },
          traits: {},
        },
        frames: [], colorFrames: [], seed: "abc",
      }],
    };
    expect(isFirstRun(state, collection)).toBe(false);
  });

  it("returns false when pet has consumed tokens", () => {
    const state: AppState = {
      version: 2,
      currentMonth: "2026-02",
      currentPet: {
        petId: "p1", spawnedAt: "2026-01-01T00:00:00Z",
        requiredTokens: 1_000_000_000, consumedTokens: 500_000_000,
        spawnIndex: 0, personalitySnapshot: null, generatedDesigns: null,
      },
      ingestionState: { files: {} },
      globalStats: {
        totalTokensAllTime: 500_000_000, totalSessionsIngested: 20,
        earliestTimestamp: "2026-01-01T00:00:00Z", latestTimestamp: "2026-02-01T00:00:00Z",
      },
      lastEncouragementShownAt: null,
    };
    expect(isFirstRun(state, emptyCollection)).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/first-run/detect.test.ts`
Expected: FAIL — module not found

**Step 3: Write implementation**

```typescript
// src/first-run/detect.ts
import type { AppState, Collection } from "../store/types.js";

export function isFirstRun(
  state: AppState | null,
  collection: Collection,
): boolean {
  if (state === null) return true;
  if (collection.pets.length > 0) return false;
  if (state.currentPet.consumedTokens > 0) return false;
  return true;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/first-run/detect.test.ts`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add src/first-run/detect.ts test/first-run/detect.test.ts
git commit -m "feat(first-run): add isFirstRun detection logic"
```

---

## Task 8: Recent-Tokens Ingestion Mode

**Files:**
- Create: `src/first-run/recent-ingestion.ts`
- Test: `test/first-run/recent-ingestion.test.ts`

This module scans all log files, sorts by timestamp (newest first), and extracts only the most recent 1B tokens worth of session metrics.

**Step 1: Write the failing test**

```typescript
// test/first-run/recent-ingestion.test.ts
import { describe, it, expect } from "vitest";
import { extractRecentTokens } from "../../src/first-run/recent-ingestion.js";
import type { SessionMetrics } from "../../src/ingestion/types.js";

function makeSession(id: string, tokens: number, timestamp: string): SessionMetrics {
  return {
    sessionId: id, totalTokens: tokens, inputTokens: tokens / 2,
    outputTokens: tokens / 2, cacheTokens: 0,
    toolUseCounts: {}, toolTransitions: [], editedExtensions: [],
    bashCommands: [], userMessageTexts: [], entryCount: 1,
    firstTimestamp: timestamp, lastTimestamp: timestamp,
  };
}

describe("extractRecentTokens", () => {
  it("returns all sessions when total < limit", () => {
    const sessions = [
      makeSession("s1", 300_000_000, "2026-01-01T00:00:00Z"),
      makeSession("s2", 200_000_000, "2026-01-02T00:00:00Z"),
    ];
    const result = extractRecentTokens(sessions, 1_000_000_000);
    expect(result).toHaveLength(2);
    expect(result.reduce((sum, s) => sum + s.totalTokens, 0)).toBe(500_000_000);
  });

  it("returns only newest sessions up to limit", () => {
    const sessions = [
      makeSession("s1", 600_000_000, "2026-01-01T00:00:00Z"),
      makeSession("s2", 500_000_000, "2026-01-02T00:00:00Z"),
      makeSession("s3", 400_000_000, "2026-01-03T00:00:00Z"),
    ];
    const result = extractRecentTokens(sessions, 1_000_000_000);
    // Newest first: s3 (400M) + s2 (500M) = 900M, then s1 would exceed
    expect(result.reduce((sum, s) => sum + s.totalTokens, 0)).toBeLessThanOrEqual(1_000_000_000);
    expect(result.some(s => s.sessionId === "s3")).toBe(true);
    expect(result.some(s => s.sessionId === "s2")).toBe(true);
  });

  it("returns empty array when no sessions", () => {
    expect(extractRecentTokens([], 1_000_000_000)).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/first-run/recent-ingestion.test.ts`
Expected: FAIL — module not found

**Step 3: Write implementation**

```typescript
// src/first-run/recent-ingestion.ts
import type { SessionMetrics } from "../ingestion/types.js";

export function extractRecentTokens(
  sessions: readonly SessionMetrics[],
  tokenLimit: number,
): SessionMetrics[] {
  const sorted = [...sessions].sort(
    (a, b) => b.lastTimestamp.localeCompare(a.lastTimestamp),
  );

  const result: SessionMetrics[] = [];
  let accumulated = 0;

  for (const session of sorted) {
    if (accumulated + session.totalTokens > tokenLimit && result.length > 0) {
      break;
    }
    result.push(session);
    accumulated += session.totalTokens;
  }

  return result;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/first-run/recent-ingestion.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/first-run/recent-ingestion.ts test/first-run/recent-ingestion.test.ts
git commit -m "feat(first-run): add extractRecentTokens for recent-1B ingestion"
```

---

## Task 9: First-Run Orchestrator

**Files:**
- Create: `src/first-run/orchestrate.ts`
- Test: `test/first-run/orchestrate.test.ts`

This ties together: full ingestion → extract recent 1B → personality → mark pet as completed.

**Step 1: Write the failing test**

```typescript
// test/first-run/orchestrate.test.ts
import { describe, it, expect, vi } from "vitest";
import { buildFirstRunState } from "../../src/first-run/orchestrate.js";
import type { SessionMetrics } from "../../src/ingestion/types.js";

function makeSession(id: string, tokens: number, timestamp: string): SessionMetrics {
  return {
    sessionId: id, totalTokens: tokens, inputTokens: tokens / 2,
    outputTokens: tokens / 2, cacheTokens: 0,
    toolUseCounts: { Write: 5, Read: 3 }, toolTransitions: ["Write→Read"],
    editedExtensions: [".ts"], bashCommands: ["npm test"],
    userMessageTexts: ["fix the bug"], entryCount: 10,
    firstTimestamp: timestamp, lastTimestamp: timestamp,
  };
}

describe("buildFirstRunState", () => {
  it("creates completed pet from sessions with personality", () => {
    const sessions = [
      makeSession("s1", 600_000_000, "2026-01-15T00:00:00Z"),
      makeSession("s2", 500_000_000, "2026-02-01T00:00:00Z"),
    ];
    const result = buildFirstRunState(sessions);

    expect(result.completedPet).toBeDefined();
    expect(result.completedPet.consumedTokens).toBe(result.completedPet.requiredTokens);
    expect(result.completedPet.personality.traits).toBeDefined();
    expect(result.nextPetState.currentPet.consumedTokens).toBe(0);
    expect(result.nextPetState.currentPet.spawnIndex).toBe(1);
  });

  it("handles < 1B tokens — still creates a completed pet", () => {
    const sessions = [makeSession("s1", 300_000_000, "2026-01-01T00:00:00Z")];
    const result = buildFirstRunState(sessions);

    expect(result.completedPet).toBeDefined();
    expect(result.completedPet.personality).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/first-run/orchestrate.test.ts`
Expected: FAIL — module not found

**Step 3: Write implementation**

```typescript
// src/first-run/orchestrate.ts
import { v4 as uuidv4 } from "uuid";
import { hostname } from "node:os";
import type { SessionMetrics } from "../ingestion/types.js";
import type { AppState, CompletedPet, PersonalitySnapshot } from "../store/types.js";
import { createInitialState } from "../store/store.js";
import { classifySession, computeDepthMetrics, computeStyleMetrics, computeTraits } from "../personality/index.js";
import { extractRecentTokens } from "./recent-ingestion.js";
import { generateSeed } from "../utils/seed.js";
import { TOKENS_PER_PET } from "../config/constants.js";

interface FirstRunResult {
  readonly completedPet: CompletedPet;
  readonly nextPetState: AppState;
}

export function buildFirstRunState(allSessions: readonly SessionMetrics[]): FirstRunResult {
  const recentSessions = extractRecentTokens(allSessions, TOKENS_PER_PET);

  // Personality analysis on recent sessions
  const allSignals = recentSessions.map((m) => ({
    editedExtensions: m.editedExtensions,
    toolTransitions: m.toolTransitions,
    bashCommands: m.bashCommands,
    toolUseCounts: m.toolUseCounts,
  }));

  const merged = {
    editedExtensions: allSignals.flatMap((s) => s.editedExtensions),
    toolTransitions: allSignals.flatMap((s) => s.toolTransitions),
    bashCommands: allSignals.flatMap((s) => s.bashCommands),
    toolUseCounts: allSignals.reduce((acc, s) => {
      for (const [k, v] of Object.entries(s.toolUseCounts)) acc[k] = (acc[k] ?? 0) + v;
      return acc;
    }, {} as Record<string, number>),
  };

  const classification = classifySession(merged);
  const depth = computeDepthMetrics(recentSessions);
  const style = computeStyleMetrics(recentSessions.flatMap((m) => m.userMessageTexts));
  const traits = computeTraits(classification.scores, depth, style);

  const personality: PersonalitySnapshot = {
    usageMix: classification.scores,
    depthMetrics: depth,
    styleMetrics: style,
    traits,
  };

  const totalTokens = recentSessions.reduce((sum, s) => sum + s.totalTokens, 0);
  const petId = uuidv4();
  const now = new Date().toISOString();
  const seed = generateSeed(hostname(), petId);

  const completedPet: CompletedPet = {
    petId,
    spawnedAt: now,
    completedAt: now,
    requiredTokens: Math.max(totalTokens, TOKENS_PER_PET),
    consumedTokens: Math.max(totalTokens, TOKENS_PER_PET),
    spawnIndex: 0,
    personality,
    frames: [],
    colorFrames: [],
    seed,
  };

  // Next pet starts fresh at index 1
  const baseState = createInitialState();
  const nextPetState: AppState = {
    ...baseState,
    currentPet: {
      ...baseState.currentPet,
      spawnIndex: 1,
    },
    globalStats: {
      totalTokensAllTime: totalTokens,
      totalSessionsIngested: recentSessions.length,
      earliestTimestamp: recentSessions.length > 0
        ? recentSessions.reduce((e, s) => s.firstTimestamp < e ? s.firstTimestamp : e, recentSessions[0].firstTimestamp)
        : null,
      latestTimestamp: recentSessions.length > 0
        ? recentSessions.reduce((l, s) => s.lastTimestamp > l ? s.lastTimestamp : l, recentSessions[0].lastTimestamp)
        : null,
    },
  };

  return { completedPet, nextPetState };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/first-run/orchestrate.test.ts`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/first-run/orchestrate.ts test/first-run/orchestrate.test.ts
git commit -m "feat(first-run): add buildFirstRunState orchestrator"
```

---

## Task 10: Integrate First-Run into Main Pipeline

**Files:**
- Modify: `src/index.ts:122-158` (add first-run branch inside `runFull`)
- Test: `test/index.test.ts` (add first-run integration test, create if needed)

**Step 1: Write the failing test**

```typescript
// test/first-run/integration.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isFirstRun } from "../../src/first-run/detect.js";
import { createInitialState, createInitialCollection } from "../../src/store/store.js";

describe("first-run integration", () => {
  it("detects first run on fresh state", () => {
    const state = createInitialState();
    const collection = createInitialCollection();
    expect(isFirstRun(state, collection)).toBe(true);
  });

  it("does not detect first run after tokens consumed", () => {
    const state = {
      ...createInitialState(),
      currentPet: {
        ...createInitialState().currentPet,
        consumedTokens: 100_000,
      },
    };
    const collection = createInitialCollection();
    expect(isFirstRun(state, collection)).toBe(false);
  });
});
```

**Step 2: Run test to verify it passes** (this is an integration verification test)

Run: `npx vitest run test/first-run/integration.test.ts`
Expected: PASS

**Step 3: Modify runFull in src/index.ts**

Add first-run logic at the top of the try block in `runFull()`, after loading state/collection but before normal ingestion:

```typescript
// Add imports at top of src/index.ts:
import { isFirstRun } from "./first-run/detect.js";
import { buildFirstRunState } from "./first-run/orchestrate.js";

// Inside runFull(), after loading state and collection, before "// 1. Ingest":
    // First-run: generate initial pet from recent history
    if (isFirstRun(state, collection)) {
      const { state: postIngest, sessionMetrics } = runIngestion(cfg, state);
      state = postIngest;
      if (sessionMetrics.length > 0) {
        const firstRun = buildFirstRunState(sessionMetrics);
        collection = addCompletedPet(collection, firstRun.completedPet);
        state = {
          ...firstRun.nextPetState,
          ingestionState: state.ingestionState,  // Preserve byte offsets
        };
        saveState(state);
        saveCollection(collection);
        return { state, collection, newlyCompleted: [firstRun.completedPet] };
      }
    }
```

**Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/index.ts test/first-run/integration.test.ts
git commit -m "feat: integrate first-run experience into main pipeline"
```

---

## Task 11: Integrate Validation into CLI Entry Point

**Files:**
- Modify: `bin/tomotoken.ts` (add validation check before commands that need full pipeline)

**Step 1: Add validation helper**

At the top of `bin/tomotoken.ts`, add:

```typescript
import { validateStartup } from "../src/validation/startup.js";
import { loadConfig } from "../src/config/index.js";

function checkEnvironment(): void {
  const config = loadConfig();
  const result = validateStartup(config.llm);
  if (!result.ok) {
    console.error("\n⚠ Setup incomplete:\n");
    for (const error of result.errors) {
      console.error(`  [${error.component}] ${error.message}`);
      console.error(`  → See README: ${error.helpSection}\n`);
    }
    process.exit(1);
  }
}
```

**Step 2: Add validation to relevant commands**

Add `checkEnvironment()` call at the beginning of the `show` command action (which is the default command and triggers `runFull`). Other commands that call `runFull()` should also call it: `stats`, `collection`, `view`, `watch`, `rescan`.

**Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (CLI tests don't invoke actual commands)

**Step 4: Commit**

```bash
git add bin/tomotoken.ts
git commit -m "feat(cli): add startup validation before pipeline commands"
```

---

## Task 12: Export New Modules from Index Files

**Files:**
- Create: `src/first-run/index.ts`
- Create: `src/validation/index.ts`
- Modify: `src/config/index.ts` (add resolveApiKey export)
- Modify: `src/generation/index.ts` (add llm-provider export, create if needed)

**Step 1: Create index files**

```typescript
// src/first-run/index.ts
export { isFirstRun } from "./detect.js";
export { extractRecentTokens } from "./recent-ingestion.js";
export { buildFirstRunState } from "./orchestrate.js";
```

```typescript
// src/validation/index.ts
export { validateStartup, type ValidationResult, type ValidationError } from "./startup.js";
```

**Step 2: Update existing index files**

In `src/config/index.ts`, add:
```typescript
export { resolveApiKey } from "./resolve-api-key.js";
```

**Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/first-run/index.ts src/validation/index.ts src/config/index.ts
git commit -m "chore: add module index exports for first-run, validation, config"
```

---

## Task 13: Full Integration Test & Final Verification

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Run type checking**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Run test coverage**

Run: `npx vitest run --coverage`
Expected: Coverage ≥ 80% for new files

**Step 4: Build check**

Run: `npm run build`
Expected: Builds successfully

**Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "chore: fix integration issues from open-source UX implementation"
```

---

## Summary

| Task | Description | New Files | Modified Files |
|------|-------------|-----------|----------------|
| 1 | LLM Provider interface | `src/generation/llm-provider.ts`, test | — |
| 2 | OpenAI SDK dependency | — | `package.json` |
| 3 | LLM config schema | test | `src/config/schema.ts` |
| 4 | Refactor designer.ts | — | `src/generation/designer.ts`, test |
| 5 | API key resolution | `src/config/resolve-api-key.ts`, test | — |
| 6 | Startup validation | `src/validation/startup.ts`, test | — |
| 7 | First-run detection | `src/first-run/detect.ts`, test | — |
| 8 | Recent-tokens extraction | `src/first-run/recent-ingestion.ts`, test | — |
| 9 | First-run orchestrator | `src/first-run/orchestrate.ts`, test | — |
| 10 | Main pipeline integration | test | `src/index.ts` |
| 11 | CLI validation | — | `bin/tomotoken.ts` |
| 12 | Module exports | `src/first-run/index.ts`, `src/validation/index.ts` | `src/config/index.ts` |
| 13 | Final verification | — | — |

**Parallelizable groups** (tasks with no dependencies between them):
- **Group A**: Tasks 1-2 (LLM provider + OpenAI SDK)
- **Group B**: Tasks 5-6 (API key resolution + startup validation)
- **Group C**: Tasks 7-8 (first-run detection + recent tokens)
- Tasks 3, 4 depend on Task 1
- Task 9 depends on Tasks 7-8
- Task 10 depends on Tasks 9, 4
- Task 11 depends on Task 6
