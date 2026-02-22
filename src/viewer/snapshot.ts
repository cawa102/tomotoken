import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const DEFAULT_SNAPSHOT_DIR = join(homedir(), ".tomotoken", "snapshots");

const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

function validatePetId(petId: string): void {
  if (!SAFE_ID.test(petId)) {
    throw new Error(`Invalid petId: ${petId}`);
  }
}

export function saveSnapshot(
  petId: string,
  pngData: Buffer,
  dir: string = DEFAULT_SNAPSHOT_DIR,
): void {
  validatePetId(petId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${petId}.png`), pngData);
}

export function getSnapshotPath(
  petId: string,
  dir: string = DEFAULT_SNAPSHOT_DIR,
): string | null {
  validatePetId(petId);
  const path = join(dir, `${petId}.png`);
  return existsSync(path) ? path : null;
}

export function listSnapshotPetIds(
  dir: string = DEFAULT_SNAPSHOT_DIR,
): ReadonlySet<string> {
  if (!existsSync(dir)) return new Set();
  const files = readdirSync(dir);
  const ids = files
    .filter((f) => f.endsWith(".png"))
    .map((f) => f.slice(0, -4));
  return new Set(ids);
}
