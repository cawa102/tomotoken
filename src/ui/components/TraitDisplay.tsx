import React from "react";
import { Text, Box } from "ink";
import { TRAIT_IDS } from "../../config/constants.js";

interface Props {
  traits: Record<string, number>;
  archetype: string;
  subtype: string;
}

export function TraitDisplay({ traits, archetype, subtype }: Props) {
  return (
    <Box flexDirection="column">
      <Text bold>
        {archetype.toUpperCase()} / {subtype}
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
