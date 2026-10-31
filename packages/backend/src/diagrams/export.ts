import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { type ExportData, parseAml, parseLayout, renderExportHtml } from "@erdeer/shared";
import { packageRoot } from "../paths.js";
import type { Diagram } from "./access.js";

// The frontend dev script rebuilds the template in frontend/public, so that
// copy is the fresher one in dev; the production image has it in both places
// (the main build copies public/ into dist/), identical.
const templateCandidates = [
  resolve(packageRoot, "../frontend/public/export-viewer.html"),
  resolve(packageRoot, "../frontend/dist/export-viewer.html"),
];

async function readTemplate(): Promise<string> {
  for (const path of templateCandidates) {
    try {
      return await readFile(path, "utf-8");
    } catch {}
  }

  throw new Error("export-viewer.html not found; build the frontend first");
}

// Assembles the self-contained export HTML for a stored diagram: the viewer
// template with the parsed schema, stored layout, and AML source injected.
// Tables missing from the stored layout get their position from the parsed
// schema inside the viewer, same as the app's own rendering.
export async function buildExportHtml(diagram: Diagram, appUrl: string): Promise<string> {
  const template = await readTemplate();

  const schema = parseAml(diagram.amlContent);
  const layout = parseLayout(diagram.layout);

  const data: ExportData = {
    title: diagram.title,
    appUrl,
    aml: diagram.amlContent,
    schema,
    nodes: layout.nodes,
    edges: layout.edges,
  };

  return renderExportHtml(template, data);
}
