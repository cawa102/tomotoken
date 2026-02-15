import React from "react";
import { Box, Text, useInput } from "ink";
import { useWatcher } from "./hooks/useWatcher.js";
import { PetView } from "./components/PetView.js";
import type { AppState, Collection } from "../store/types.js";
import type { Config } from "../config/schema.js";

interface Props {
  config: Config;
  initialState: AppState;
  initialCollection: Collection;
  onExit: () => void;
}

export function WatchApp({ config, initialState, initialCollection, onExit }: Props) {
  const { state, collection, newlyCompleted, updateCount } = useWatcher(config, initialState, initialCollection);

  useInput((_input, key) => {
    if (key.escape || (key.ctrl && _input === "c")) {
      onExit();
    }
  });

  const latestCompleted = newlyCompleted.length > 0 ? newlyCompleted[newlyCompleted.length - 1] : null;

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold dimColor>tomotoken watch</Text>
      <Text dimColor>Watching for token usage... (Ctrl+C to exit)</Text>
      <Text> </Text>
      <PetView state={state} config={config} />
      <Text> </Text>
      {latestCompleted && (
        <Box flexDirection="column">
          <Text bold color="green">Pet completed!</Text>
          <Text dimColor>New pet spawned.</Text>
          <Text> </Text>
        </Box>
      )}
      <Text dimColor>Collection: {collection.pets.length} pets | Updates: {updateCount}</Text>
    </Box>
  );
}
