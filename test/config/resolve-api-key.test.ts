import { describe, it, expect, afterEach } from "vitest";
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
