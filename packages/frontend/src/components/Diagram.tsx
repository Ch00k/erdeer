import {
  Controls,
  type Edge,
  type EdgeMouseHandler,
  type EdgeTypes,
  type Node,
  type NodeTypes,
  type OnNodesChange,
  ReactFlow,
} from "@xyflow/react";
import { useCallback, useMemo, useState } from "react";
import "@xyflow/react/dist/style.css";
import { type EdgeCustomization, type EdgeLayout, relationKey } from "../layout.js";
import { useTheme } from "../theme.js";
import type { Relation, Schema } from "../types.js";
import styles from "./Diagram.module.css";
import { RelationEdge } from "./RelationEdge.js";
import { TableNode, type TableNodeData } from "./TableNode.js";

const nodeTypes: NodeTypes = {
  table: TableNode,
};

const edgeTypes: EdgeTypes = {
  relation: RelationEdge,
};

function cardinalityLabels(cardinality: Relation["cardinality"]): {
  srcCardinality: string;
  refCardinality: string;
} {
  switch (cardinality) {
    case "one-to-one":
      return { srcCardinality: "1", refCardinality: "1" };
    case "many-to-one":
      return { srcCardinality: "N", refCardinality: "1" };
    case "many-to-many":
      return { srcCardinality: "N", refCardinality: "N" };
  }
}

interface DiagramProps {
  schema: Schema;
  nodes: Node<TableNodeData>[];
  onNodesChange: OnNodesChange<Node<TableNodeData>>;
  edgeLayout: EdgeLayout;
  onEdgeLayoutChange: (key: string, patch: EdgeCustomization) => void;
  readOnly?: boolean;
}

export function Diagram({
  schema,
  nodes,
  onNodesChange,
  edgeLayout,
  onEdgeLayoutChange,
  readOnly,
}: DiagramProps) {
  const { resolvedTheme } = useTheme();
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const edges: Edge[] = useMemo(() => {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    return schema.relations.map((rel) => {
      const key = relationKey(rel);
      const custom = edgeLayout[key] ?? {};
      const srcNode = nodeMap.get(rel.src.table);
      const refNode = nodeMap.get(rel.ref.table);
      const srcX = srcNode?.position.x ?? 0;
      const refX = refNode?.position.x ?? 0;

      const srcSide = custom.srcSide ?? (srcX < refX ? "right" : "left");
      const refSide = custom.refSide ?? (srcX < refX ? "left" : "right");

      const highlighted = key === selectedEdgeId;

      return {
        id: key,
        source: rel.src.table,
        target: rel.ref.table,
        sourceHandle: `${rel.src.column}-${srcSide}-source`,
        targetHandle: `${rel.ref.column}-${refSide}-target`,
        type: "relation",
        data: {
          ...cardinalityLabels(rel.cardinality),
          highlighted,
          relKey: key,
          editable: !readOnly,
          onFlip: onEdgeLayoutChange,
        },
        zIndex: highlighted ? 1 : 0,
      };
    });
  }, [schema.relations, nodes, selectedEdgeId, edgeLayout, readOnly, onEdgeLayoutChange]);

  const onEdgeClick = useCallback<EdgeMouseHandler>((_event, edge) => {
    setSelectedEdgeId((current) => (current === edge.id ? null : edge.id));
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedEdgeId(null);
  }, []);

  return (
    <div className={styles.canvas}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        colorMode={resolvedTheme}
        fitView
        minZoom={0.1}
        nodesConnectable={false}
        nodesDraggable={!readOnly}
        edgesFocusable={false}
        edgesReconnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
