import { type EdgeProps, getSmoothStepPath } from "@xyflow/react";
import type { MouseEvent } from "react";
import type { EdgeCustomization, EdgeRoute, EdgeSide } from "../layout.js";
import type { Position } from "../types.js";

const SPREAD = 6;
const LENGTH = 7;
const FLIP_HANDLE_RADIUS = 10;
const CORNER_RADIUS = 8;
const ANCHOR_TOLERANCE = 2;

function near(x: number, y: number, p: Position): boolean {
  return Math.abs(x - p.x) <= ANCHOR_TOLERANCE && Math.abs(y - p.y) <= ANCHOR_TOLERANCE;
}

// Builds an orthogonal path through the given points, rounding interior corners.
function routedPath(points: Position[]): string {
  if (points.length < 2) return "";

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const corner = points[i];
    const next = points[i + 1];
    const inLen = Math.hypot(corner.x - prev.x, corner.y - prev.y);
    const outLen = Math.hypot(next.x - corner.x, next.y - corner.y);
    const r = Math.min(CORNER_RADIUS, inLen / 2, outLen / 2);
    const before = {
      x: corner.x - ((corner.x - prev.x) / inLen) * r,
      y: corner.y - ((corner.y - prev.y) / inLen) * r,
    };
    const after = {
      x: corner.x + ((next.x - corner.x) / outLen) * r,
      y: corner.y + ((next.y - corner.y) / outLen) * r,
    };
    d += ` L ${before.x} ${before.y} Q ${corner.x} ${corner.y} ${after.x} ${after.y}`;
  }
  const end = points[points.length - 1];
  d += ` L ${end.x} ${end.y}`;

  return d;
}

interface MarkerProps {
  x: number;
  y: number;
  side: EdgeSide;
  stroke: string;
  strokeWidth: number;
}

function OneMarker({ x, y, side, stroke, strokeWidth }: MarkerProps) {
  const dir = side === "right" ? 1 : -1;
  const lx = x + dir * LENGTH;
  return (
    <line
      x1={lx}
      y1={y - SPREAD}
      x2={lx}
      y2={y + SPREAD}
      stroke={stroke}
      strokeWidth={strokeWidth}
    />
  );
}

function ManyMarker({ x, y, side, stroke, strokeWidth }: MarkerProps) {
  const dir = side === "right" ? 1 : -1;
  const tip = x + dir * LENGTH;
  return (
    <g>
      <line x1={x} y1={y - SPREAD} x2={tip} y2={y} stroke={stroke} strokeWidth={strokeWidth} />
      <line x1={x} y1={y + SPREAD} x2={tip} y2={y} stroke={stroke} strokeWidth={strokeWidth} />
    </g>
  );
}

type RelationEdgeData = {
  srcCardinality?: string;
  refCardinality?: string;
  highlighted?: boolean;
  editable?: boolean;
  relKey?: string;
  onFlip?: (key: string, patch: EdgeCustomization) => void;
  route?: EdgeRoute;
};

function FlipHandle({ x, y, onClick }: { x: number; y: number; onClick: (e: MouseEvent) => void }) {
  return (
    <circle
      cx={x}
      cy={y}
      r={FLIP_HANDLE_RADIUS}
      fill="transparent"
      style={{ cursor: "pointer", pointerEvents: "all" }}
      onClick={onClick}
    >
      <title>Flip to the other side</title>
    </circle>
  );
}

export function RelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  data,
}: EdgeProps) {
  const d = (data ?? {}) as RelationEdgeData;

  // A routed path is drawn only while the live handle positions still match the
  // anchors the route was computed for. A moved, resized, or re-columned table
  // shifts a handle, so the edge falls back to a direct smooth-step path until
  // the next auto-layout.
  const route = d.route;
  const path =
    route &&
    route.points.length > 0 &&
    near(sourceX, sourceY, route.src) &&
    near(targetX, targetY, route.ref)
      ? routedPath([{ x: sourceX, y: sourceY }, ...route.points, { x: targetX, y: targetY }])
      : getSmoothStepPath({
          sourceX,
          sourceY,
          targetX,
          targetY,
          sourcePosition,
          targetPosition,
        })[0];

  const srcCardinality = d.srcCardinality ?? "";
  const refCardinality = d.refCardinality ?? "";
  const highlighted = d.highlighted === true;

  const srcSide: EdgeSide = sourcePosition === "right" ? "right" : "left";
  const refSide: EdgeSide = targetPosition === "right" ? "right" : "left";

  const SrcMarker = srcCardinality === "N" ? ManyMarker : OneMarker;
  const RefMarker = refCardinality === "N" ? ManyMarker : OneMarker;

  const stroke = highlighted ? "var(--color-primary)" : "var(--color-relation)";
  const strokeWidth = highlighted ? 1.75 : 1;

  const showFlipHandles = highlighted && d.editable === true && !!d.onFlip && !!d.relKey;

  const flip = (end: "src" | "ref") => (e: MouseEvent) => {
    e.stopPropagation();
    if (!d.onFlip || !d.relKey) return;
    if (end === "src") {
      d.onFlip(d.relKey, { srcSide: srcSide === "right" ? "left" : "right" });
    } else {
      d.onFlip(d.relKey, { refSide: refSide === "right" ? "left" : "right" });
    }
  };

  return (
    <g>
      <path id={id} d={path} fill="none" stroke={stroke} strokeWidth={strokeWidth} style={style} />
      <path
        d={path}
        fill="none"
        strokeOpacity={0}
        strokeWidth={20}
        className="react-flow__edge-interaction"
      />
      {srcCardinality && (
        <SrcMarker
          x={sourceX}
          y={sourceY}
          side={srcSide}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      )}
      {refCardinality && (
        <RefMarker
          x={targetX}
          y={targetY}
          side={refSide}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      )}
      {showFlipHandles && (
        <>
          <FlipHandle
            x={sourceX + (srcSide === "right" ? LENGTH : -LENGTH) / 2}
            y={sourceY}
            onClick={flip("src")}
          />
          <FlipHandle
            x={targetX + (refSide === "right" ? LENGTH : -LENGTH) / 2}
            y={targetY}
            onClick={flip("ref")}
          />
        </>
      )}
    </g>
  );
}
