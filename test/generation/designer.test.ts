import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateCreatureDesign } from "../../src/generation/designer.js";
import type { DepthMetrics, StyleMetrics } from "../../src/store/types.js";

// Mock the Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
    __mockCreate: mockCreate,
  };
});

describe("generateCreatureDesign", () => {
  const traits: Record<string, number> = {
    builder: 50, fixer: 30, refiner: 20, scholar: 40,
    scribe: 10, architect: 60, operator: 25, guardian: 35,
  };
  const depth: DepthMetrics = {
    editTestLoopCount: 5, repeatEditSameFileCount: 2,
    phaseSwitchCount: 3, totalSessions: 10,
  };
  const style: StyleMetrics = {
    bulletRatio: 0.3, questionRatio: 0.1, codeblockRatio: 0.4,
    avgMessageLen: 120, messageLenStd: 40, headingRatio: 0.2,
  };

  const validResponse = {
    parts: [{
      name: "body",
      primitive: "sphere",
      position: [0, 0.5, 0],
      rotation: [0, 0, 0],
      scale: [0.5, 0.6, 0.4],
      color: "#ff8844",
      material: { roughness: 0.7, metalness: 0.05, flatShading: true },
    }],
    expressions: {
      default: { eyes: { shape: "round" }, mouth: { shape: "smile" } },
    },
    personality: { name: "Patches", quirk: "always curious" },
  };

  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const mod = await import("@anthropic-ai/sdk");
    mockCreate = (mod as any).__mockCreate;
    mockCreate.mockReset();
  });

  it("returns parsed CreatureDesign on valid API response", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(validResponse) }],
    });

    const result = await generateCreatureDesign({
      archetype: "architect", subtype: "builder",
      traits, depth, style, stage: 2, previousParts: null,
      apiKey: "test-key",
    });

    expect(result.parts).toHaveLength(1);
    expect(result.parts[0].name).toBe("body");
    expect(result.personality.name).toBe("Patches");
  });

  it("throws on invalid JSON from API", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "not valid json" }],
    });

    await expect(generateCreatureDesign({
      archetype: "builder", subtype: "fixer",
      traits, depth, style, stage: 1, previousParts: null,
      apiKey: "test-key",
    })).rejects.toThrow();
  });

  it("throws on schema validation failure", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ parts: [], expressions: {} }) }],
    });

    await expect(generateCreatureDesign({
      archetype: "builder", subtype: "fixer",
      traits, depth, style, stage: 1, previousParts: null,
      apiKey: "test-key",
    })).rejects.toThrow();
  });

  it("uses claude-sonnet-4-6 model", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(validResponse) }],
    });

    await generateCreatureDesign({
      archetype: "builder", subtype: "fixer",
      traits, depth, style, stage: 1, previousParts: null,
      apiKey: "test-key",
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-sonnet-4-6" }),
    );
  });

  it("extracts JSON from markdown code block if present", async () => {
    const wrapped = "```json\n" + JSON.stringify(validResponse) + "\n```";
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: wrapped }],
    });

    const result = await generateCreatureDesign({
      archetype: "builder", subtype: "fixer",
      traits, depth, style, stage: 1, previousParts: null,
      apiKey: "test-key",
    });

    expect(result.parts).toHaveLength(1);
  });
});
