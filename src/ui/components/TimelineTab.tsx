import React from "react";
import { Box, Text } from "ink";
import { getTopTrait } from "../utils/collectionStats.js";
import type { CompletedPet } from "../../store/types.js";

interface Props {
  readonly pets: readonly CompletedPet[];
}

export function TimelineTab({ pets }: Props) {
  if (pets.length === 0) {
    return <Text dimColor>No completed pets yet. Keep coding!</Text>;
  }

  const sorted = [...pets].sort((a, b) => a.completedAt.localeCompare(b.completedAt));

  return (
    <Box flexDirection="column">
      <Text bold>Timeline ({pets.length} pets)</Text>
      <Text dimColor>{"─".repeat(35)}</Text>
      <Text> </Text>
      {sorted.map((pet, i) => {
        const spawnDate = new Date(pet.spawnedAt).toLocaleDateString();
        const completeDate = new Date(pet.completedAt).toLocaleDateString();
        const archetype = getTopTrait(pet.personality.traits);
        return (
          <Text key={pet.petId}>
            #{String(i + 1).padStart(2)}  {spawnDate} → {completeDate}  {archetype.padEnd(10)}  {pet.consumedTokens.toLocaleString()} tokens
          </Text>
        );
      })}
    </Box>
  );
}
