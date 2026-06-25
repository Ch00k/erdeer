import { type EdgeProps, getSmoothStepPath } from "@xyflow/react";

const SPREAD = 6;
const LENGTH = 7;

interface MarkerProps {
  x: number;
  y: number;
  side: "left" | "right";
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

  const srcCardinality = (data?.srcCardinality as string) ?? "";
  const refCardinality = (data?.refCardinality as string) ?? "";
  const highlighted = data?.highlighted === true;

  const srcSide = sourcePosition === "right" ? "right" : "left";
  const refSide = targetPosition === "right" ? "right" : "left";

  const SrcMarker = srcCardinality === "N" ? ManyMarker : OneMarker;
  const RefMarker = refCardinality === "N" ? ManyMarker : OneMarker;

  const stroke = highlighted ? "var(--color-primary)" : "var(--color-relation)";
  const strokeWidth = highlighted ? 1.75 : 1;

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
    </g>
  );
}
