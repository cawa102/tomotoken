import React from "react";
import { Box, Text } from "ink";
import { TraitDisplay } from "./TraitDisplay.js";
import { useAnimation } from "../hooks/useAnimation.js";
import { getTopTrait } from "../utils/collectionStats.js";
import type { CompletedPet } from "../../store/types.js";

interface Props {
  readonly pet: CompletedPet;
  readonly index: number;
  readonly total: number;
  readonly fps: number;
  readonly animate: boolean;
}

export function GalleryTab({ pet, index, total, fps, animate }: Props) {
  const frameIdx = useAnimation(pet.colorFrames.length || pet.frames.length, fps, animate);
  const frames = pet.colorFrames.length > 0 ? pet.colorFrames : pet.frames;
  const frame = frames[frameIdx] ?? [];
  const archetype = getTopTrait(pet.personality.traits);

  return (
    <Box flexDirection="column">
      <Text bold>Pet {index + 1}/{total}  [{pet.petId.slice(0, 8)}]</Text>
      <Text dimColor>{"─".repeat(35)}</Text>
      <Text> </Text>
      {frame.map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}
      <Text> </Text>
      <Text>Archetype: <Text bold>{archetype.toUpperCase()}</Text></Text>
      <Text>Spawned:   {new Date(pet.spawnedAt).toLocaleDateString()}</Text>
      <Text>Completed: {new Date(pet.completedAt).toLocaleDateString()}</Text>
      <Text>Tokens:    {pet.consumedTokens.toLocaleString()}</Text>
      <Text> </Text>
      <TraitDisplay traits={pet.personality.traits} />
    </Box>
  );
}
