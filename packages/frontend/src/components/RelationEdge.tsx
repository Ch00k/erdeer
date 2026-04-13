import { type EdgeProps, getSmoothStepPath } from "@xyflow/react";

const SPREAD = 6;
const LENGTH = 7;
const STROKE_PROPS = {
  stroke: "var(--color-relation)",
  strokeWidth: 1,
};

function OneMarker({ x, y, side }: { x: number; y: number; side: "left" | "right" }) {
  const dir = side === "right" ? 1 : -1;
  const lx = x + dir * LENGTH;
  return <line x1={lx} y1={y - SPREAD} x2={lx} y2={y + SPREAD} {...STROKE_PROPS} />;
}

function ManyMarker({ x, y, side }: { x: number; y: number; side: "left" | "right" }) {
  const dir = side === "right" ? 1 : -1;
  const tip = x + dir * LENGTH;
  return (
    <g>
      <line x1={x} y1={y - SPREAD} x2={tip} y2={y} {...STROKE_PROPS} />
      <line x1={x} y1={y + SPREAD} x2={tip} y2={y} {...STROKE_PROPS} />
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

  const srcSide = sourcePosition === "right" ? "right" : "left";
  const refSide = targetPosition === "right" ? "right" : "left";

  const SrcMarker = srcCardinality === "N" ? ManyMarker : OneMarker;
  const RefMarker = refCardinality === "N" ? ManyMarker : OneMarker;

  return (
    <g>
      <path
        id={id}
        d={path}
        fill="none"
        stroke="var(--color-relation)"
        strokeWidth={1}
        style={style}
      />
      <path
        d={path}
        fill="none"
        strokeOpacity={0}
        strokeWidth={20}
        className="react-flow__edge-interaction"
      />
      {srcCardinality && <SrcMarker x={sourceX} y={sourceY} side={srcSide} />}
      {refCardinality && <RefMarker x={targetX} y={targetY} side={refSide} />}
    </g>
  );
}
