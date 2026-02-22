import React from "react";
import { Text, Box } from "ink";
import type { AppState } from "../../store/types.js";

interface Props {
  state: AppState;
}

export function StatsPanel({ state }: Props) {
  const gs = state.globalStats;
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>Token Statistics</Text>
      <Text>Total (all time): {gs.totalTokensAllTime.toLocaleString()}</Text>
      <Text>Sessions ingested: {gs.totalSessionsIngested}</Text>
      <Text>First log: {gs.earliestTimestamp ?? "none"}</Text>
      <Text>Latest log: {gs.latestTimestamp ?? "none"}</Text>
    </Box>
  );
}
