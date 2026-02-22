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
