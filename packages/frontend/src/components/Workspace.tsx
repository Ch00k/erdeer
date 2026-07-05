import type { Node, OnNodesChange } from "@xyflow/react";
import { useCallback, useState } from "react";
import { downloadDiagramHtml } from "../export/download.js";
import type { EdgeCustomization, EdgeLayout } from "../layout.js";
import type { Schema } from "../types.js";
import { AmlReference } from "./AmlReference.js";
import { Diagram } from "./Diagram.js";
import { Editor } from "./Editor.js";
import { ResizeHandle } from "./ResizeHandle.js";
import type { TableNodeData } from "./TableNode.js";
import styles from "./Workspace.module.css";

interface WorkspaceProps {
  aml: string;
  onAmlChange: (value: string) => void;
  schema: Schema;
  nodes: Node<TableNodeData>[];
  onNodesChange: OnNodesChange<Node<TableNodeData>>;
  edgeLayout: EdgeLayout;
  onEdgeLayoutChange: (key: string, patch: EdgeCustomization) => void;
  onEdgeLayoutReplace: (next: EdgeLayout) => void;
  readOnly?: boolean;
  exportTitle: string;
}

export function Workspace({
  aml,
  onAmlChange,
  schema,
  nodes,
  onNodesChange,
  edgeLayout,
  onEdgeLayoutChange,
  onEdgeLayoutReplace,
  readOnly,
  exportTitle,
}: WorkspaceProps) {
  const [editorWidth, setEditorWidth] = useState(() => Math.round(window.innerWidth * 0.25));
  const [editorCollapsed, setEditorCollapsed] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);

  const handleResize = useCallback((deltaX: number) => {
    setEditorWidth((w) => Math.max(200, Math.min(800, w + deltaX)));
  }, []);

  // Lives here rather than in the diagram component tree so download.ts (and
  // the data placeholder literal it carries) stays out of the export viewer
  // bundle, which reuses Diagram.
  const handleExport = useCallback(() => {
    downloadDiagramHtml({ title: exportTitle, aml, schema, nodes, edgeLayout }).catch(() => {
      window.alert("Export failed: the viewer template could not be loaded.");
    });
  }, [exportTitle, aml, schema, nodes, edgeLayout]);

  return (
    <div className={styles.workspace}>
      {!editorCollapsed && (
        <>
          <div className={styles.editorPane} style={{ width: editorWidth }}>
            <Editor
              value={aml}
              onChange={onAmlChange}
              readOnly={readOnly}
              onToggleReference={() => setReferenceOpen((v) => !v)}
              referenceOpen={referenceOpen}
              onCollapse={() => setEditorCollapsed(true)}
            />
          </div>
          <ResizeHandle onResize={handleResize} />
        </>
      )}
      <div className={styles.diagramPane}>
        {editorCollapsed && (
          <button
            type="button"
            className={styles.expandButton}
            onClick={() => setEditorCollapsed(false)}
            title="Show editor"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M9 3v18" />
              <path d="m14 9 3 3-3 3" />
            </svg>
          </button>
        )}
        <Diagram
          schema={schema}
          nodes={nodes}
          onNodesChange={onNodesChange}
          edgeLayout={edgeLayout}
          onEdgeLayoutChange={onEdgeLayoutChange}
          onEdgeLayoutReplace={onEdgeLayoutReplace}
          readOnly={readOnly}
          onExport={handleExport}
        />
        {referenceOpen && <AmlReference onClose={() => setReferenceOpen(false)} />}
      </div>
    </div>
  );
}
