#!/usr/bin/env node
import { Command } from "commander";
import { resolve } from "node:path";
import React from "react";
import { render } from "ink";
import { App } from "../src/ui/app.js";
import { WatchApp } from "../src/ui/WatchApp.js";
import { ZukanApp } from "../src/ui/ZukanApp.js";
import { runFull, runCalibration, runIngestion, runProgression, runPersonality } from "../src/index.js";
import { loadState, saveState, saveCollection, createInitialState, addCompletedPet, acquireLock, releaseLock } from "../src/store/index.js";
import { loadConfig, ensureDataDir } from "../src/config/index.js";
import { loadCollection } from "../src/store/index.js";
import { spawnWindow } from "../src/window/index.js";

const program = new Command();

program
  .name("tomotoken")
  .description("Visualize your Claude Code usage as a growing pet")
  .version("0.1.0");

program
  .command("show", { isDefault: true })
  .description("Show current pet with progress and traits")
  .action(async () => {
    const { state, collection } = await runFull();
    const config = loadConfig();
    render(React.createElement(App, { command: "show", state, config, collection }));
  });

program
  .command("stats")
  .description("Show token usage statistics")
  .action(async () => {
    const { state, collection } = await runFull();
    const config = loadConfig();
    render(React.createElement(App, { command: "stats", state, config, collection }));
  });

program
  .command("collection")
  .description("List completed pets")
  .action(async () => {
    const { state, collection } = await runFull();
    const config = loadConfig();
    render(React.createElement(App, { command: "collection", state, config, collection }));
  });

program
  .command("view <petId>")
  .description("View a completed pet in detail")
  .action(async (petId: string) => {
    const { state, collection } = await runFull();
    const config = loadConfig();
    render(React.createElement(App, { command: "view", state, config, collection, viewPetId: petId }));
  });

program
  .command("config")
  .description("Show current configuration")
  .action(async () => {
    const { state, collection } = await runFull();
    const config = loadConfig();
    render(React.createElement(App, { command: "config", state, config, collection }));
  });

program
  .command("recalibrate")
  .description("Recompute T0 from current log data")
  .action(() => {
    const config = loadConfig();
    ensureDataDir();
    let state = loadState() ?? createInitialState(10_000);
    const { state: postIngest } = runIngestion(config, state);
    state = runCalibration(postIngest, config);
    saveState(state);
    console.log(`Recalibrated. T0=${state.calibration?.t0}, Monthly estimate=${state.calibration?.monthlyEstimate}`);
  });

program
  .command("rescan")
  .description("Force re-ingest all logs from scratch")
  .action(async () => {
    const config = loadConfig();
    ensureDataDir();
    const state = createInitialState(10_000); // Reset all ingestion offsets
    saveState(state);
    const { state: result } = await runFull(config);
    console.log(`Rescan complete. ${result.globalStats.totalTokensAllTime.toLocaleString()} total tokens.`);
  });

program
  .command("zukan")
  .description("Interactive encyclopedia of completed pets")
  .action(async () => {
    const { state: _state, collection } = await runFull();
    const config = loadConfig();
    const { unmount } = render(
      React.createElement(ZukanApp, {
        collection,
        config,
        onExit: () => {
          unmount();
          process.exit(0);
        },
      }),
    );
  });

program
  .command("watch")
  .description("Live mode: watch for log changes and update pet")
  .option("--no-animate", "Disable animation")
  .action(async (opts: { animate: boolean }) => {
    const config = loadConfig();
    const watchConfig = opts.animate === false
      ? { ...config, animation: { ...config.animation, enabled: false } }
      : config;
    ensureDataDir();

    // Acquire lock for initial pipeline, then release so other commands can run
    if (!acquireLock()) {
      console.error("Another tomotoken process is running. If this is stale, delete ~/.tomotoken/tomotoken.lock");
      process.exit(1);
    }

    // Run full initial pipeline: ingest → calibrate → personality → progression
    let state = loadState() ?? createInitialState(10_000);
    let collection = loadCollection();

    const { state: postIngest, sessionMetrics } = runIngestion(watchConfig, state);
    state = postIngest;
    if (!state.calibration) {
      state = runCalibration(state, watchConfig);
    }
    state = runPersonality(state, sessionMetrics);
    const newTokens = sessionMetrics.reduce((sum, m) => sum + m.totalTokens, 0);
    const { state: postProgress, completed } = runProgression(state, newTokens, watchConfig);
    state = postProgress;
    for (const pet of completed) {
      collection = addCompletedPet(collection, pet);
    }

    saveState(state);
    saveCollection(collection);

    // Release lock so other tomotoken commands (show, stats) can run concurrently
    releaseLock();

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
    };

    process.on("exit", cleanup);
    process.on("SIGINT", () => {
      cleanup();
      process.exit(0);
    });
    process.on("SIGTERM", () => {
      cleanup();
      process.exit(0);
    });

    const { unmount } = render(
      React.createElement(WatchApp, {
        config: watchConfig,
        initialState: state,
        initialCollection: collection,
        onExit: () => {
          unmount();
          cleanup();
          process.exit(0);
        },
      }),
    );
  });

program
  .command("window")
  .description("Open pet in a new terminal window (live watch mode)")
  .option("--no-animate", "Disable animation in the new window")
  .action((opts: { animate: boolean }) => {
    const extraArgs = opts.animate === false ? ["--no-animate"] : [];
    const binPath = resolve(process.argv[1]);
    const result = spawnWindow(binPath, extraArgs);
    if (!result.success) {
      console.error(`Failed to open window: ${result.error}`);
      console.error('Tip: run "tomotoken watch" manually in another terminal.');
      process.exit(1);
    }
    console.log(`Opened tomotoken in ${result.terminalUsed}`);
  });

program.parse();
