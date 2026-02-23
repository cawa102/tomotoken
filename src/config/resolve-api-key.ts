const ENV_KEYS: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
};

let configKeyWarningShown = false;

export function resolveApiKey(config: {
  readonly provider: string;
  readonly apiKey?: string;
}): string | undefined {
  if (config.apiKey) {
    if (!configKeyWarningShown) {
      process.stderr.write(
        "[tomotoken] Warning: API key found in config.json. " +
        "Consider using environment variables instead (e.g., ANTHROPIC_API_KEY).\n",
      );
      configKeyWarningShown = true;
    }
    return config.apiKey;
  }
  const envKey = ENV_KEYS[config.provider];
  return envKey ? process.env[envKey] : undefined;
}
