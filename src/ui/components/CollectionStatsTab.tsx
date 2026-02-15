import React from "react";
import { Box, Text } from "ink";
import type { CollectionStatsData } from "../utils/collectionStats.js";

interface Props {
  readonly stats: CollectionStatsData;
}

export function CollectionStatsTab({ stats }: Props) {
  if (stats.totalPets === 0) {
    return <Text dimColor>No data yet. Complete your first pet!</Text>;
  }

  const maxCount = Math.max(...stats.archetypeDistribution.map((d) => d.count));

  return (
    <Box flexDirection="column">
      <Text bold>Collection Stats</Text>
      <Text dimColor>{"─".repeat(35)}</Text>
      <Text> </Text>
      <Text>Total Pets:     {stats.totalPets}</Text>
      <Text>Total Tokens:   {stats.totalTokens.toLocaleString()}</Text>
      <Text>Avg Tokens/Pet: {stats.avgTokensPerPet.toLocaleString()}</Text>
      <Text> </Text>
      {stats.firstCompletedAt && (
        <Text>First Pet:  {new Date(stats.firstCompletedAt).toLocaleDateString()}</Text>
      )}
      {stats.latestCompletedAt && (
        <Text>Latest Pet: {new Date(stats.latestCompletedAt).toLocaleDateString()}</Text>
      )}
      <Text> </Text>
      <Text bold>Archetype Distribution:</Text>
      {stats.archetypeDistribution.map(({ archetype, count }) => {
        const barLen = maxCount > 0 ? Math.round((count / maxCount) * 10) : 0;
        const bar = "\u2588".repeat(barLen) + "\u2591".repeat(10 - barLen);
        return (
          <Text key={archetype}>
            {"  "}{archetype.padEnd(10)} {bar}  {count}
          </Text>
        );
      })}
      <Text> </Text>
      {stats.mostCommonArchetype && (
        <Text>Most common: <Text bold>{stats.mostCommonArchetype}</Text> ({stats.archetypeDistribution[0]?.count})</Text>
      )}
      {stats.rarestArchetype && (
        <Text>Rarest:      <Text bold>{stats.rarestArchetype}</Text> ({stats.archetypeDistribution[stats.archetypeDistribution.length - 1]?.count})</Text>
      )}
    </Box>
  );
}
