import type { Position, Relation } from "./types.js";

export type EdgeSide = "left" | "right";

export type NodeLayout = Record<string, Position>;

export interface EdgeCustomization {
  srcSide?: EdgeSide;
  refSide?: EdgeSide;
}

export type EdgeLayout = Record<string, EdgeCustomization>;

export interface DiagramLayout {
  nodes: NodeLayout;
  edges: EdgeLayout;
}

export function relationKey(rel: Relation): string {
  return `${rel.src.table}.${rel.src.column}->${rel.ref.table}.${rel.ref.column}`;
}

function isPosition(value: unknown): value is Position {
  const pos = value as Position | null;
  return !!pos && typeof pos === "object" && typeof pos.x === "number" && typeof pos.y === "number";
}

// Older diagrams stored layout as a flat map of table name to position. Those
// load as the node map with no edge customizations; the new shape is
// `{ nodes, edges }`. A flat map with a table named `nodes` is still a flat
// map: its `nodes` value is that table's position, not a node map.
export function parseLayout(raw: string | null | undefined): DiagramLayout {
  if (!raw) return { nodes: {}, edges: {} };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { nodes: {}, edges: {} };
  }

  if (!parsed || typeof parsed !== "object") return { nodes: {}, edges: {} };

  const obj = parsed as Record<string, unknown>;
  if (obj.nodes && typeof obj.nodes === "object" && !isPosition(obj.nodes)) {
    return {
      nodes: (obj.nodes as NodeLayout) ?? {},
      edges: (obj.edges as EdgeLayout) ?? {},
    };
  }

  return { nodes: obj as NodeLayout, edges: {} };
}

export function serializeLayout(layout: DiagramLayout): string {
  return JSON.stringify(layout);
}
