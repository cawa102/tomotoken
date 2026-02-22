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

  async generateText(prompt: string, system?: string): Promise<string> {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: this.apiKey });
    const response = await client.messages.create({
      model: this.model,
      max_tokens: 4096,
      ...(system ? { system } : {}),
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
