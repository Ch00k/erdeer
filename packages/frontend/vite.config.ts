import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// monaco-themes ships theme JSON files under `themes/` but does not list them
// in its package "exports" map, so they cannot be resolved as a subpath
// import. The package directory itself is symlinked into node_modules by
// pnpm, so we resolve the folder relative to this config file.
const monacoThemesDir = fileURLToPath(
  new URL("./node_modules/monaco-themes/themes", import.meta.url),
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "monaco-themes-data": monacoThemesDir,
    },
  },
  server: {
    port: 7000,
    proxy: {
      "/auth": "http://localhost:3001",
      "/api": "http://localhost:3001",
    },
  },
});
