import React from "react";
import { Text, Box } from "ink";
import { TRAIT_IDS } from "../../config/constants.js";

interface Props {
  traits: Record<string, number>;
}

export function TraitDisplay({ traits }: Props) {
  // Find top two traits for display
  const sorted = [...TRAIT_IDS].sort((a, b) => (traits[b] ?? 0) - (traits[a] ?? 0));
  const primary = sorted[0];
  const secondary = sorted[1];

  return (
    <Box flexDirection="column">
      <Text bold>
        {primary.toUpperCase()} / {secondary}
      </Text>
      {TRAIT_IDS.map((id) => {
        const score = traits[id] ?? 0;
        const barLen = Math.round(score / 5); // max 20 chars
        const bar = "\u2588".repeat(barLen);
        return (
          <Text key={id}>
            {id.padEnd(10)} {bar} {score}
          </Text>
        );
      })}
    </Box>
  );
}
