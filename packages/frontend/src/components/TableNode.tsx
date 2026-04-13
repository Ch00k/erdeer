import { Handle, type Node, type NodeProps, Position, useReactFlow } from "@xyflow/react";
import { type MouseEvent, memo, useCallback, useEffect, useRef, useState } from "react";
import type { Column } from "../types.js";
import { ColumnTooltip } from "./ColumnTooltip.js";
import styles from "./TableNode.module.css";

export type TableNodeData = {
  label: string;
  schema?: string;
  columns: Column[];
  comment?: string;
};

type TableNodeType = Node<TableNodeData, "table">;

type HoveredColumn = { name: string; side: "left" | "right" };

export const TableNode = memo(function TableNode({ id, data }: NodeProps<TableNodeType>) {
  const [hovered, setHovered] = useState<HoveredColumn | null>(null);
  const delayTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingHover = useRef<HoveredColumn | null>(null);
  const { setNodes } = useReactFlow();

  useEffect(() => {
    if (hovered) {
      setNodes((nodes) => nodes.map((n) => (n.id === id ? { ...n, zIndex: 1000 } : n)));
      return () => {
        setNodes((nodes) => nodes.map((n) => (n.id === id ? { ...n, zIndex: undefined } : n)));
      };
    }
  }, [hovered, id, setNodes]);

  useEffect(() => {
    return () => clearTimeout(delayTimer.current);
  }, []);

  const handleMouseEnter = useCallback((e: MouseEvent, name: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const side = centerX > window.innerWidth / 2 ? "left" : "right";
    const next = { name, side } as const;
    pendingHover.current = next;
    clearTimeout(delayTimer.current);
    delayTimer.current = setTimeout(() => setHovered(next), 175);
  }, []);

  const handleMouseLeave = useCallback(() => {
    pendingHover.current = null;
    clearTimeout(delayTimer.current);
    setHovered(null);
  }, []);

  return (
    <div className={styles.table}>
      {/* TODO: show VIEW badge in header when entity is a view */}
      <div className={styles.header} title={data.comment}>
        {data.schema && <span className={styles.schema}>{data.schema}.</span>}
        {data.label}
      </div>
      <div className={styles.columns}>
        {data.columns.map((col) => (
          <div
            key={col.name}
            className={styles.column}
            onMouseEnter={(e) => handleMouseEnter(e, col.name)}
            onMouseLeave={handleMouseLeave}
          >
            <Handle
              type="target"
              position={Position.Left}
              id={`${col.name}-left-target`}
              className={styles.handle}
            />
            <Handle
              type="source"
              position={Position.Left}
              id={`${col.name}-left-source`}
              className={styles.handle}
            />
            <Handle
              type="target"
              position={Position.Right}
              id={`${col.name}-right-target`}
              className={styles.handle}
            />
            <Handle
              type="source"
              position={Position.Right}
              id={`${col.name}-right-source`}
              className={styles.handle}
            />
            <span className={styles.columnName}>
              {col.primaryKey && <span className={`${styles.badge} ${styles.pk}`}>PK</span>}
              {col.unique && <span className={`${styles.badge} ${styles.uq}`}>UQ</span>}
              {col.indexed && <span className={`${styles.badge} ${styles.ix}`}>IX</span>}
              {col.nullable && <span className={`${styles.badge} ${styles.nl}`}>NL</span>}
              {col.name}
            </span>
            <span className={styles.columnType}>{col.type}</span>
            {hovered?.name === col.name && <ColumnTooltip column={col} side={hovered.side} />}
          </div>
        ))}
      </div>
    </div>
  );
});
