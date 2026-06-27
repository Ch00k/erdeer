import { type EdgeProps, getSmoothStepPath } from "@xyflow/react";
import type { MouseEvent } from "react";
import type { EdgeCustomization, EdgeSide } from "../layout.js";

const SPREAD = 6;
const LENGTH = 7;
const FLIP_HANDLE_RADIUS = 10;

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
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const d = (data ?? {}) as RelationEdgeData;
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
