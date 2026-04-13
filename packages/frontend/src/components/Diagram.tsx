import {
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeTypes,
  type OnNodesChange,
  ReactFlow,
} from "@xyflow/react";
import { useMemo } from "react";
import "@xyflow/react/dist/style.css";
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
}

export function Diagram({ schema, nodes, onNodesChange }: DiagramProps) {
  const edges: Edge[] = useMemo(() => {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    return schema.relations.map((rel, i) => {
      const srcNode = nodeMap.get(rel.src.table);
      const refNode = nodeMap.get(rel.ref.table);
      const srcX = srcNode?.position.x ?? 0;
      const refX = refNode?.position.x ?? 0;

      const srcSide = srcX < refX ? "right" : "left";
      const refSide = srcX < refX ? "left" : "right";

      return {
        id: `e-${i}`,
        source: rel.src.table,
        target: rel.ref.table,
        sourceHandle: `${rel.src.column}-${srcSide}-source`,
        targetHandle: `${rel.ref.column}-${refSide}-target`,
        type: "relation",
        data: cardinalityLabels(rel.cardinality),
      };
    });
  }, [schema.relations, nodes]);

  return (
    <div className={styles.canvas}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        fitView
        nodesConnectable={false}
        edgesFocusable={false}
        edgesReconnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      />
    </div>
  );
}
