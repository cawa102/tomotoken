import React from "react";
import { Box, Text } from "ink";

const TAB_NAMES = ["Gallery", "Timeline", "Stats"] as const;

interface Props {
  readonly activeTab: number;
}

export function TabBar({ activeTab }: Props) {
  return (
    <Box>
      {TAB_NAMES.map((name, i) => (
        <Text key={name}>
          {i > 0 ? "  " : ""}
          {i === activeTab ? (
            <Text bold underline>{name}</Text>
          ) : (
            <Text dimColor>{name}</Text>
          )}
        </Text>
      ))}
    </Box>
  );
}
