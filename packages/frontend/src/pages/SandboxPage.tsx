import { applyNodeChanges, type Node, type OnNodesChange } from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { parseAml } from "../aml.js";
import { useAuth } from "../auth.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { Footer } from "../components/Footer.js";
import { Navbar } from "../components/Navbar.js";
import type { TableNodeData } from "../components/TableNode.js";
import { Workspace } from "../components/Workspace.js";
import {
  type EdgeCustomization,
  type EdgeLayout,
  type NodeLayout,
  parseLayout,
  serializeLayout,
} from "../layout.js";
import { clearSandbox, getSandbox, SANDBOX_SEED, setSandbox } from "../sandbox.js";
import type { Schema } from "../types.js";
import styles from "./SandboxPage.module.css";

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

export function SandboxPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const initial = getSandbox() ?? SANDBOX_SEED;
  const initialLayout = parseLayout(initial.layout);
  const initialSchema = parseAml(initial.amlContent);

  const [title, setTitle] = useState(initial.title);
  const [aml, setAml] = useState(initial.amlContent);
  const [schema, setSchema] = useState<Schema>(initialSchema);
  const [nodes, setNodes] = useState<Node<TableNodeData>[]>(() =>
    schemaToNodes(initialSchema, initialLayout.nodes),
  );
  const [edgeLayout, setEdgeLayout] = useState<EdgeLayout>(initialLayout.edges);
  const [confirmReset, setConfirmReset] = useState(false);
  const layoutRef = useRef<Layout>(initialLayout.nodes);
  const edgeLayoutRef = useRef<EdgeLayout>(initialLayout.edges);

  // Logged-in users don't need the sandbox; redirect to dashboard.
  useEffect(() => {
    if (!authLoading && user) {
      navigate("/", { replace: true });
    }
  }, [authLoading, user, navigate]);

  const persist = useCallback(
    (next: { title?: string; aml?: string; nodes?: Layout; edges?: EdgeLayout }) => {
      setSandbox({
        title: next.title ?? title,
        amlContent: next.aml ?? aml,
        layout: serializeLayout({
          nodes: next.nodes ?? layoutRef.current,
          edges: next.edges ?? edgeLayoutRef.current,
        }),
      });
    },
    [title, aml],
  );

  const handleEdgeLayoutChange = useCallback(
    (key: string, patch: EdgeCustomization) => {
      const next = { ...edgeLayoutRef.current, [key]: { ...edgeLayoutRef.current[key], ...patch } };
      edgeLayoutRef.current = next;
      setEdgeLayout(next);
      persist({ edges: next });
    },
    [persist],
  );

  const handleEdgeLayoutReplace = useCallback(
    (next: EdgeLayout) => {
      edgeLayoutRef.current = next;
      setEdgeLayout(next);
      persist({ edges: next });
    },
    [persist],
  );

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value;
      setTitle(newTitle);
      persist({ title: newTitle });
    },
    [persist],
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
      persist({ aml: value });
    },
    [persist],
  );

  const handleNodesChange: OnNodesChange<Node<TableNodeData>> = useCallback(
    (changes) => {
      setNodes((nds) => {
        const updated = applyNodeChanges(changes, nds);
        const hasDrag = changes.some((c) => c.type === "position" && !c.dragging);
        if (hasDrag) {
          const newLayout: Layout = {};
          for (const node of updated) {
            newLayout[node.id] = node.position;
          }
          layoutRef.current = newLayout;
          persist({ nodes: newLayout });
        }
        return updated;
      });
    },
    [persist],
  );

  const reset = useCallback(() => {
    clearSandbox();
    const seedSchema = parseAml(SANDBOX_SEED.amlContent);
    layoutRef.current = {};
    edgeLayoutRef.current = {};
    setTitle(SANDBOX_SEED.title);
    setAml(SANDBOX_SEED.amlContent);
    setSchema(seedSchema);
    setNodes(schemaToNodes(seedSchema, {}));
    setEdgeLayout({});
  }, []);

  const titleArea = (
    <div className={styles.titleArea}>
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
      <span className={styles.sandboxBadge}>Sandbox · Sign in to save</span>
      <button type="button" className={styles.resetButton} onClick={() => setConfirmReset(true)}>
        Reset
      </button>
    </div>
  );

  return (
    <div className={styles.layout}>
      <Navbar center={titleArea} />
      <Workspace
        aml={aml}
        onAmlChange={handleChange}
        schema={schema}
        nodes={nodes}
        onNodesChange={handleNodesChange}
        edgeLayout={edgeLayout}
        onEdgeLayoutChange={handleEdgeLayoutChange}
        onEdgeLayoutReplace={handleEdgeLayoutReplace}
      />
      <Footer />
      <ConfirmDialog
        open={confirmReset}
        title="Reset sandbox"
        message="This will discard your current sandbox diagram and start fresh."
        confirmLabel="Reset"
        variant="danger"
        onConfirm={() => {
          setConfirmReset(false);
          reset();
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}
