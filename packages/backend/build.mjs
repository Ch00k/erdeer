import { build } from "esbuild";

// Bundles the server and its dependencies into one ESM file run by plain
// Node. @azimutt/aml is not valid Node ESM (extensionless imports, a JSON
// import without an attribute), so it can only run bundled or through a
// loader. better-sqlite3 stays external: it loads a native addon from its own
// package directory.
await build({
  entryPoints: ["src/server.ts"],
  outfile: "dist/server.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  external: ["better-sqlite3"],
  // CommonJS dependencies call require(), which ESM output does not define.
  banner: {
    js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
  logLevel: "warning",
});
