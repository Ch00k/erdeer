import { applyNodeChanges, type Node, type OnNodesChange } from "@xyflow/react";
import { useCallback, useRef, useState } from "react";
import schemaAml from "../../../../db.aml?raw";
import { parseAml } from "../aml.js";
import { Diagram } from "../components/Diagram.js";
import { Editor } from "../components/Editor.js";
import { Footer } from "../components/Footer.js";
import { Navbar } from "../components/Navbar.js";
import { ResizeHandle } from "../components/ResizeHandle.js";
import type { TableNodeData } from "../components/TableNode.js";
import type { Schema } from "../types.js";
import styles from "./SchemaPage.module.css";

type Layout = Record<string, { x: number; y: number }>;

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
  const [editorWidth, setEditorWidth] = useState(() => Math.round(window.innerWidth * 0.25));
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

  const handleResize = useCallback((deltaX: number) => {
    setEditorWidth((w) => Math.max(200, Math.min(800, w + deltaX)));
  }, []);

  return (
    <div className={styles.layout}>
      <Navbar center={<span className={styles.pageTitle}>App Schema</span>} />
      <div className={styles.workspace}>
        <div className={styles.editorPane} style={{ width: editorWidth }}>
          <Editor value={aml} onChange={handleChange} />
        </div>
        <ResizeHandle onResize={handleResize} />
        <div className={styles.diagramPane}>
          <Diagram schema={schema} nodes={nodes} onNodesChange={handleNodesChange} />
        </div>
      </div>
      <Footer />
    </div>
  );
}
