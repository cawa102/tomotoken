import { describe, it, expect } from "vitest";
import { computeStyleMetrics } from "../../src/personality/style.js";

describe("computeStyleMetrics", () => {
  it("returns zeros for empty input", () => {
    const result = computeStyleMetrics([]);
    expect(result).toEqual({
      bulletRatio: 0,
      questionRatio: 0,
      codeblockRatio: 0,
      avgMessageLen: 0,
      messageLenStd: 0,
      headingRatio: 0,
    });
  });

  it("calculates bulletRatio from bullet lines", () => {
    const messages = ["- item 1\n- item 2\nnormal line"];
    const result = computeStyleMetrics(messages);
    expect(result.bulletRatio).toBeCloseTo(2 / 3);
  });

  it("detects numbered list bullets", () => {
    const messages = ["1. first\n2) second\nplain"];
    const result = computeStyleMetrics(messages);
    expect(result.bulletRatio).toBeCloseTo(2 / 3);
  });

  it("detects asterisk bullets", () => {
    const messages = ["* item"];
    const result = computeStyleMetrics(messages);
    expect(result.bulletRatio).toBe(1);
  });

  it("calculates headingRatio from markdown headings", () => {
    const messages = ["# Title\n## Subtitle\nBody text"];
    const result = computeStyleMetrics(messages);
    expect(result.headingRatio).toBeCloseTo(2 / 3);
  });

  it("calculates questionRatio from question marks", () => {
    const messages = ["What? Why?"];
    const result = computeStyleMetrics(messages);
    expect(result.questionRatio).toBeCloseTo(2 / 10);
  });

  it("calculates codeblockRatio from triple backticks", () => {
    const messages = ["```js\ncode\n```", "no code here"];
    const result = computeStyleMetrics(messages);
    // 2 occurrences of ``` in first message, 0 in second, total 2 / 2 messages
    expect(result.codeblockRatio).toBe(1);
  });

  it("calculates avgMessageLen", () => {
    const messages = ["hello", "hi"]; // 5 + 2 = 7, avg = 3.5
    const result = computeStyleMetrics(messages);
    expect(result.avgMessageLen).toBeCloseTo(3.5);
  });

  it("calculates messageLenStd", () => {
    const messages = ["hello", "hi"]; // lengths 5, 2; avg 3.5
    const result = computeStyleMetrics(messages);
    // variance = ((5-3.5)^2 + (2-3.5)^2) / 2 = (2.25 + 2.25) / 2 = 2.25
    expect(result.messageLenStd).toBeCloseTo(Math.sqrt(2.25));
  });

  it("handles single message correctly", () => {
    const messages = ["test message"];
    const result = computeStyleMetrics(messages);
    expect(result.avgMessageLen).toBe(12);
    expect(result.messageLenStd).toBe(0);
  });
});
