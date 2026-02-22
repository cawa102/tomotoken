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
