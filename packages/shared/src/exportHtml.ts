import type { ExportData } from "./export.js";

// Must match the payload script tag's content in export-viewer.html
// (packages/frontend). This module must stay out of the export viewer entry's
// import graph: if the literal were bundled into the template's inlined JS,
// the replacement below could hit that copy instead of the payload tag.
const DATA_PLACEHOLDER = "__ERDEER_EXPORT_DATA__";

// Produces a self-contained HTML file: the prebuilt viewer template with the
// diagram's data injected into its payload script tag.
export function renderExportHtml(template: string, data: ExportData): string {
  // Escape "<" so the JSON can never contain a literal "</script>". The
  // replacement callback keeps "$"-sequences in the JSON from being expanded.
  // Anchoring on the tag boundaries guards against any other occurrence of
  // the placeholder string in the template.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const html = template.replace(`>${DATA_PLACEHOLDER}<`, () => `>${json}<`);

  if (html === template) {
    throw new Error("The viewer template has no data placeholder");
  }

  return html;
}

export function exportFilename(title: string): string {
  const slug = title
    .trim()
    .replace(/[^\p{L}\p{N}-]+/gu, "_")
    .replace(/^_+|_+$/g, "");

  return `${slug || "diagram"}.html`;
}
