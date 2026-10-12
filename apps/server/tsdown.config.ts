import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "./src/index.ts",
  format: "esm",
  outDir: "./dist",
  clean: true,
  deps: {
    alwaysBundle: [/@thicctactoe\/.*/],
    // Bun built-ins (S3Client) are provided by the runtime.
    neverBundle: ["bun"],
  },
});
