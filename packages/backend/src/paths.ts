import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// The backend package directory. This module sits directly in src/ when run
// from source and is inlined into dist/server.js when bundled, so its own
// directory is one level below the package either way.
export const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
