import {
  ControlButton,
  Controls,
  type Node,
  type NodePositionChange,
  type OnNodesChange,
  useReactFlow,
} from "@xyflow/react";
import { useCallback, useState } from "react";
import {
  computeAutoLayout,
  type LayoutEdge,
  type LayoutNode,
  type LayoutPort,
} from "../autoLayout.js";
import { type EdgeLayout, type NodeLayout, relationKey } from "../layout.js";
import type { Relation } from "../types.js";
import { ConfirmDialog } from "./ConfirmDialog.js";
import type { TableNodeData } from "./TableNode.js";

interface DiagramControlsProps {
  readOnly?: boolean;
  relations: Relation[];
  onNodesChange: OnNodesChange<Node<TableNodeData>>;
  onEdgeLayoutReplace: (next: EdgeLayout) => void;
}

interface PortColumn {
  column: string;
  side: "left" | "right";
  kind: "source" | "target";
}

function positionChanges(positions: NodeLayout): NodePositionChange[] {
  return Object.entries(positions).map(([id, position]) => ({
    id,
    type: "position",
    position,
    dragging: false,
  }));
}

const iconProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  // Inline style overrides React Flow's `.react-flow__controls-button svg
  // { fill: currentColor }`, which would otherwise fill these outline icons.
  style: { fill: "none" },
} as const;

function PlusIcon() {
  return (
    <svg {...iconProps}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg {...iconProps}>
      <path d="M5 12h14" />
    </svg>
  );
}

function MaximizeIcon() {
  return (
    <svg {...iconProps}>
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function WorkflowIcon() {
  return (
    <svg {...iconProps}>
      <rect width="8" height="8" x="3" y="3" rx="2" />
      <path d="M7 11v4a2 2 0 0 0 2 2h4" />
      <rect width="8" height="8" x="13" y="13" rx="2" />
    </svg>
  );
}

export function DiagramControls({
  readOnly,
  relations,
  onNodesChange,
  onEdgeLayoutReplace,
}: DiagramControlsProps) {
  const { zoomIn, zoomOut, fitView, getNodes, getInternalNode } =
    useReactFlow<Node<TableNodeData>>();
  const [running, setRunning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ELK arranges nodes and routes connectors orthogonally. Ports are placed at
  // each relation's real handle offset so the routes line up with the handles.
  const run = useCallback(async () => {
    const nodes = getNodes();
    const present = new Set(nodes.map((n) => n.id));

    const portsByNode = new Map<string, Map<string, LayoutPort>>();
    const handleY = (nodeId: string, handleId: string, kind: "source" | "target"): number => {
      const internal = getInternalNode(nodeId);
      const bounds =
        kind === "source"
          ? internal?.internals.handleBounds?.source
          : internal?.internals.handleBounds?.target;
      return bounds?.find((b) => b.id === handleId)?.y ?? 0;
    };
    const ensurePort = (nodeId: string, port: PortColumn): string => {
      const elkSide = port.side === "right" ? "EAST" : "WEST";
      const portId = `${nodeId}::${port.column}-${elkSide}`;
      let ports = portsByNode.get(nodeId);
      if (!ports) {
        ports = new Map();
        portsByNode.set(nodeId, ports);
      }
      if (!ports.has(portId)) {
        const width = getInternalNode(nodeId)?.measured?.width ?? 220;
        const handleId = `${port.column}-${port.side}-${port.kind}`;
        ports.set(portId, {
          id: portId,
          side: elkSide,
          x: port.side === "right" ? width : 0,
          y: handleY(nodeId, handleId, port.kind),
        });
      }
      return portId;
    };

    const routable = relations.filter(
      (rel) =>
        rel.src.table !== rel.ref.table && present.has(rel.src.table) && present.has(rel.ref.table),
    );

    const edges: LayoutEdge[] = routable.map((rel) => ({
      id: relationKey(rel),
      sourcePort: ensurePort(rel.src.table, {
        column: rel.src.column,
        side: "right",
        kind: "source",
      }),
      targetPort: ensurePort(rel.ref.table, {
        column: rel.ref.column,
        side: "left",
        kind: "target",
      }),
    }));

    const layoutNodes: LayoutNode[] = nodes.map((n) => ({
      id: n.id,
      width: n.measured?.width ?? 220,
      height: n.measured?.height ?? 100,
      ports: [...(portsByNode.get(n.id)?.values() ?? [])],
    }));

    setRunning(true);
    try {
      const { positions, routes } = await computeAutoLayout({ nodes: layoutNodes, edges });

      const nextEdges: EdgeLayout = {};
      for (const rel of routable) {
        const key = relationKey(rel);
        const route = routes[key];
        nextEdges[key] = {
          srcSide: "right",
          refSide: "left",
          ...(route && { route }),
        };
      }

      onNodesChange(positionChanges(positions));
      onEdgeLayoutReplace(nextEdges);
      window.requestAnimationFrame(() => fitView({ duration: 300 }));
    } finally {
      setRunning(false);
    }
  }, [getNodes, getInternalNode, fitView, relations, onNodesChange, onEdgeLayoutReplace]);

  return (
    <>
      <Controls showZoom={false} showFitView={false} showInteractive={false}>
        <ControlButton onClick={() => zoomIn()} title="Zoom in">
          <PlusIcon />
        </ControlButton>
        <ControlButton onClick={() => zoomOut()} title="Zoom out">
          <MinusIcon />
        </ControlButton>
        <ControlButton onClick={() => fitView()} title="Fit view">
          <MaximizeIcon />
        </ControlButton>
        {!readOnly && (
          <ControlButton
            onClick={() => setConfirmOpen(true)}
            title="Auto-layout"
            disabled={running}
          >
            <WorkflowIcon />
          </ControlButton>
        )}
      </Controls>

      <ConfirmDialog
        open={confirmOpen}
        title="Auto-layout"
        message="Auto-layout rearranges every table and reroutes all connectors. This can't be undone."
        confirmLabel="Run auto-layout"
        onConfirm={() => {
          setConfirmOpen(false);
          run();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
