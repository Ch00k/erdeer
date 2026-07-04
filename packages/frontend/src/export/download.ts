import type { ExportData } from "@erdeer/shared/export";
// This module must stay out of the export viewer entry's import graph: the
// injection helpers carry the payload placeholder literal, and a copy inside
// the template's inlined JS could be hit instead of the payload tag.
import { exportFilename, renderExportHtml } from "@erdeer/shared/export-html";
import type { Node } from "@xyflow/react";
import type { TableNodeData } from "../components/TableNode.js";
import type { EdgeLayout, NodeLayout } from "../layout.js";
import type { Schema } from "../types.js";

const TEMPLATE_URL = "/export-viewer.html";

interface DownloadInput {
  title: string;
  aml: string;
  schema: Schema;
  nodes: Node<TableNodeData>[];
  edgeLayout: EdgeLayout;
}

// Downloads the diagram as a self-contained HTML file: the prebuilt viewer
// bundle with the diagram's data injected into its payload script tag.
export async function downloadDiagramHtml({
  title,
  aml,
  schema,
  nodes,
  edgeLayout,
}: DownloadInput) {
  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) {
    throw new Error(`Fetching ${TEMPLATE_URL} failed with status ${res.status}`);
  }
  const template = await res.text();

  const positions: NodeLayout = {};
  for (const node of nodes) {
    positions[node.id] = node.position;
  }

  const data: ExportData = {
    title,
    appUrl: window.location.origin,
    aml,
    schema,
    nodes: positions,
    edges: edgeLayout,
  };
  const html = renderExportHtml(template, data);

  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = exportFilename(title);
  anchor.click();
  URL.revokeObjectURL(url);
}
