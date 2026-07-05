import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Builds the export viewer: a self-contained HTML file rendering a read-only
// diagram from an embedded JSON payload. The output lands in public/ so the
// dev server serves it directly and the main build copies it into dist/.

const elkStub = fileURLToPath(new URL("./src/export/elkStub.ts", import.meta.url));

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      "elkjs/lib/elk.bundled.js": elkStub,
    },
  },
  build: {
    rollupOptions: {
      input: fileURLToPath(new URL("./export-viewer.html", import.meta.url)),
    },
    outDir: "public",
    emptyOutDir: false,
    copyPublicDir: false,
  },
});
