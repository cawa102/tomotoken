import React from "react";
import { Box, Text } from "ink";
import { useTabNavigation } from "./hooks/useTabNavigation.js";
import { computeCollectionStats } from "./utils/collectionStats.js";
import { TabBar } from "./components/TabBar.js";
import { HelpBar } from "./components/HelpBar.js";
import { GalleryTab } from "./components/GalleryTab.js";
import { TimelineTab } from "./components/TimelineTab.js";
import { CollectionStatsTab } from "./components/CollectionStatsTab.js";
import type { Collection } from "../store/types.js";
import type { Config } from "../config/schema.js";

interface Props {
  readonly collection: Collection;
  readonly config: Config;
  readonly onExit: () => void;
}

export function ZukanApp({ collection, config, onExit }: Props) {
  const { activeTab, galleryIndex } = useTabNavigation(collection.pets.length, onExit);
  const stats = computeCollectionStats(collection);
  const pet = collection.pets[galleryIndex] ?? null;

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold dimColor>tomotoken zukan</Text>
      <Text> </Text>
      <TabBar activeTab={activeTab} />
      <Text> </Text>
      {activeTab === 0 && (
        pet ? (
          <GalleryTab
            pet={pet}
            index={galleryIndex}
            total={collection.pets.length}
            fps={config.animation.fps}
            animate={config.animation.enabled}
          />
        ) : (
          <Text dimColor>No completed pets yet. Keep coding!</Text>
        )
      )}
      {activeTab === 1 && <TimelineTab pets={collection.pets} />}
      {activeTab === 2 && <CollectionStatsTab stats={stats} />}
      <Text> </Text>
      <HelpBar activeTab={activeTab} />
    </Box>
  );
}
