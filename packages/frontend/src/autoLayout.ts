import ELK, { type ElkExtendedEdge, type ElkNode } from "elkjs/lib/elk.bundled.js";
import type { EdgeRoute } from "./layout.js";
import type { Position } from "./types.js";

const elk = new ELK();

export type PortSide = "EAST" | "WEST";

export interface LayoutPort {
  id: string;
  side: PortSide;
  x: number;
  y: number;
}

export interface LayoutNode {
  id: string;
  width: number;
  height: number;
  ports: LayoutPort[];
}

export interface LayoutEdge {
  id: string;
  sourcePort: string;
  targetPort: string;
}

export interface LayoutInput {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
}

export interface LayoutResult {
  positions: Record<string, Position>;
  routes: Record<string, EdgeRoute>;
}

const layoutOptions = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.layered.spacing.nodeNodeBetweenLayers": "140",
  "elk.spacing.nodeNode": "70",
  "elk.spacing.edgeEdge": "15",
  "elk.spacing.edgeNode": "20",
  "elk.layered.spacing.edgeEdgeBetweenLayers": "15",
  "elk.layered.spacing.edgeNodeBetweenLayers": "20",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
};

// Arranges tables left-to-right by relation direction and routes connectors
// orthogonally, separating parallel lines into distinct channels. Ports carry
// each connector's real attach point (column row, left/right side) so ELK's
// routing lines up with the rendered handles.
export async function computeAutoLayout(input: LayoutInput): Promise<LayoutResult> {
  const graph: ElkNode = {
    id: "root",
    layoutOptions,
    children: input.nodes.map((n) => ({
      id: n.id,
      width: n.width,
      height: n.height,
      layoutOptions: n.ports.length > 0 ? { "elk.portConstraints": "FIXED_POS" } : undefined,
      ports: n.ports.map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        layoutOptions: { "elk.port.side": p.side },
      })),
    })),
    edges: input.edges.map((e) => ({
      id: e.id,
      sources: [e.sourcePort],
      targets: [e.targetPort],
    })),
  };

  const result = await elk.layout(graph);

  const positions: Record<string, Position> = {};
  for (const child of result.children ?? []) {
    positions[child.id] = { x: child.x ?? 0, y: child.y ?? 0 };
  }

  const routes: Record<string, EdgeRoute> = {};
  for (const edge of (result.edges ?? []) as ElkExtendedEdge[]) {
    const section = edge.sections?.[0];
    const bends = section?.bendPoints ?? [];
    if (section && bends.length > 0) {
      routes[edge.id] = {
        points: bends.map((p) => ({ x: p.x, y: p.y })),
        src: { x: section.startPoint.x, y: section.startPoint.y },
        ref: { x: section.endPoint.x, y: section.endPoint.y },
      };
    }
  }

  return { positions, routes };
}
