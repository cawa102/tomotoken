import { daysBetween } from "../utils/time.js";
import type { CalibrationInput, CalibrationResult } from "./types.js";

const MIN_T0 = 1000;

export function computeCalibration(
  input: CalibrationInput,
  g: number,
  rounding: "ceil" | "floor" | "round",
): CalibrationResult {
  const days = daysBetween(input.earliestTimestamp, input.latestTimestamp);
  const monthlyEstimate = (input.totalTokensAllTime / days) * 30;
  const denominator = 1 + g + g * g;
  const rawT0 = monthlyEstimate / denominator;

  let t0: number;
  switch (rounding) {
    case "ceil":
      t0 = Math.ceil(rawT0);
      break;
    case "floor":
      t0 = Math.floor(rawT0);
      break;
    case "round":
      t0 = Math.round(rawT0);
      break;
  }

  t0 = Math.max(MIN_T0, t0);

  return { monthlyEstimate, t0 };
}
