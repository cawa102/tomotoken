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

export function PetView({ state, config }: Props) {
  const pet = state.currentPet;
  const progress = pet.requiredTokens > 0 ? pet.consumedTokens / pet.requiredTokens : 0;
  const personality = pet.personalitySnapshot;
  const archetype = personality?.archetype ?? "builder";
  const subtype = personality?.subtype ?? "scholar";
  const traits = personality?.traits ?? {};

  const seed = generateSeed(hostname(), pet.petId);
  const art = useMemo(
    () => renderArt({
      seed,
      progress,
      archetype,
      subtype,
      traits,
      canvasWidth: config.canvas.width,
      canvasHeight: config.canvas.height,
    }),
    [seed, progress, archetype, subtype, config.canvas.width, config.canvas.height],
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
      {personality && <TraitDisplay traits={traits} archetype={archetype} subtype={subtype} />}
    </Box>
  );
}
