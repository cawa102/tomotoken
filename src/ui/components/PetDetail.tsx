import React from "react";
import { Text, Box } from "ink";
import { TraitDisplay } from "./TraitDisplay.js";
import type { CompletedPet } from "../../store/types.js";
import { useAnimation } from "../hooks/useAnimation.js";

interface Props {
  pet: CompletedPet;
  fps: number;
  animate: boolean;
}

export function PetDetail({ pet, fps, animate }: Props) {
  const frameIdx = useAnimation(pet.colorFrames.length || pet.frames.length, fps, animate);
  const frames = pet.colorFrames.length > 0 ? pet.colorFrames : pet.frames;
  const frame = frames[frameIdx] ?? [];

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>Pet: {pet.petId.slice(0, 8)}</Text>
      <Text>Spawned: {new Date(pet.spawnedAt).toLocaleString()}</Text>
      <Text>Completed: {new Date(pet.completedAt).toLocaleString()}</Text>
      <Text>Tokens: {pet.consumedTokens.toLocaleString()}</Text>
      <Text> </Text>
      {frame.map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}
      <Text> </Text>
      <TraitDisplay traits={pet.personality.traits} />
    </Box>
  );
}
