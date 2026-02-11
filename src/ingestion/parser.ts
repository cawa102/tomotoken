import type { ParsedLogEntry, TokenUsage, ToolUseEvent } from "./types.js";

const MAX_LINE_LENGTH = 1_000_000; // 1MB per line

export function parseLine(line: string): ParsedLogEntry | null {
  if (!line.trim()) return null;
  if (line.length > MAX_LINE_LENGTH) return null;

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(line);
  } catch {
    return null;
  }

  const type = raw.type as string;
  if (!type) return null;

  const validTypes = ["assistant", "user", "progress", "summary", "file-history-snapshot"];
  if (!validTypes.includes(type)) return null;

  const timestamp = (raw.timestamp as string) ?? "";
  const sessionId = (raw.sessionId as string) ?? "";
  const uuid = (raw.uuid as string) ?? "";
  const parentUuid = (raw.parentUuid as string) ?? null;

  let model: string | null = null;
  let usage: TokenUsage | null = null;
  const toolUses: ToolUseEvent[] = [];
  const editedFiles: string[] = [];
  const bashCommands: string[] = [];
  let hasToolResult = false;
  let textContent: string | null = null;

  const message = raw.message as Record<string, unknown> | undefined;

  if (type === "assistant" && message) {
    model = (message.model as string) ?? null;

    const rawUsage = message.usage as Record<string, number> | undefined;
    if (rawUsage) {
      usage = {
        inputTokens: rawUsage.input_tokens ?? 0,
        outputTokens: rawUsage.output_tokens ?? 0,
        cacheCreationInputTokens: rawUsage.cache_creation_input_tokens ?? 0,
        cacheReadInputTokens: rawUsage.cache_read_input_tokens ?? 0,
      };
    }

    const content = message.content as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === "tool_use") {
          const name = block.name as string;
          const id = block.id as string;
          toolUses.push({ name, id });

          const input = block.input as Record<string, unknown> | undefined;
          if (input) {
            if (name === "Write" || name === "Edit") {
              const fp = input.file_path as string | undefined;
              if (fp) editedFiles.push(fp);
            } else if (name === "Bash") {
              const cmd = input.command as string | undefined;
              if (cmd) bashCommands.push(cmd);
            }
          }
        } else if (block.type === "text") {
          textContent = block.text as string;
        }
      }
    }
  }

  if (type === "user") {
    hasToolResult = raw.toolUseResult === true;

    if (message) {
      const content = message.content;
      if (typeof content === "string") {
        textContent = content;
      }
    }
  }

  return {
    type: type as ParsedLogEntry["type"],
    timestamp,
    sessionId,
    uuid,
    parentUuid,
    model,
    usage,
    toolUses,
    hasToolResult,
    textContent,
    editedFiles,
    bashCommands,
  };
}
