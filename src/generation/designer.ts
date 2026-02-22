import { creatureDesignSchema, type CreatureDesign } from "./schema.js";
import { buildPrompt, type PromptInput } from "./prompt.js";
import type { LLMProvider } from "./llm-provider.js";
import type { DepthMetrics, StyleMetrics } from "../store/types.js";

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
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(
      `LLM returned non-JSON response (provider: ${request.provider.providerName}). ` +
      `Raw (first 200 chars): ${text.slice(0, 200)}`,
    );
  }
  const result = creatureDesignSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`LLM response failed schema validation: ${result.error.message}`);
  }
  return result.data;
}
