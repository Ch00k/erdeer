import { applyNodeChanges, type Node, type OnNodesChange } from "@xyflow/react";
import { useCallback, useRef, useState } from "react";
import schemaAml from "../../../../db.aml?raw";
import { parseAml } from "../aml.js";
import { Footer } from "../components/Footer.js";
import { Navbar } from "../components/Navbar.js";
import type { TableNodeData } from "../components/TableNode.js";
import { Workspace } from "../components/Workspace.js";
import type { EdgeCustomization, EdgeLayout, NodeLayout } from "../layout.js";
import type { Schema } from "../types.js";
import styles from "./SchemaPage.module.css";

type Layout = NodeLayout;

function schemaToNodes(schema: Schema, layout: Layout): Node<TableNodeData>[] {
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

export function SchemaPage() {
  const initialSchema = parseAml(schemaAml);
  const [aml, setAml] = useState(schemaAml);
  const [schema, setSchema] = useState<Schema>(initialSchema);
  const [nodes, setNodes] = useState<Node<TableNodeData>[]>(() => schemaToNodes(initialSchema, {}));
  const [edgeLayout, setEdgeLayout] = useState<EdgeLayout>({});
  const layoutRef = useRef<Layout>({});

  const handleChange = useCallback((value: string) => {
    setAml(value);
    const newSchema = parseAml(value);
    setSchema(newSchema);
    setNodes((prev) => {
      const currentPositions: Layout = {};
      for (const node of prev) {
        currentPositions[node.id] = node.position;
      }
      Object.assign(layoutRef.current, currentPositions);
      return schemaToNodes(newSchema, layoutRef.current);
    });
  }, []);

  const handleEdgeLayoutChange = useCallback((key: string, patch: EdgeCustomization) => {
    setEdgeLayout((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }, []);

  const handleNodesChange: OnNodesChange<Node<TableNodeData>> = useCallback((changes) => {
    setNodes((nds) => {
      const updated = applyNodeChanges(changes, nds);
      const hasDrag = changes.some((c) => c.type === "position" && !c.dragging);
      if (hasDrag) {
        const newLayout: Layout = {};
        for (const node of updated) {
          newLayout[node.id] = node.position;
        }
        layoutRef.current = newLayout;
      }
      return updated;
    });
  }, []);

  return (
    <div className={styles.layout}>
      <Navbar center={<span className={styles.pageTitle}>App Schema</span>} />
      <Workspace
        aml={aml}
        onAmlChange={handleChange}
        schema={schema}
        nodes={nodes}
        onNodesChange={handleNodesChange}
        edgeLayout={edgeLayout}
        onEdgeLayoutChange={handleEdgeLayoutChange}
      />
      <Footer />
    </div>
  );
}
