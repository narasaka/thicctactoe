import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  server: {
    port: 3001,
  },
  // Env comes from dotenvx (see package.json scripts), not Vite's own loader.
  envDir: false,
  resolve: {
    tsconfigPaths: true,
  },
  ssr: {
    // Production builds bundle every dependency into the server: serverless
    // functions ship without node_modules, and CommonJS deps
    // (use-sync-external-store) would otherwise keep a runtime require("react")
    // that cannot be resolved. Dev keeps Vite's default externals.
    noExternal: command === "build" ? true : undefined,
  },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    // Targets Vercel when built there (preset is auto-detected), Node elsewhere.
    nitro(),
    viteReact(),
  ],
}));
