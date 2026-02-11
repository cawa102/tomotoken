import { CATEGORY_IDS } from "../config/constants.js";
import type { CategoryId, ClassificationSignals, SessionClassification, UsageMix } from "./types.js";

const EXT_MAP: Record<string, CategoryId> = {
  ".md": "docs",
  ".mdx": "docs",
  ".txt": "docs",
  ".test.ts": "debug",
  ".test.tsx": "debug",
  ".spec.ts": "debug",
  ".test.js": "debug",
  "_test.go": "debug",
  ".yml": "ops",
  ".yaml": "ops",
  ".env": "ops",
  ".dockerfile": "ops",
};

const CODE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".go", ".py", ".rs", ".java", ".rb", ".c", ".cpp", ".h"]);

const BASH_KEYWORDS: Record<string, CategoryId> = {
  test: "debug", jest: "debug", vitest: "debug", pytest: "debug", "go test": "debug", mocha: "debug",
  lint: "refactor", format: "refactor", prettier: "refactor", eslint: "refactor", "gofmt": "refactor",
  docker: "ops", compose: "ops", kubectl: "ops", "npm install": "ops", "pip install": "ops",
  "go mod": "ops", brew: "ops",
  audit: "security", snyk: "security", gosec: "security", bandit: "security", "npm audit": "security",
};

function scoreExtensions(exts: readonly string[]): Record<CategoryId, number> {
  const scores: Record<string, number> = {};
  for (const ext of exts) {
    // Check compound extensions first
    let matched = false;
    for (const [pattern, cat] of Object.entries(EXT_MAP)) {
      if (ext.endsWith(pattern)) {
        scores[cat] = (scores[cat] ?? 0) + 3;
        matched = true;
        break;
      }
    }
    if (!matched && CODE_EXTS.has(ext)) {
      scores["impl"] = (scores["impl"] ?? 0) + 1;
    }
  }
  return scores as Record<CategoryId, number>;
}

function scoreTransitions(transitions: readonly string[]): Record<CategoryId, number> {
  const scores: Record<string, number> = {};
  for (let i = 0; i < transitions.length - 1; i++) {
    const a = transitions[i];
    const b = transitions[i + 1];
    if ((a === "Edit" || a === "Write") && b === "Bash") scores["debug"] = (scores["debug"] ?? 0) + 2;
    if (a === "Read" && b === "Grep") scores["research"] = (scores["research"] ?? 0) + 2;
    if (a === "Grep" && b === "Read") scores["research"] = (scores["research"] ?? 0) + 2;
    if ((a === "Edit" || a === "Write") && (b === "Edit" || b === "Write")) scores["impl"] = (scores["impl"] ?? 0) + 1;
  }
  return scores as Record<CategoryId, number>;
}

function scoreBashCommands(commands: readonly string[]): Record<CategoryId, number> {
  const scores: Record<string, number> = {};
  for (const cmd of commands) {
    const lower = cmd.toLowerCase();
    for (const [keyword, cat] of Object.entries(BASH_KEYWORDS)) {
      if (lower.includes(keyword)) {
        scores[cat] = (scores[cat] ?? 0) + 2;
        break;
      }
    }
  }
  return scores as Record<CategoryId, number>;
}

function scoreToolDistribution(counts: Record<string, number>): Record<CategoryId, number> {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return {} as Record<CategoryId, number>;

  const scores: Record<string, number> = {};
  const readGrep = (counts["Read"] ?? 0) + (counts["Grep"] ?? 0);
  const editWrite = (counts["Edit"] ?? 0) + (counts["Write"] ?? 0);
  const bash = counts["Bash"] ?? 0;

  if (readGrep / total > 0.5) scores["research"] = (scores["research"] ?? 0) + 3;
  if (editWrite / total > 0.5) scores["impl"] = (scores["impl"] ?? 0) + 3;
  if (bash / total > 0.4) scores["ops"] = (scores["ops"] ?? 0) + 2;

  return scores as Record<CategoryId, number>;
}

function capAndNormalize(signals: Record<CategoryId, number>[]): UsageMix {
  const combined: Record<string, number> = {};
  for (const cat of CATEGORY_IDS) combined[cat] = 0;

  for (const signal of signals) {
    for (const [cat, val] of Object.entries(signal)) {
      combined[cat] += val;
    }
  }

  const total = Object.values(combined).reduce((a, b) => a + b, 0) || 1;
  const result: Record<string, number> = {};
  for (const cat of CATEGORY_IDS) {
    result[cat] = combined[cat] / total;
  }
  return result as UsageMix;
}

export function classifySession(signals: ClassificationSignals): SessionClassification {
  const s1 = scoreExtensions(signals.editedExtensions);
  const s2 = scoreTransitions(signals.toolTransitions);
  const s3 = scoreBashCommands(signals.bashCommands);
  const s4 = scoreToolDistribution(signals.toolUseCounts);

  const scores = capAndNormalize([s1, s2, s3, s4]);

  let primaryCategory: CategoryId = "impl";
  let maxScore = 0;
  for (const cat of CATEGORY_IDS) {
    if (scores[cat] > maxScore) {
      maxScore = scores[cat];
      primaryCategory = cat;
    }
  }

  return { scores, primaryCategory };
}
