import { applyNodeChanges, type Node, type OnNodesChange } from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { parseAml } from "../aml.js";
import { fetchDiagram, updateDiagram } from "../api.js";
import { Diagram } from "../components/Diagram.js";
import { Editor } from "../components/Editor.js";
import { Footer } from "../components/Footer.js";
import { Navbar } from "../components/Navbar.js";
import { ResizeHandle } from "../components/ResizeHandle.js";
import type { TableNodeData } from "../components/TableNode.js";
import type { Schema } from "../types.js";
import styles from "./DesignerPage.module.css";

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

export function DesignerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [aml, setAml] = useState("");
  const [schema, setSchema] = useState<Schema>({ tables: [], relations: [] });
  const [nodes, setNodes] = useState<Node<TableNodeData>[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorWidth, setEditorWidth] = useState(400);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const layoutTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const layoutRef = useRef<Layout>({});

  useEffect(() => {
    if (!id) return;
    fetchDiagram(id)
      .then((d) => {
        setTitle(d.title);
        setAml(d.amlContent);
        const parsed = parseAml(d.amlContent);
        const savedLayout: Layout = d.layout ? JSON.parse(d.layout) : {};
        layoutRef.current = savedLayout;
        setSchema(parsed);
        setNodes(schemaToNodes(parsed, savedLayout));
        setLoading(false);
      })
      .catch(() => navigate("/"));
  }, [id, navigate]);

  const saveAml = useCallback(
    (content: string) => {
      if (!id) return;
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        updateDiagram(id, { amlContent: content });
      }, 1000);
    },
    [id],
  );

  const handleChange = useCallback(
    (value: string) => {
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
      saveAml(value);
    },
    [saveAml],
  );

  const saveLayout = useCallback(
    (updatedNodes: Node<TableNodeData>[]) => {
      if (!id) return;
      const newLayout: Layout = {};
      for (const node of updatedNodes) {
        newLayout[node.id] = node.position;
      }
      layoutRef.current = newLayout;
      clearTimeout(layoutTimer.current);
      layoutTimer.current = setTimeout(() => {
        updateDiagram(id, { layout: JSON.stringify(newLayout) });
      }, 1000);
    },
    [id],
  );

  const handleNodesChange: OnNodesChange<Node<TableNodeData>> = useCallback(
    (changes) => {
      setNodes((nds) => {
        const updated = applyNodeChanges(changes, nds);
        const hasDrag = changes.some((c) => c.type === "position" && !c.dragging);
        if (hasDrag) {
          saveLayout(updated);
        }
        return updated;
      });
    },
    [saveLayout],
  );

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value;
      setTitle(newTitle);
      if (id) {
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          updateDiagram(id, { title: newTitle });
        }, 1000);
      }
    },
    [id],
  );

  const handleResize = useCallback((deltaX: number) => {
    setEditorWidth((w) => Math.max(200, Math.min(800, w + deltaX)));
  }, []);

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  const titleInput = (
    <div className={styles.titleWrapper}>
      <input
        className={styles.titleInput}
        value={title}
        onChange={handleTitleChange}
        placeholder="Untitled diagram"
      />
      <svg className={styles.titleIcon} width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M10.5 1.5L12.5 3.5L4.5 11.5L1.5 12.5L2.5 9.5L10.5 1.5Z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );

  return (
    <div className={styles.layout}>
      <Navbar center={titleInput} />
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
