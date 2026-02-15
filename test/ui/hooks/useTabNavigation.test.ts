import { describe, it, expect } from "vitest";
import { tabNavigationReducer, type TabNavigationState } from "../../../src/ui/hooks/useTabNavigation.js";

function makeState(overrides: Partial<TabNavigationState> = {}): TabNavigationState {
  return { activeTab: 0, galleryIndex: 0, ...overrides };
}

function key(opts: { tab?: boolean; leftArrow?: boolean; rightArrow?: boolean; escape?: boolean } = {}) {
  return {
    tab: opts.tab ?? false,
    leftArrow: opts.leftArrow ?? false,
    rightArrow: opts.rightArrow ?? false,
    escape: opts.escape ?? false,
  };
}

describe("tabNavigationReducer", () => {
  it("cycles tabs on Tab press: 0 -> 1 -> 2 -> 0", () => {
    let state = makeState({ activeTab: 0 });
    state = tabNavigationReducer(state, { input: "", key: key({ tab: true }) }, 5) as TabNavigationState;
    expect(state.activeTab).toBe(1);
    state = tabNavigationReducer(state, { input: "", key: key({ tab: true }) }, 5) as TabNavigationState;
    expect(state.activeTab).toBe(2);
    state = tabNavigationReducer(state, { input: "", key: key({ tab: true }) }, 5) as TabNavigationState;
    expect(state.activeTab).toBe(0);
  });

  it("decrements galleryIndex on left arrow (Gallery tab only)", () => {
    const state = makeState({ activeTab: 0, galleryIndex: 3 });
    const next = tabNavigationReducer(state, { input: "", key: key({ leftArrow: true }) }, 5) as TabNavigationState;
    expect(next.galleryIndex).toBe(2);
  });

  it("increments galleryIndex on right arrow (Gallery tab only)", () => {
    const state = makeState({ activeTab: 0, galleryIndex: 2 });
    const next = tabNavigationReducer(state, { input: "", key: key({ rightArrow: true }) }, 5) as TabNavigationState;
    expect(next.galleryIndex).toBe(3);
  });

  it("clamps galleryIndex to 0 on left at beginning", () => {
    const state = makeState({ activeTab: 0, galleryIndex: 0 });
    const next = tabNavigationReducer(state, { input: "", key: key({ leftArrow: true }) }, 5) as TabNavigationState;
    expect(next.galleryIndex).toBe(0);
  });

  it("clamps galleryIndex to totalPets-1 on right at end", () => {
    const state = makeState({ activeTab: 0, galleryIndex: 4 });
    const next = tabNavigationReducer(state, { input: "", key: key({ rightArrow: true }) }, 5) as TabNavigationState;
    expect(next.galleryIndex).toBe(4);
  });

  it("ignores arrow keys on non-Gallery tabs", () => {
    const state = makeState({ activeTab: 1, galleryIndex: 2 });
    const next = tabNavigationReducer(state, { input: "", key: key({ rightArrow: true }) }, 5) as TabNavigationState;
    expect(next.galleryIndex).toBe(2);
  });

  it("returns 'exit' on q key", () => {
    const state = makeState();
    const result = tabNavigationReducer(state, { input: "q", key: key() }, 5);
    expect(result).toBe("exit");
  });

  it("returns 'exit' on Escape key", () => {
    const state = makeState();
    const result = tabNavigationReducer(state, { input: "", key: key({ escape: true }) }, 5);
    expect(result).toBe("exit");
  });

  it("returns unchanged state on unrecognized key", () => {
    const state = makeState({ activeTab: 1, galleryIndex: 3 });
    const next = tabNavigationReducer(state, { input: "x", key: key() }, 5);
    expect(next).toEqual(state);
  });

  it("handles totalPets=0 gracefully", () => {
    const state = makeState({ activeTab: 0, galleryIndex: 0 });
    const next = tabNavigationReducer(state, { input: "", key: key({ rightArrow: true }) }, 0) as TabNavigationState;
    expect(next.galleryIndex).toBe(0);
  });

  it("does not mutate input state", () => {
    const state = makeState({ activeTab: 0, galleryIndex: 2 });
    const frozen = Object.freeze({ ...state });
    const next = tabNavigationReducer(frozen, { input: "", key: key({ rightArrow: true }) }, 5);
    expect(next).not.toBe(frozen);
  });
});
