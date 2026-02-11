import { extname } from "node:path";
import type { ParsedLogEntry, SessionMetrics } from "./types.js";

export function aggregateSessions(entries: readonly ParsedLogEntry[]): SessionMetrics[] {
  const groups = new Map<string, ParsedLogEntry[]>();

  for (const entry of entries) {
    if (!entry.sessionId) continue;
    const list = groups.get(entry.sessionId) ?? [];
    list.push(entry);
    groups.set(entry.sessionId, list);
  }

  const results: SessionMetrics[] = [];

  for (const [sessionId, sessionEntries] of groups) {
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheTokens = 0;
    const toolUseCounts: Record<string, number> = {};
    const toolTransitions: string[] = [];
    const editedExtSet = new Set<string>();
    const bashCmds: string[] = [];
    const userTexts: string[] = [];
    let firstTs = "";
    let lastTs = "";

    for (const entry of sessionEntries) {
      if (!firstTs || entry.timestamp < firstTs) firstTs = entry.timestamp;
      if (!lastTs || entry.timestamp > lastTs) lastTs = entry.timestamp;

      if (entry.usage) {
        inputTokens += entry.usage.inputTokens;
        outputTokens += entry.usage.outputTokens;
        cacheTokens += entry.usage.cacheCreationInputTokens + entry.usage.cacheReadInputTokens;
      }

      for (const tu of entry.toolUses) {
        toolUseCounts[tu.name] = (toolUseCounts[tu.name] ?? 0) + 1;
        const lastTool = toolTransitions[toolTransitions.length - 1];
        if (lastTool !== tu.name) {
          toolTransitions.push(tu.name);
        }
      }

      for (const fp of entry.editedFiles) {
        editedExtSet.add(extname(fp));
      }

      bashCmds.push(...entry.bashCommands);

      if (entry.type === "user" && entry.textContent) {
        userTexts.push(entry.textContent);
      }
    }

    results.push({
      sessionId,
      totalTokens: inputTokens + outputTokens + cacheTokens,
      inputTokens,
      outputTokens,
      cacheTokens,
      toolUseCounts,
      toolTransitions,
      editedExtensions: [...editedExtSet],
      bashCommands: bashCmds,
      userMessageTexts: userTexts,
      entryCount: sessionEntries.length,
      firstTimestamp: firstTs,
      lastTimestamp: lastTs,
    });
  }

  return results;
}
