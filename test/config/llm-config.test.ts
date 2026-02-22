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
