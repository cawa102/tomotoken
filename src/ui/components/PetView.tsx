import React, { useMemo } from "react";
import { Text, Box } from "ink";
import { useAnimation } from "../hooks/useAnimation.js";
import { ProgressBar } from "./ProgressBar.js";
import { TraitDisplay } from "./TraitDisplay.js";
import type { AppState } from "../../store/types.js";
import type { Config } from "../../config/schema.js";
import { renderArt, generateSeed } from "../../art/index.js";
import { hostname } from "node:os";

interface Props {
  state: AppState;
  config: Config;
}

const EMPTY_DEPTH = { editTestLoopCount: 0, repeatEditSameFileCount: 0, phaseSwitchCount: 0, totalSessions: 0 };
const EMPTY_STYLE = { bulletRatio: 0, questionRatio: 0, codeblockRatio: 0, avgMessageLen: 0, messageLenStd: 0, headingRatio: 0 };

export function PetView({ state, config }: Props) {
  const pet = state.currentPet;
  const progress = pet.requiredTokens > 0 ? pet.consumedTokens / pet.requiredTokens : 0;
  const personality = pet.personalitySnapshot;
  const traits = personality?.traits ?? {};
  const depthMetrics = personality?.depthMetrics ?? EMPTY_DEPTH;
  const styleMetrics = personality?.styleMetrics ?? EMPTY_STYLE;

  const seed = generateSeed(hostname(), pet.petId);
  const art = useMemo(
    () => renderArt({
      seed,
      progress,
      traits,
      depthMetrics,
      styleMetrics,
      canvasWidth: config.canvas.width,
      canvasHeight: config.canvas.height,
    }),
    [seed, progress, config.canvas.width, config.canvas.height],
  );

  const frameIdx = useAnimation(art.colorFrames.length, config.animation.fps, config.animation.enabled);
  const currentFrame = art.colorFrames[frameIdx] ?? art.frames[frameIdx] ?? [];

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold dimColor>tomotoken</Text>
      <Text> </Text>
      {currentFrame.map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}
      <Text> </Text>
      <ProgressBar consumed={pet.consumedTokens} required={pet.requiredTokens} />
      <Text> </Text>
      {personality && <TraitDisplay traits={traits} />}
    </Box>
  );
}
