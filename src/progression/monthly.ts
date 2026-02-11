import { currentMonthString } from "../utils/time.js";
import type { AppState } from "../store/types.js";

export function detectMonthChange(currentMonth: string, now: Date = new Date()): boolean {
  return currentMonthString(now) !== currentMonth;
}

export function handleMonthChange(state: AppState, now: Date = new Date()): AppState {
  return {
    ...state,
    spawnIndexCurrentMonth: 0,
    currentMonth: currentMonthString(now),
  };
}
