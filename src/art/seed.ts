import { hostname } from "node:os";
import { sha256 } from "../utils/hash.js";

export function generateSeed(machineId?: string, petId?: string): string {
  const machine = machineId ?? hostname();
  const pet = petId ?? "default";
  return sha256(`${machine}:${pet}`);
}
