import type { Node } from "@xyflow/react";
import type { TableNodeData } from "./components/TableNode.js";
import type { NodeLayout } from "./layout.js";
import type { Schema } from "./types.js";

export function schemaToNodes(schema: Schema, layout: NodeLayout): Node<TableNodeData>[] {
  return schema.tables.map((table) => ({
    id: table.name,
    type: "table",
    position: layout[table.name] ?? table.position,
    data: {
      label: table.name,
      schema: table.schema,
      columns: table.columns,
      comment: table.comment,
    },
  }));
}
