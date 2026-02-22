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
  const envVar =
    config.provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
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
      message:
        "Blender not found in PATH. Install Blender 4.x and ensure it is in your PATH.",
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
