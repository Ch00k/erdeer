#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { validateAml } from "@erdeer/shared";

const USAGE = `erdeer - ERDeer command-line tool

Usage:
  erdeer validate [file] [--json]

Commands:
  validate [file]   Validate AML from a file, or from stdin if no file is given
                    (or "-"). Exit 0 if valid, 1 if invalid.

Options:
  --json            Emit the result as JSON.
  -h, --help        Show this help.
`;

function run(argv: string[]): number {
  const args = argv.slice(2);

  if (args[0] === "-h" || args[0] === "--help") {
    process.stdout.write(USAGE);
    return 0;
  }

  if (args[0] !== "validate") {
    process.stderr.write(
      `${args[0] ? `Unknown command: ${args[0]}` : "No command given"}\n\n${USAGE}`,
    );
    return 2;
  }

  const rest = args.slice(1);
  const json = rest.includes("--json");
  const file = rest.find((a) => !a.startsWith("-"));
  const useStdin = !file;

  if (useStdin && process.stdin.isTTY) {
    process.stderr.write(`No input given.\n\n${USAGE}`);
    return 2;
  }

  const source = useStdin ? "stdin" : file;

  let content: string;
  try {
    content = readFileSync(useStdin ? 0 : (file as string), "utf8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Cannot read ${source}: ${message}\n`);
    return 2;
  }

  const result = validateAml(content);

  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result.valid ? 0 : 1;
  }

  if (result.valid) {
    process.stdout.write(
      `${source} is valid (${result.entities} entities, ${result.relations} relations, ${result.types} types)\n`,
    );
    return 0;
  }

  process.stderr.write(`${source} is invalid:\n`);
  for (const e of result.errors) {
    const { line, column } = e.position.start;
    process.stderr.write(`  line ${line}, column ${column}: ${e.message}\n`);
  }
  return 1;
}

process.exit(run(process.argv));
