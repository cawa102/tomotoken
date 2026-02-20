import { loadState, saveState, updatePetInState } from "../store/store.js";
import { runFull } from "../index.js";
import { buildPrompt } from "./prompt.js";
import { creatureDesignSchema, type CreatureDesign, type Part } from "./schema.js";
import { computeLimbStage } from "../art/parametric/progress.js";
import { TRAIT_IDS } from "../config/constants.js";
import { customizationSchema } from "./templates/types.js";
import { applyCustomization } from "./templates/apply.js";
import { humanoidTemplate } from "./templates/humanoid.js";

const STAGE_DESCRIPTIONS: Record<number, string> = {
  0: "卵: 単純な卵形。模様や色で個性を出す",
  1: "幼体: 小さく丸い体。手足はまだ短い",
  2: "子供: 両手両足が生え揃い、耳や尻尾が出始める",
  3: "青年: 体が大きくなり、角や模様などの装飾が増える",
  4: "完成: 全てのパーツが揃い、翼やアクセサリーも付く",
  5: "マスター: 完成形に光り輝くエフェクトや特別な装飾が加わる",
};

const CUSTOMIZATION_HINT = `Customization JSON format:
{
  bodyColor: "#RRGGBB",       // main body color
  accentColor: "#RRGGBB",     // accent (ears, tail, legs)
  eyeColor: "#RRGGBB",        // pupil color
  accessoryColor: "#RRGGBB",  // for accessories
  showAccessories: [],         // subset of ["hat", "scarf", "backpack", "glasses"]
  animationStyle: "calm",     // "calm" | "energetic" | "sleepy"
  expressions: {
    default: { eyes: { shape: "round" }, mouth: { shape: "flat" } },
    happy: { eyes: { shape: "happy" }, mouth: { shape: "smile" } },
    sleepy: { eyes: { shape: "sleepy" }, mouth: { shape: "flat" } },
    focused: { eyes: { shape: "sparkle" }, mouth: { shape: "flat" } }
  },
  personality: { name: "...", quirk: "..." }
}
eye shapes: round | happy | sleepy | sparkle
mouth shapes: smile | open | flat | pout`;

export interface DesignContext {
  readonly stage: number;
  readonly stageDescription: string;
  readonly prompt: string;
  readonly templateId: string;
  readonly customizationHint: string;
  readonly existingStages: readonly number[];
  readonly previousParts: readonly Part[] | null;
  readonly petId: string;
}

function deriveArchetypeAndSubtype(traits: Record<string, number>): { archetype: string; subtype: string } {
  const sorted = [...TRAIT_IDS].sort((a, b) => (traits[b] ?? 0) - (traits[a] ?? 0));
  return { archetype: sorted[0], subtype: sorted[1] };
}

/**
 * Read current state, compute stage, and produce context for Claude Code to generate a design.
 */
export async function getDesignContext(): Promise<DesignContext> {
  const state = loadState() ?? (await runFull()).state;

  const pet = state.currentPet;
  const snapshot = pet.personalitySnapshot;
  if (!snapshot) {
    throw new Error("No personality snapshot available. Run tomotoken first to accumulate usage data.");
  }

  const progress = pet.requiredTokens > 0
    ? Math.min(1.0, pet.consumedTokens / pet.requiredTokens)
    : 0;
  const stage = computeLimbStage(progress);

  const { archetype, subtype } = deriveArchetypeAndSubtype(snapshot.traits);

  const existingStages = pet.generatedDesigns
    ? Object.keys(pet.generatedDesigns).map(Number).sort((a, b) => a - b)
    : [];

  const previousParts = stage > 0 && pet.generatedDesigns?.[stage - 1]
    ? (pet.generatedDesigns[stage - 1].parts as readonly Part[])
    : null;

  const prompt = buildPrompt({
    archetype,
    subtype,
    traits: snapshot.traits,
    depth: snapshot.depthMetrics,
    style: snapshot.styleMetrics,
    stage,
    previousParts,
  });

  return {
    stage,
    stageDescription: `${stage}: ${STAGE_DESCRIPTIONS[stage] ?? "不明"}`,
    prompt,
    templateId: "humanoid",
    customizationHint: CUSTOMIZATION_HINT,
    existingStages,
    previousParts,
    petId: pet.petId,
  };
}

/**
 * Parse a Customization JSON string, apply the humanoid template, validate, and save.
 */
export async function saveDesign(jsonInput: string): Promise<CreatureDesign> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonInput);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid JSON input: ${msg}`);
  }

  const customization = customizationSchema.parse(parsed);
  const design = applyCustomization(humanoidTemplate, customization);

  // Defense in depth: validate the resulting CreatureDesign
  creatureDesignSchema.parse(design);

  const state = loadState();
  if (!state) {
    throw new Error("No state found. Cannot save design without existing state.");
  }

  const pet = state.currentPet;
  const progress = pet.requiredTokens > 0
    ? Math.min(1.0, pet.consumedTokens / pet.requiredTokens)
    : 0;
  const stage = computeLimbStage(progress);

  const updatedDesigns = { ...(pet.generatedDesigns ?? {}), [stage]: design };
  const updatedState = updatePetInState(state, { generatedDesigns: updatedDesigns });
  saveState(updatedState);

  return design;
}

// CLI entry point
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--context")) {
    const ctx = await getDesignContext();
    process.stdout.write(JSON.stringify(ctx, null, 2) + "\n");
  } else if (args.includes("--save")) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    const input = Buffer.concat(chunks).toString("utf-8").trim();
    const design = await saveDesign(input);
    process.stdout.write(`Design saved for stage (personality: ${design.personality.name})\n`);
  } else {
    process.stderr.write("Usage: npx tsx src/generation/cli.ts --context | --save\n");
    process.exit(1);
  }
}

// Only run main when executed directly (not imported)
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const thisFile = fileURLToPath(import.meta.url);
const isMainModule = resolve(process.argv[1] ?? "") === resolve(thisFile);
if (isMainModule) {
  main().catch((err) => {
    process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
