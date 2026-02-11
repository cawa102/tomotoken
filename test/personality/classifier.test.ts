import { describe, it, expect } from "vitest";
import { classifySession } from "../../src/personality/classifier.js";

describe("classifySession", () => {
  it("classifies debug session (edit-test loop + test commands)", () => {
    const result = classifySession({
      editedExtensions: [".ts"],
      toolTransitions: ["Read", "Edit", "Bash", "Edit", "Bash"],
      bashCommands: ["npm test", "vitest run"],
      toolUseCounts: { Read: 2, Edit: 3, Bash: 4 },
    });
    expect(result.primaryCategory).toBe("debug");
    expect(result.scores.debug).toBeGreaterThan(0);
  });

  it("classifies research session (read/grep heavy)", () => {
    const result = classifySession({
      editedExtensions: [],
      toolTransitions: ["Read", "Grep", "Read", "Grep", "Read"],
      bashCommands: [],
      toolUseCounts: { Read: 10, Grep: 8, Edit: 0, Bash: 1 },
    });
    expect(result.primaryCategory).toBe("research");
  });

  it("classifies docs session (markdown edits)", () => {
    const result = classifySession({
      editedExtensions: [".md", ".md", ".md"],
      toolTransitions: ["Read", "Edit", "Edit"],
      bashCommands: [],
      toolUseCounts: { Read: 2, Edit: 5 },
    });
    expect(result.primaryCategory).toBe("docs");
  });

  it("classifies ops session (docker/install commands)", () => {
    const result = classifySession({
      editedExtensions: [".yml", ".env"],
      toolTransitions: ["Bash", "Edit", "Bash"],
      bashCommands: ["docker compose up", "npm install express"],
      toolUseCounts: { Bash: 5, Edit: 2 },
    });
    expect(result.primaryCategory).toBe("ops");
  });

  it("normalizes scores to sum=1.0", () => {
    const result = classifySession({
      editedExtensions: [".ts"],
      toolTransitions: ["Edit", "Edit"],
      bashCommands: [],
      toolUseCounts: { Edit: 5 },
    });
    const sum = Object.values(result.scores).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });
});
