import { execSync } from "node:child_process";
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

// Release builds (Docker, CI) pass the git tag via ERDEER_VERSION since .git
// is not in the build context; local builds derive the version from git
// (the exact tag on a tagged commit, tag-distance-sha otherwise).
function resolveVersion(): string {
  if (process.env.ERDEER_VERSION) return process.env.ERDEER_VERSION;

  try {
    return execSync("git describe --tags --always", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __ERDEER_VERSION__: JSON.stringify(resolveVersion()),
  },
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
