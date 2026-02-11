import React from "react";
import { Box, Text } from "ink";
import type { AppState, Collection } from "../store/types.js";
import type { Config } from "../config/schema.js";
import { PetView } from "./components/PetView.js";
import { StatsPanel } from "./components/StatsPanel.js";
import { CollectionList } from "./components/CollectionList.js";
import { PetDetail } from "./components/PetDetail.js";

interface Props {
  command: "show" | "stats" | "collection" | "view" | "config";
  state: AppState;
  config: Config;
  collection: Collection;
  viewPetId?: string;
}

export function App({ command, state, config, collection, viewPetId }: Props) {
  switch (command) {
    case "show":
      return <PetView state={state} config={config} />;
    case "stats":
      return <StatsPanel state={state} />;
    case "collection":
      return <CollectionList collection={collection} />;
    case "view": {
      const pet = collection.pets.find((p) => p.petId.startsWith(viewPetId ?? ""));
      if (!pet) return <Box><Text>Pet not found: {viewPetId}</Text></Box>;
      return <PetDetail pet={pet} fps={config.animation.fps} animate={config.animation.enabled} />;
    }
    case "config":
      return <Box flexDirection="column" paddingX={1}><Text>{JSON.stringify(config, null, 2)}</Text></Box>;
    default:
      return <PetView state={state} config={config} />;
  }
}
