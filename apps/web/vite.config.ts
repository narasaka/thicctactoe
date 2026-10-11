import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3001,
  },
  // Env comes from dotenvx (see package.json scripts), not Vite's own loader.
  envDir: false,
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    // Targets Vercel when built there (preset is auto-detected), Node elsewhere.
    nitro(),
    viteReact(),
  ],
});
