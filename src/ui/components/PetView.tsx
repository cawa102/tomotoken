import React from "react";
import { Text, Box } from "ink";
import { ProgressBar } from "./ProgressBar.js";
import { TraitDisplay } from "./TraitDisplay.js";
import type { AppState } from "../../store/types.js";
import type { Config } from "../../config/schema.js";
import { computeEggStage } from "../../progression/stages.js";

interface Props {
  state: AppState;
  config: Config;
}

const STAGE_NAMES = ["Egg", "Cracking", "Hatching Soon", "Almost There", "Hatched!"];

export function PetView({ state, config }: Props) {
  const pet = state.currentPet;
  const progress = pet.requiredTokens > 0 ? pet.consumedTokens / pet.requiredTokens : 0;
  const personality = pet.personalitySnapshot;
  const traits = personality?.traits ?? {};
  const stage = computeEggStage(progress);
  const stageName = STAGE_NAMES[stage] ?? `Stage ${stage}`;

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold dimColor>tomotoken</Text>
      <Text> </Text>
      <Text>Stage: {stageName}</Text>
      <Text dimColor>View your pet in 3D: npm run dev:viewer</Text>
      <Text> </Text>
      <ProgressBar consumed={pet.consumedTokens} required={pet.requiredTokens} />
      <Text> </Text>
      {personality && <TraitDisplay traits={traits} />}
    </Box>
  );
}
