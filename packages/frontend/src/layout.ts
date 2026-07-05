// Re-exported from @erdeer/shared for convenience within the frontend
// package. The "/layout" subpath keeps the AML parser out of the export
// viewer bundle, which imports layout helpers through this module.
export {
  type DiagramLayout,
  type EdgeCustomization,
  type EdgeLayout,
  type EdgeRoute,
  type EdgeSide,
  type NodeLayout,
  parseLayout,
  relationKey,
  serializeLayout,
} from "@erdeer/shared/layout";
