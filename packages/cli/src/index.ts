#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { validateAml } from "@erdeer/shared";
import { VERSION } from "./version.js";

const DEFAULT_SERVER = "https://erdeer.dev";

const USAGE = `erdeer ${VERSION} - ERDeer command-line tool

Usage:
  erdeer validate [file] [--json]
  erdeer upload <file> [options]
  erdeer update <diagram-id> [file] [options]
  erdeer export <diagram-id> [options]

Commands:
  validate [file]      Validate AML from a file, or from stdin if no file is
                       given (or "-"). Exit 0 if valid, 1 if invalid.
  upload <file>        Validate an AML file and create a diagram from it on
                       the server. Requires an API token.
  update <diagram-id>  Validate AML (from a file, or stdin if none is given)
                       and overwrite an existing diagram's content on the
                       server. Requires an API token.
  export <diagram-id>  Download a diagram as a self-contained HTML file.
                       Public diagrams need no token.

Options:
  --json               Emit the result as JSON (validate, upload, update).
  --title <title>      Diagram title (upload: defaults to the file name;
                       update: left unchanged if omitted).
  --team <team-id>     Create the diagram in a team (upload).
  -o, --output <file>  Output path (export; defaults to the server-suggested
                       file name).
  --server <url>       ERDeer instance (or ERDEER_SERVER env var).
                       Default: ${DEFAULT_SERVER}
  --token <token>      API token (or ERDEER_TOKEN env var). Create one under
                       "API Tokens" in the app.
  --version            Show the version.
  -h, --help           Show this help.
`;

interface Options {
  json: boolean;
  title?: string;
  team?: string;
  output?: string;
  server: string;
  token?: string;
  positional: string[];
}

const VALUE_FLAGS: Record<string, "title" | "team" | "output" | "server" | "token"> = {
  "--title": "title",
  "--team": "team",
  "--output": "output",
  "-o": "output",
  "--server": "server",
  "--token": "token",
};

function parseOptions(args: string[]): Options | string {
  const opts: Options = {
    json: false,
    server: process.env.ERDEER_SERVER || DEFAULT_SERVER,
    token: process.env.ERDEER_TOKEN,
    positional: [],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--json") {
      opts.json = true;
      continue;
    }

    const key = VALUE_FLAGS[arg];
    if (key) {
      const value = args[++i];
      if (value === undefined) return `${arg} requires a value`;
      opts[key] = value;
      continue;
    }

    if (arg.startsWith("-") && arg !== "-") return `Unknown option: ${arg}`;
    opts.positional.push(arg);
  }

  opts.server = opts.server.replace(/\/+$/, "");
  return opts;
}

function readInput(file: string | undefined): { source: string; content: string } | number {
  const useStdin = !file || file === "-";

  if (useStdin && process.stdin.isTTY) {
    process.stderr.write(`No input given.\n\n${USAGE}`);
    return 2;
  }

  const source = useStdin ? "stdin" : (file as string);
  try {
    return { source, content: readFileSync(useStdin ? 0 : (file as string), "utf8") };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Cannot read ${source}: ${message}\n`);
    return 2;
  }
}

function printValidationErrors(
  source: string,
  errors: { message: string; position: { start: { line: number; column: number } } }[],
) {
  process.stderr.write(`${source} is invalid:\n`);
  for (const e of errors) {
    const { line, column } = e.position.start;
    process.stderr.write(`  line ${line}, column ${column}: ${e.message}\n`);
  }
}

function validate(opts: Options): number {
  const input = readInput(opts.positional[0]);
  if (typeof input === "number") return input;

  const result = validateAml(input.content);

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result.valid ? 0 : 1;
  }

  if (result.valid) {
    process.stdout.write(
      `${input.source} is valid (${result.entities} entities, ${result.relations} relations, ${result.types} types)\n`,
    );
    return 0;
  }

  printValidationErrors(input.source, result.errors);
  return 1;
}

async function request(
  opts: Options,
  path: string,
  init: RequestInit = {},
): Promise<Response | number> {
  const headers = new Headers(init.headers);
  if (opts.token) headers.set("authorization", `Bearer ${opts.token}`);

  try {
    return await fetch(`${opts.server}${path}`, { ...init, headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Cannot reach ${opts.server}: ${message}\n`);
    return 2;
  }
}

async function upload(opts: Options): Promise<number> {
  const file = opts.positional[0];
  if (!file) {
    process.stderr.write(`upload requires a file.\n\n${USAGE}`);
    return 2;
  }

  const input = readInput(file);
  if (typeof input === "number") return input;

  const result = validateAml(input.content);
  if (!result.valid) {
    printValidationErrors(input.source, result.errors);
    return 1;
  }

  if (!opts.token) {
    process.stderr.write("An API token is required to upload (--token or ERDEER_TOKEN).\n");
    return 2;
  }

  const title = opts.title ?? basename(file).replace(/\.[^.]+$/, "");
  const res = await request(opts, "/api/diagrams", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title,
      amlContent: input.content,
      ...(opts.team && { teamId: opts.team }),
    }),
  });
  if (typeof res === "number") return res;

  if (!res.ok) {
    process.stderr.write(`Upload failed: HTTP ${res.status} ${await res.text()}\n`);
    return 1;
  }

  const diagram = (await res.json()) as { id: string };
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(diagram, null, 2)}\n`);
  } else {
    process.stdout.write(`Created "${title}": ${opts.server}/diagrams/${diagram.id}\n`);
  }
  return 0;
}

async function update(opts: Options): Promise<number> {
  const id = opts.positional[0];
  if (!id) {
    process.stderr.write(`update requires a diagram id.\n\n${USAGE}`);
    return 2;
  }

  const input = readInput(opts.positional[1]);
  if (typeof input === "number") return input;

  const result = validateAml(input.content);
  if (!result.valid) {
    printValidationErrors(input.source, result.errors);
    return 1;
  }

  if (!opts.token) {
    process.stderr.write("An API token is required to update (--token or ERDEER_TOKEN).\n");
    return 2;
  }

  const res = await request(opts, `/api/diagrams/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      amlContent: input.content,
      ...(opts.title !== undefined && { title: opts.title }),
    }),
  });
  if (typeof res === "number") return res;

  if (!res.ok) {
    process.stderr.write(`Update failed: HTTP ${res.status} ${await res.text()}\n`);
    return 1;
  }

  const diagram = (await res.json()) as { id: string; title: string };
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(diagram, null, 2)}\n`);
  } else {
    process.stdout.write(`Updated "${diagram.title}": ${opts.server}/diagrams/${diagram.id}\n`);
  }
  return 0;
}

async function exportDiagram(opts: Options): Promise<number> {
  const id = opts.positional[0];
  if (!id) {
    process.stderr.write(`export requires a diagram id.\n\n${USAGE}`);
    return 2;
  }

  const res = await request(opts, `/api/diagrams/${id}/export`);
  if (typeof res === "number") return res;

  if (res.status === 401) {
    process.stderr.write("Not authenticated: pass a valid API token (--token or ERDEER_TOKEN).\n");
    return 1;
  }
  if (!res.ok) {
    process.stderr.write(`Export failed: HTTP ${res.status} ${await res.text()}\n`);
    return 1;
  }

  const suggested = res.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1];
  const output = opts.output ?? suggested ?? `${id}.html`;
  const html = await res.text();

  try {
    writeFileSync(output, html);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Cannot write ${output}: ${message}\n`);
    return 2;
  }

  process.stdout.write(`Saved ${output}\n`);
  return 0;
}

async function run(argv: string[]): Promise<number> {
  const args = argv.slice(2);

  if (args[0] === "-h" || args[0] === "--help" || args.length === 0) {
    process.stdout.write(USAGE);
    return args.length === 0 ? 2 : 0;
  }

  if (args[0] === "--version") {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }

  const command = args[0];
  const opts = parseOptions(args.slice(1));
  if (typeof opts === "string") {
    process.stderr.write(`${opts}\n\n${USAGE}`);
    return 2;
  }

  switch (command) {
    case "validate":
      return validate(opts);
    case "upload":
      return upload(opts);
    case "update":
      return update(opts);
    case "export":
      return exportDiagram(opts);
    default:
      process.stderr.write(`Unknown command: ${command}\n\n${USAGE}`);
      return 2;
  }
}

process.exit(await run(process.argv));
