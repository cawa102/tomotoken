import { readdirSync, lstatSync } from "node:fs";
import { join } from "node:path";
import type { ScanResult } from "./types.js";

export function scanLogFiles(baseDir: string): ScanResult[] {
  const results: ScanResult[] = [];
  walk(baseDir, results);
  return results;
}

function walk(dir: string, results: ScanResult[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const name of entries) {
    const fullPath = join(dir, name);
    let st;
    try {
      st = lstatSync(fullPath);
    } catch {
      continue;
    }

    if (st.isSymbolicLink()) continue;

    if (st.isDirectory()) {
      walk(fullPath, results);
    } else if (name.endsWith(".jsonl")) {
      results.push({ filePath: fullPath, sizeBytes: st.size });
    }
  }
}
