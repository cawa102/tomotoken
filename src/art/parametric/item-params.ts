import type { ItemFamily, ItemParams, Richness } from "./item-types.js";

const FAMILIES: readonly ItemFamily[] = ["blade", "staff", "shield", "tool", "orb"];

function computeRichness(tokenRatio: number): Richness {
  if (tokenRatio < 0.5) return "modest";
  if (tokenRatio <= 1.0) return "standard";
  return "lavish";
}

function dominantCategory(usageMix: Record<string, number>): string {
  let max = 0;
  let cat = "impl";
  for (const [k, v] of Object.entries(usageMix)) {
    if (v > max) { max = v; cat = k; }
  }
  return cat;
}

export function deriveItemParams(
  traits: Record<string, number>,
  usageMix: Record<string, number>,
  tokenRatio: number,
  prng: () => number,
): ItemParams {
  const t = (id: string): number => traits[id] ?? 0;
  const traitSum = (t("builder") + t("fixer") + t("refiner") + t("scholar") +
    t("scribe") + t("architect") + t("operator") + t("guardian")) / 800;
  const familyIdx = Math.floor((traitSum * 0.3 + prng() * 0.7) * FAMILIES.length);
  const family = FAMILIES[Math.min(familyIdx, FAMILIES.length - 1)];

  const length = Math.round((prng() * 0.7 + traitSum * 0.3) * 4 + 2);   // 2-6
  const width = Math.round((prng() * 0.7 + traitSum * 0.3) * 3 + 1);     // 1-4
  const taper = prng();
  const curvature = prng();
  const crossPiece = prng() > 0.5;
  const richness = computeRichness(tokenRatio);

  return {
    family,
    length: Math.min(6, Math.max(2, length)),
    width: Math.min(4, Math.max(1, width)),
    taper,
    curvature,
    crossPiece,
    richness,
    dominantCategory: dominantCategory(usageMix),
  };
}
