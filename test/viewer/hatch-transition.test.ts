import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub requestAnimationFrame for Node environment
vi.stubGlobal("requestAnimationFrame", vi.fn((cb) => setTimeout(cb, 0)));

// Mock DOM
const mockFlashEl = {
  style: { opacity: "0", transition: "", pointerEvents: "none" },
  offsetHeight: 0,
};
const mockLoadingEl = {
  style: { display: "none" },
  textContent: "",
};

vi.stubGlobal("document", {
  getElementById: vi.fn((id) => {
    if (id === "hatch-flash") return mockFlashEl;
    if (id === "hatch-loading") return mockLoadingEl;
    return null;
  }),
});

import { showLoading, hideLoading, playFlash, bounceIn } from "../../src/viewer/public/js/hatch-transition.js";

describe("hatch-transition", () => {
  beforeEach(() => {
    mockFlashEl.style.opacity = "0";
    mockFlashEl.style.transition = "";
    mockLoadingEl.style.display = "none";
  });

  describe("showLoading", () => {
    it("makes loading element visible", () => {
      showLoading();
      expect(mockLoadingEl.style.display).toBe("flex");
    });
  });

  describe("hideLoading", () => {
    it("hides loading element", () => {
      showLoading();
      hideLoading();
      expect(mockLoadingEl.style.display).toBe("none");
    });
  });

  describe("playFlash", () => {
    it("sets opacity to 1 for flash-in", () => {
      playFlash();
      expect(mockFlashEl.style.opacity).toBe("1");
    });
  });

  describe("bounceIn", () => {
    it("sets initial scale to 0.5", () => {
      const group = { scale: { set: vi.fn() } };
      bounceIn(group);
      expect(group.scale.set).toHaveBeenCalledWith(0.5, 0.5, 0.5);
    });

    it("does nothing when group is null", () => {
      expect(() => bounceIn(null)).not.toThrow();
    });
  });
});
