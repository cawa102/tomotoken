import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @anthropic-ai/sdk dynamic import
const mockMessagesCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockMessagesCreate };
    constructor(_opts: unknown) {}
  },
}));

// Mock openai dynamic import
const mockChatCompletionsCreate = vi.fn();
vi.mock("openai", () => ({
  OpenAI: class MockOpenAI {
    chat = { completions: { create: mockChatCompletionsCreate } };
    constructor(_opts: unknown) {}
  },
}));

import { createLLMProvider } from "../../src/generation/llm-provider.js";

describe("createLLMProvider", () => {
  it("throws on unknown provider", () => {
    expect(() =>
      createLLMProvider({ provider: "unknown" as any, model: "x", apiKey: "k" })
    ).toThrow("Unknown LLM provider: unknown");
  });

  it("returns AnthropicProvider for 'anthropic'", () => {
    const p = createLLMProvider({ provider: "anthropic", model: "claude-sonnet-4-6-20250620", apiKey: "test-key" });
    expect(p).toBeDefined();
    expect(p.providerName).toBe("anthropic");
  });

  it("returns OpenAIProvider for 'openai'", () => {
    const p = createLLMProvider({ provider: "openai", model: "gpt-5.2", apiKey: "test-key" });
    expect(p).toBeDefined();
    expect(p.providerName).toBe("openai");
  });
});

describe("AnthropicProvider.generateText", () => {
  beforeEach(() => {
    mockMessagesCreate.mockReset();
  });

  it("returns text from Anthropic API response", async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "Hello from Claude" }],
    });

    const provider = createLLMProvider({ provider: "anthropic", model: "claude-sonnet-4-6-20250620", apiKey: "test-key" });
    const result = await provider.generateText("Say hello");

    expect(result).toBe("Hello from Claude");
    expect(mockMessagesCreate).toHaveBeenCalledWith({
      model: "claude-sonnet-4-6-20250620",
      max_tokens: 4096,
      messages: [{ role: "user", content: "Say hello" }],
    });
  });

  it("passes system prompt when provided", async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "Response" }],
    });

    const provider = createLLMProvider({ provider: "anthropic", model: "claude-sonnet-4-6-20250620", apiKey: "test-key" });
    await provider.generateText("prompt", "system instructions");

    expect(mockMessagesCreate).toHaveBeenCalledWith({
      model: "claude-sonnet-4-6-20250620",
      max_tokens: 4096,
      system: "system instructions",
      messages: [{ role: "user", content: "prompt" }],
    });
  });

  it("throws when response has no text block", async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: "tool_use", id: "t1", name: "foo", input: {} }],
    });

    const provider = createLLMProvider({ provider: "anthropic", model: "claude-sonnet-4-6-20250620", apiKey: "test-key" });
    await expect(provider.generateText("prompt")).rejects.toThrow("No text content in Anthropic response");
  });

  it("throws when response content is empty", async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [],
    });

    const provider = createLLMProvider({ provider: "anthropic", model: "claude-sonnet-4-6-20250620", apiKey: "test-key" });
    await expect(provider.generateText("prompt")).rejects.toThrow("No text content in Anthropic response");
  });
});

describe("OpenAIProvider.generateText", () => {
  beforeEach(() => {
    mockChatCompletionsCreate.mockReset();
  });

  it("returns text from OpenAI API response", async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: "Hello from GPT" } }],
    });

    const provider = createLLMProvider({ provider: "openai", model: "gpt-5.2", apiKey: "test-key" });
    const result = await provider.generateText("Say hello");

    expect(result).toBe("Hello from GPT");
    expect(mockChatCompletionsCreate).toHaveBeenCalledWith({
      model: "gpt-5.2",
      max_tokens: 4096,
      messages: [{ role: "user", content: "Say hello" }],
    });
  });

  it("includes system message when provided", async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: "Response" } }],
    });

    const provider = createLLMProvider({ provider: "openai", model: "gpt-5.2", apiKey: "test-key" });
    await provider.generateText("prompt", "system instructions");

    expect(mockChatCompletionsCreate).toHaveBeenCalledWith({
      model: "gpt-5.2",
      max_tokens: 4096,
      messages: [
        { role: "system", content: "system instructions" },
        { role: "user", content: "prompt" },
      ],
    });
  });

  it("throws when response has null content", async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    const provider = createLLMProvider({ provider: "openai", model: "gpt-5.2", apiKey: "test-key" });
    await expect(provider.generateText("prompt")).rejects.toThrow("No text content in OpenAI response");
  });

  it("throws when choices array is empty", async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [],
    });

    const provider = createLLMProvider({ provider: "openai", model: "gpt-5.2", apiKey: "test-key" });
    await expect(provider.generateText("prompt")).rejects.toThrow("No text content in OpenAI response");
  });
});
