#!/usr/bin/env node
import { Command } from "commander";
import React from "react";
import { render } from "ink";
import { App } from "../src/ui/app.js";
import { runFull, runCalibration, runIngestion } from "../src/index.js";
import { loadState, saveState, createInitialState } from "../src/store/index.js";
import { loadConfig, ensureDataDir } from "../src/config/index.js";
import { loadCollection } from "../src/store/index.js";

const program = new Command();

program
  .name("tomotoken")
  .description("Visualize your Claude Code usage as a growing pet")
  .version("0.1.0");

program
  .command("show", { isDefault: true })
  .description("Show current pet with progress and traits")
  .action(() => {
    const { state, collection } = runFull();
    const config = loadConfig();
    render(React.createElement(App, { command: "show", state, config, collection }));
  });

program
  .command("stats")
  .description("Show token usage statistics")
  .action(() => {
    const { state, collection } = runFull();
    const config = loadConfig();
    render(React.createElement(App, { command: "stats", state, config, collection }));
  });

program
  .command("collection")
  .description("List completed pets")
  .action(() => {
    const { state, collection } = runFull();
    const config = loadConfig();
    render(React.createElement(App, { command: "collection", state, config, collection }));
  });

program
  .command("view <petId>")
  .description("View a completed pet in detail")
  .action((petId: string) => {
    const { state, collection } = runFull();
    const config = loadConfig();
    render(React.createElement(App, { command: "view", state, config, collection, viewPetId: petId }));
  });

program
  .command("config")
  .description("Show current configuration")
  .action(() => {
    const { state, collection } = runFull();
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
  .action(() => {
    const config = loadConfig();
    ensureDataDir();
    const state = createInitialState(10_000); // Reset all ingestion offsets
    saveState(state);
    const { state: result } = runFull(config);
    console.log(`Rescan complete. ${result.globalStats.totalTokensAllTime.toLocaleString()} total tokens.`);
  });

program
  .command("watch")
  .description("Live mode: watch for log changes and update pet")
  .option("--no-animate", "Disable animation")
  .action((_opts) => {
    console.log("Watch mode not yet implemented in v0.1. Use 'tomotoken show' for now.");
  });

program.parse();
