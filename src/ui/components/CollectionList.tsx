import React from "react";
import { Text, Box } from "ink";
import { getTopTrait } from "../utils/collectionStats.js";
import type { Collection } from "../../store/types.js";

interface Props {
  readonly collection: Collection;
}

export function CollectionList({ collection }: Props) {
  if (collection.pets.length === 0) {
    return <Text dimColor>No completed pets yet. Keep coding!</Text>;
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>Pet Collection ({collection.pets.length})</Text>
      <Text> </Text>
      {collection.pets.map((pet, i) => (
        <Text key={pet.petId}>
          #{i + 1} {pet.petId.slice(0, 8)} | {getTopTrait(pet.personality.traits)} | {pet.consumedTokens.toLocaleString()} tokens | {new Date(pet.completedAt).toLocaleDateString()}
        </Text>
      ))}
    </Box>
  );
}
