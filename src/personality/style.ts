import type { StyleMetrics } from "../store/types.js";

export function computeStyleMetrics(messageTexts: readonly string[]): StyleMetrics {
  if (messageTexts.length === 0) {
    return { bulletRatio: 0, questionRatio: 0, codeblockRatio: 0, avgMessageLen: 0, messageLenStd: 0, headingRatio: 0 };
  }

  let totalLines = 0;
  let bulletLines = 0;
  let headingLines = 0;
  let questionCount = 0;
  let codeblockCount = 0;
  let totalChars = 0;
  const lengths: number[] = [];

  for (const text of messageTexts) {
    const lines = text.split("\n");
    totalLines += lines.length;
    lengths.push(text.length);
    totalChars += text.length;

    for (const line of lines) {
      const trimmed = line.trimStart();
      if (/^[-*]\s/.test(trimmed) || /^\d+[.)]\s/.test(trimmed)) bulletLines++;
      if (/^#{1,6}\s/.test(trimmed)) headingLines++;
    }

    questionCount += (text.match(/\?/g) ?? []).length;
    codeblockCount += (text.match(/```/g) ?? []).length;
  }

  const avgLen = totalChars / messageTexts.length;
  const variance = lengths.reduce((sum, l) => sum + (l - avgLen) ** 2, 0) / messageTexts.length;

  return {
    bulletRatio: totalLines > 0 ? bulletLines / totalLines : 0,
    questionRatio: totalChars > 0 ? questionCount / totalChars : 0,
    codeblockRatio: messageTexts.length > 0 ? codeblockCount / messageTexts.length : 0,
    avgMessageLen: avgLen,
    messageLenStd: Math.sqrt(variance),
    headingRatio: totalLines > 0 ? headingLines / totalLines : 0,
  };
}
