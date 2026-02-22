import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EggWobbleController } from "../../src/viewer/public/js/egg-wobble.js";

describe("EggWobbleController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("constructs with initial progress", () => {
    const group = { rotation: { z: 0 } };
    const ctrl = new EggWobbleController(group, 0.1);
    expect(ctrl).toBeDefined();
    ctrl.dispose();
  });

  it("does not wobble immediately after construction", () => {
    const group = { rotation: { z: 0 } };
    const ctrl = new EggWobbleController(group, 0.5);
    expect(group.rotation.z).toBe(0);
    ctrl.dispose();
  });

  describe("getNextDelay", () => {
    it("returns longer delays for low progress", () => {
      const group = { rotation: { z: 0 } };
      const ctrl = new EggWobbleController(group, 0.0);
      const delay = ctrl.getNextDelay();
      // At 0% progress: delay should be between 30s and 60s
      expect(delay).toBeGreaterThanOrEqual(30000);
      expect(delay).toBeLessThanOrEqual(60000);
      ctrl.dispose();
    });

    it("returns shorter delays for high progress", () => {
      const group = { rotation: { z: 0 } };
      const ctrl = new EggWobbleController(group, 0.99);
      const delay = ctrl.getNextDelay();
      // At ~100% progress: delay should be between 3s and 8s
      expect(delay).toBeGreaterThanOrEqual(3000);
      expect(delay).toBeLessThanOrEqual(8000);
      ctrl.dispose();
    });
  });

  describe("wobble amplitude", () => {
    it("increases amplitude with progress", () => {
      const ctrl0 = new EggWobbleController({ rotation: { z: 0 } }, 0.0);
      const ctrl99 = new EggWobbleController({ rotation: { z: 0 } }, 0.99);

      expect(ctrl99.getAmplitude()).toBeGreaterThan(ctrl0.getAmplitude());

      ctrl0.dispose();
      ctrl99.dispose();
    });
  });

  it("cleans up timer on dispose", () => {
    const group = { rotation: { z: 0 } };
    const ctrl = new EggWobbleController(group, 0.5);
    ctrl.dispose();
    // After dispose, advancing timers should not cause wobble
    vi.advanceTimersByTime(120000);
    expect(group.rotation.z).toBe(0);
  });
});
