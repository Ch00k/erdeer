// Release binaries get ERDEER_VERSION substituted at compile time by
// `bun build --define` (see build:binary and the release workflow); when
// running from source the identifier is undeclared and resolution falls back
// to the environment, then "dev".
declare const ERDEER_VERSION: string | undefined;

export const VERSION =
  typeof ERDEER_VERSION === "string" ? ERDEER_VERSION : (process.env.ERDEER_VERSION ?? "dev");
