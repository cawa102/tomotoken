import Anthropic from "@anthropic-ai/sdk";
import { creatureDesignSchema, type CreatureDesign } from "./schema.js";
import { buildPrompt, type PromptInput } from "./prompt.js";
import type { DepthMetrics, StyleMetrics } from "../store/types.js";

export interface DesignRequest {
  readonly archetype: string;
  readonly subtype: string;
  readonly traits: Record<string, number>;
  readonly depth: DepthMetrics;
  readonly style: StyleMetrics;
  readonly stage: number;
  readonly previousParts: readonly unknown[] | null;
  readonly apiKey: string;
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenced) return fenced[1].trim();
  return text.trim();
}

export async function generateCreatureDesign(request: DesignRequest): Promise<CreatureDesign> {
  const client = new Anthropic({ apiKey: request.apiKey });

  const promptInput: PromptInput = {
    archetype: request.archetype,
    subtype: request.subtype,
    traits: request.traits,
    depth: request.depth,
    style: request.style,
    stage: request.stage,
    previousParts: request.previousParts,
  };

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: buildPrompt(promptInput) }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in Claude response");
  }

  const jsonStr = extractJson(textBlock.text);
  const parsed = JSON.parse(jsonStr);
  return creatureDesignSchema.parse(parsed);
}
