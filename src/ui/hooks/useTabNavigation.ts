import { useState } from "react";
import { useInput } from "ink";

export interface TabNavigationState {
  readonly activeTab: number;
  readonly galleryIndex: number;
}

export interface NavigationAction {
  readonly input: string;
  readonly key: {
    readonly tab: boolean;
    readonly leftArrow: boolean;
    readonly rightArrow: boolean;
    readonly escape: boolean;
  };
}

const TAB_COUNT = 3;

export function tabNavigationReducer(
  state: TabNavigationState,
  action: NavigationAction,
  totalPets: number,
): TabNavigationState | "exit" {
  const { input, key } = action;

  if (input === "q" || key.escape) {
    return "exit";
  }

  if (key.tab) {
    return { ...state, activeTab: (state.activeTab + 1) % TAB_COUNT };
  }

  if (state.activeTab === 0 && totalPets > 0) {
    if (key.leftArrow) {
      return { ...state, galleryIndex: Math.max(0, state.galleryIndex - 1) };
    }
    if (key.rightArrow) {
      return { ...state, galleryIndex: Math.min(totalPets - 1, state.galleryIndex + 1) };
    }
  }

  return state;
}

export function useTabNavigation(totalPets: number, onExit: () => void): TabNavigationState {
  const [state, setState] = useState<TabNavigationState>({ activeTab: 0, galleryIndex: 0 });

  useInput((input, key) => {
    const result = tabNavigationReducer(state, { input, key }, totalPets);
    if (result === "exit") {
      onExit();
    } else {
      setState(result);
    }
  });

  return state;
}
