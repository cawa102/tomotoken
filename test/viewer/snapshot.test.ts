import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { saveSnapshot, getSnapshotPath, listSnapshotPetIds } from "../../src/viewer/snapshot.js";

const TEST_DIR = join(process.cwd(), "test", "tmp-snapshots");

describe("snapshot", () => {
  beforeEach(() => { mkdirSync(TEST_DIR, { recursive: true }); });
  afterEach(() => { rmSync(TEST_DIR, { recursive: true, force: true }); });

  it("saves PNG data and retrieves path", () => {
    const pngData = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
    saveSnapshot("pet-001", pngData, TEST_DIR);

    const path = getSnapshotPath("pet-001", TEST_DIR);
    expect(path).not.toBeNull();
    expect(existsSync(path!)).toBe(true);
    expect(readFileSync(path!)).toEqual(pngData);
  });

  it("returns null for missing snapshot", () => {
    expect(getSnapshotPath("nonexistent", TEST_DIR)).toBeNull();
  });

  it("lists petIds that have snapshots", () => {
    const pngData = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
    saveSnapshot("pet-a", pngData, TEST_DIR);
    saveSnapshot("pet-b", pngData, TEST_DIR);

    const ids = listSnapshotPetIds(TEST_DIR);
    expect(ids).toEqual(new Set(["pet-a", "pet-b"]));
  });

  it("rejects petId with path traversal", () => {
    const pngData = Buffer.from([0x89, 0x50]);
    expect(() => saveSnapshot("../evil", pngData, TEST_DIR)).toThrow();
    expect(() => saveSnapshot("foo/bar", pngData, TEST_DIR)).toThrow();
  });

  it("rejects petId with dot prefix", () => {
    const pngData = Buffer.from([0x89, 0x50]);
    expect(() => saveSnapshot(".hidden", pngData, TEST_DIR)).toThrow();
  });

  it("overwrites existing snapshot", () => {
    const data1 = Buffer.from([0x89, 0x50, 0x01]);
    const data2 = Buffer.from([0x89, 0x50, 0x02]);
    saveSnapshot("pet-x", data1, TEST_DIR);
    saveSnapshot("pet-x", data2, TEST_DIR);

    const path = getSnapshotPath("pet-x", TEST_DIR);
    expect(readFileSync(path!)).toEqual(data2);
  });

  it("returns empty set for nonexistent directory", () => {
    const ids = listSnapshotPetIds(join(TEST_DIR, "does-not-exist"));
    expect(ids).toEqual(new Set());
  });
});
