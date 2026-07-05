import type { ExportData } from "@erdeer/shared/export";
import { applyNodeChanges, type Node, type OnNodesChange } from "@xyflow/react";
import { useCallback, useState } from "react";
import { Diagram } from "../components/Diagram.js";
import { ResizeHandle } from "../components/ResizeHandle.js";
import type { TableNodeData } from "../components/TableNode.js";
import { schemaToNodes } from "../nodes.js";
import { AmlCode } from "./AmlCode.js";
import styles from "./Viewer.module.css";

const ignoreEdgeChanges = () => {};

export function Viewer({ data }: { data: ExportData }) {
  const [nodes, setNodes] = useState<Node<TableNodeData>[]>(() =>
    schemaToNodes(data.schema, data.nodes),
  );
  const [amlWidth, setAmlWidth] = useState(() => Math.round(window.innerWidth * 0.25));
  const [amlCollapsed, setAmlCollapsed] = useState(false);

  const handleNodesChange: OnNodesChange<Node<TableNodeData>> = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const handleResize = useCallback((deltaX: number) => {
    setAmlWidth((w) => Math.max(200, Math.min(800, w + deltaX)));
  }, []);

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <span className={styles.title}>{data.title || "Untitled diagram"}</span>
        <a className={styles.brand} href={data.appUrl} target="_blank" rel="noreferrer">
          ERDeer
        </a>
      </header>
      <div className={styles.body}>
        {!amlCollapsed && (
          <>
            <div className={styles.amlPane} style={{ width: amlWidth }}>
              <div className={styles.amlHeader}>
                <span>AML</span>
                <button
                  type="button"
                  className={styles.amlHeaderButton}
                  onClick={() => setAmlCollapsed(true)}
                  title="Hide AML"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M9 3v18" />
                    <path d="m16 15-3-3 3-3" />
                  </svg>
                </button>
              </div>
              <div className={styles.amlBody}>
                <AmlCode aml={data.aml} />
              </div>
            </div>
            <ResizeHandle onResize={handleResize} />
          </>
        )}
        <div className={styles.diagramPane}>
          {amlCollapsed && (
            <button
              type="button"
              className={styles.expandButton}
              onClick={() => setAmlCollapsed(false)}
              title="Show AML"
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
            schema={data.schema}
            nodes={nodes}
            onNodesChange={handleNodesChange}
            edgeLayout={data.edges}
            onEdgeLayoutChange={ignoreEdgeChanges}
            onEdgeLayoutReplace={ignoreEdgeChanges}
            readOnly
          />
        </div>
      </div>
    </div>
  );
}
