import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const DEFAULT_SNAPSHOT_DIR = join(homedir(), ".tomotoken", "snapshots");

const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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
  if (pngData.length < 8 || !pngData.subarray(0, 8).equals(PNG_MAGIC)) {
    throw new Error("Invalid PNG data");
  }
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
