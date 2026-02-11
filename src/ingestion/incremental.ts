import { openSync, readSync, closeSync, statSync, lstatSync } from "node:fs";
import { parseLine } from "./parser.js";
import type { ParsedLogEntry } from "./types.js";

export interface IncrementalResult {
  readonly entries: readonly ParsedLogEntry[];
  readonly newByteOffset: number;
}

const MAX_READ_BYTES = 50 * 1024 * 1024; // 50 MB per read cycle

export function readIncremental(filePath: string, fromOffset: number): IncrementalResult {
  let st;
  try {
    st = lstatSync(filePath);
  } catch {
    return { entries: [], newByteOffset: fromOffset };
  }

  if (st.isSymbolicLink()) {
    return { entries: [], newByteOffset: fromOffset };
  }

  if (fromOffset >= st.size) {
    return { entries: [], newByteOffset: fromOffset };
  }

  const bytesToRead = Math.min(st.size - fromOffset, MAX_READ_BYTES);
  const buffer = Buffer.alloc(bytesToRead);
  const fd = openSync(filePath, "r");
  try {
    readSync(fd, buffer, 0, bytesToRead, fromOffset);
  } finally {
    closeSync(fd);
  }

  const text = buffer.toString("utf-8");
  const lastNewline = text.lastIndexOf("\n");
  if (lastNewline === -1) {
    return { entries: [], newByteOffset: fromOffset };
  }

  const completeText = text.slice(0, lastNewline + 1);
  const lines = completeText.split("\n");
  const entries: ParsedLogEntry[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const parsed = parseLine(line);
    if (parsed) entries.push(parsed);
  }

  const bytesConsumed = Buffer.byteLength(completeText, "utf-8");
  return { entries, newByteOffset: fromOffset + bytesConsumed };
}
