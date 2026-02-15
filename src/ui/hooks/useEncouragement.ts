import { useState, useEffect, useRef } from "react";
import { shouldTrigger, selectMessage } from "../../encouragement/trigger.js";
import { tokensInWindow } from "../../encouragement/rate.js";
import type { TokenEvent } from "../../encouragement/rate.js";
import { saveState, updateEncouragementTimestamp } from "../../store/index.js";
import { createPrng } from "../../utils/hash.js";
import type { AppState } from "../../store/types.js";
import type { Config } from "../../config/schema.js";

const DISPLAY_DURATION_MS = 30_000;
const WINDOW_MINUTES = 60;

export interface EncouragementState {
  readonly message: string | null;
  readonly visible: boolean;
}

export function shouldTriggerEncouragement(
  config: Config,
  state: AppState,
  events: readonly TokenEvent[],
): boolean {
  if (!config.encouragement.enabled) return false;
  const tokensLastHour = tokensInWindow(events, WINDOW_MINUTES, new Date());
  return shouldTrigger(
    tokensLastHour,
    config.encouragement.tokensPerHourThreshold,
    state.lastEncouragementShownAt,
    config.encouragement.cooldownHours,
  );
}

export function computeEncouragementState(
  config: Config,
  state: AppState,
  events: readonly TokenEvent[],
): EncouragementState {
  if (!shouldTriggerEncouragement(config, state, events)) {
    return { message: null, visible: false };
  }
  const prng = createPrng(
    (state.currentPet.petId + Date.now().toString(16)).padEnd(64, "0").slice(0, 64),
  );
  return { message: selectMessage(prng), visible: true };
}

export function useEncouragement(
  config: Config,
  state: AppState,
  updateCount: number,
): EncouragementState {
  const [display, setDisplay] = useState<EncouragementState>({ message: null, visible: false });
  const eventsRef = useRef<TokenEvent[]>([]);
  const prevTokensRef = useRef(state.currentPet.consumedTokens);

  useEffect(() => {
    if (updateCount === 0) return;

    const currentTokens = state.currentPet.consumedTokens;
    const delta = currentTokens - prevTokensRef.current;
    prevTokensRef.current = currentTokens;

    if (delta > 0) {
      const now = new Date();
      eventsRef.current = [
        ...eventsRef.current.filter(
          (e) => now.getTime() - new Date(e.timestamp).getTime() < WINDOW_MINUTES * 60 * 1000,
        ),
        { tokens: delta, timestamp: now.toISOString() },
      ];
    }

    const result = computeEncouragementState(config, state, eventsRef.current);
    if (result.visible) {
      setDisplay(result);
      saveState(updateEncouragementTimestamp(state, new Date().toISOString()));
    }
  }, [updateCount, config, state]);

  // Auto-hide timer
  useEffect(() => {
    if (!display.visible) return;
    const timer = setTimeout(() => setDisplay({ message: null, visible: false }), DISPLAY_DURATION_MS);
    return () => clearTimeout(timer);
  }, [display.visible]);

  return display;
}
