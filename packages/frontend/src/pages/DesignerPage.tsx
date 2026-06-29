import { applyNodeChanges, type Node, type OnNodesChange } from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { parseAml } from "../aml.js";
import { type DiagramView, fetchDiagram, updateDiagram, type Visibility } from "../api.js";
import { useAuth } from "../auth.js";
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
import type { Schema } from "../types.js";
import styles from "./DesignerPage.module.css";

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

export function DesignerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [aml, setAml] = useState("");
  const [schema, setSchema] = useState<Schema>({ tables: [], relations: [] });
  const [nodes, setNodes] = useState<Node<TableNodeData>[]>([]);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [edgeLayout, setEdgeLayout] = useState<EdgeLayout>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const layoutTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const layoutRef = useRef<Layout>({});
  const edgeLayoutRef = useRef<EdgeLayout>({});

  const isOwner = !!user && ownerUserId === user.id;

  const applyDiagramData = useCallback((d: DiagramView) => {
    setTitle(d.title);
    setAml(d.amlContent);
    setCanEdit(d.canEdit);
    setOwnerUserId(d.ownerUserId);
    setTeamId(d.teamId);
    setTeamName(d.teamName);
    setVisibility(d.visibility);
    const parsed = parseAml(d.amlContent);
    const savedLayout = parseLayout(d.layout);
    layoutRef.current = savedLayout.nodes;
    edgeLayoutRef.current = savedLayout.edges;
    setEdgeLayout(savedLayout.edges);
    setSchema(parsed);
    setNodes(schemaToNodes(parsed, savedLayout.nodes));
  }, []);

  useEffect(() => {
    if (!id) return;
    fetchDiagram(id)
      .then((d) => {
        applyDiagramData(d);
        setLoading(false);
      })
      .catch(() => navigate("/"));
  }, [id, navigate, applyDiagramData]);

  // Subscribe to server-sent events for external updates
  useEffect(() => {
    if (!id || loading) return;

    const eventSource = new EventSource(`/api/diagrams/${id}/events`);
    let sessionId: string | null = null;

    eventSource.addEventListener("connected", (e) => {
      sessionId = JSON.parse(e.data).sessionId;
    });

    eventSource.addEventListener("updated", (e) => {
      const { sourceSessionId } = JSON.parse(e.data);
      if (sourceSessionId && sourceSessionId === sessionId) return;
      fetchDiagram(id).then(applyDiagramData);
    });

    return () => eventSource.close();
  }, [id, loading, applyDiagramData]);

  const saveAml = useCallback(
    (content: string) => {
      if (!id || !canEdit) return;
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        updateDiagram(id, { amlContent: content });
      }, 1000);
    },
    [id, canEdit],
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

  const persistLayout = useCallback(() => {
    if (!id || !canEdit) return;
    clearTimeout(layoutTimer.current);
    layoutTimer.current = setTimeout(() => {
      updateDiagram(id, {
        layout: serializeLayout({ nodes: layoutRef.current, edges: edgeLayoutRef.current }),
      });
    }, 1000);
  }, [id, canEdit]);

  const saveLayout = useCallback(
    (updatedNodes: Node<TableNodeData>[]) => {
      const newLayout: Layout = {};
      for (const node of updatedNodes) {
        newLayout[node.id] = node.position;
      }
      layoutRef.current = newLayout;
      persistLayout();
    },
    [persistLayout],
  );

  const handleEdgeLayoutChange = useCallback(
    (key: string, patch: EdgeCustomization) => {
      const next = { ...edgeLayoutRef.current, [key]: { ...edgeLayoutRef.current[key], ...patch } };
      edgeLayoutRef.current = next;
      setEdgeLayout(next);
      persistLayout();
    },
    [persistLayout],
  );

  const handleEdgeLayoutReplace = useCallback(
    (next: EdgeLayout) => {
      edgeLayoutRef.current = next;
      setEdgeLayout(next);
      persistLayout();
    },
    [persistLayout],
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
      if (id && canEdit) {
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          updateDiagram(id, { title: newTitle });
        }, 1000);
      }
    },
    [id, canEdit],
  );

  const toggleVisibility = useCallback(() => {
    if (!id || !isOwner) return;
    const next: Visibility = visibility === "public" ? "private" : "public";
    setVisibility(next);
    updateDiagram(id, { visibility: next }).catch(() => {
      setVisibility(visibility);
    });
  }, [id, isOwner, visibility]);

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  let visibilityElement: React.ReactNode = null;
  if (isOwner) {
    visibilityElement = (
      <button
        type="button"
        className={`${styles.visibilityToggle} ${visibility === "public" ? styles.visibilityPublic : ""}`}
        onClick={toggleVisibility}
        title={
          visibility === "public"
            ? "Anyone with the link can view. Click to make private."
            : "Only you and team members can view. Click to make public."
        }
      >
        {visibility === "public" ? "Public" : "Private"}
      </button>
    );
  } else if (visibility === "public") {
    visibilityElement = (
      <span className={styles.visibilityBadge}>{canEdit ? "Public" : "Public · View only"}</span>
    );
  } else if (!canEdit) {
    visibilityElement = <span className={styles.visibilityBadge}>View only</span>;
  }

  const titleInput = (
    <div className={styles.titleArea}>
      <div className={styles.titleWrapper}>
        <input
          className={styles.titleInput}
          value={title}
          onChange={handleTitleChange}
          placeholder="Untitled diagram"
          readOnly={!canEdit}
        />
        {canEdit && (
          <svg className={styles.titleIcon} width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M10.5 1.5L12.5 3.5L4.5 11.5L1.5 12.5L2.5 9.5L10.5 1.5Z"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      {user && (
        <span className={styles.ownerBadge}>
          {teamId ? `Team: ${teamName ?? "?"}` : "Personal"}
        </span>
      )}
      {visibilityElement}
    </div>
  );

  return (
    <div className={styles.layout}>
      <Navbar center={titleInput} />
      <Workspace
        aml={aml}
        onAmlChange={handleChange}
        schema={schema}
        nodes={nodes}
        onNodesChange={handleNodesChange}
        edgeLayout={edgeLayout}
        onEdgeLayoutChange={handleEdgeLayoutChange}
        onEdgeLayoutReplace={handleEdgeLayoutReplace}
        readOnly={!canEdit}
      />
      <Footer />
    </div>
  );
}
