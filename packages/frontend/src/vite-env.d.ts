/// <reference types="vite/client" />

// Injected by the `define` block in vite.config.ts.
declare const __ERDEER_VERSION__: string;

declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module "monaco-themes-data/*.json" {
  const data: unknown;
  export default data;
}
