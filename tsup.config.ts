import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["bin/tomotoken.ts", "src/index.ts"],
  format: ["esm"],
  target: "node18",
  outDir: "dist",
  clean: true,
  splitting: true,
  sourcemap: true,
  dts: false,
  // Shebang is in bin/tomotoken.ts source; no global banner needed
});
