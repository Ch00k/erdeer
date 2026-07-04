import type { EdgeLayout, NodeLayout } from "./layout.js";
import type { Schema } from "./schema.js";

// Id of the script tag holding the diagram payload in an exported HTML file.
// Must match export-viewer.html (packages/frontend) literally.
export const EXPORT_DATA_ELEMENT_ID = "erdeer-export-data";

// This module is imported by the export viewer entry and must stay free of
// runtime dependencies: pulling the AML parser or the payload placeholder
// literal (see exportHtml.ts) into the viewer bundle would bloat or corrupt
// exported files.
export interface ExportData {
  title: string;
  // Origin of the ERDeer instance the export came from; the viewer's brand
  // link points back to it.
  appUrl: string;
  aml: string;
  schema: Schema;
  nodes: NodeLayout;
  edges: EdgeLayout;
}
