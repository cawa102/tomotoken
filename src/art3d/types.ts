import type { CreatureParams } from "../art/parametric/types.js";
import type { EggStage } from "../progression/stages.js";
import type { CreatureDesign } from "../generation/schema.js";

/**
 * Data contract between sidecar (Node.js) and viewer (Three.js WebView).
 *
 * The sidecar runs the ingestion/progression/personality pipeline and produces
 * this structure. The viewer consumes it to build/update the 3D scene.
 */
export interface PetRenderData {
  readonly creatureParams: CreatureParams;
  readonly palette: readonly string[]; // hex RGB strings (e.g. "#ff8800"), indices match Palette slots
  readonly progress: number; // 0.0-1.0
  readonly petId: string;
  readonly seed: string;
  readonly archetype: string; // highest trait: "builder" | "fixer" | ...
  readonly subtype: string; // second highest trait
  readonly stage: EggStage; // 0-4 egg stage (0=pristine, 4=hatched)
  readonly traits: Record<string, number>; // 8 trait scores (0-100)
  readonly creatureDesign: CreatureDesign | null; // LLM-generated design, null if not available
}
