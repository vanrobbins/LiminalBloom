// A fixture in its own frame: translated and rotated as one group, so its
// rectangle, face markers and label all turn together (spec §6).

import { FIXTURE_RULES } from "@/lib/layout/fixtures";
import type { Face, Fixture } from "@/lib/layout/types";

type FixtureShapeProps = { fixture: Fixture; faces: Face[]; scale: number; muted: boolean; selected: boolean; problem: boolean };

/** A short bar just inside each displaying side, so you can see which way it faces. */
function faceMarker(f: Fixture, side: Face["side"]) {
  const inset = Math.min(3, f.depth / 6, f.width / 6);
  const w = f.width / 2 - inset;
  const d = f.depth / 2 - inset;
  const ends = {
    front: [-w, d, w, d],
    back: [-w, -d, w, -d],
    left: [-w, -d, -w, d],
    right: [w, -d, w, d],
  } as const;
  if (side === "top") return null;
  const [x1, y1, x2, y2] = ends[side];
  return <line key={side} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink)" strokeWidth={3} vectorEffect="non-scaling-stroke" />;
}

export function FixtureShape({ fixture: f, faces, scale, muted, selected, problem }: FixtureShapeProps) {
  const rule = FIXTURE_RULES[f.type];
  const stroke = problem ? "var(--danger)" : selected ? "var(--brand)" : "var(--ink)";
  const common = {
    fill: "var(--surface)",
    stroke,
    strokeWidth: selected || problem ? 2.5 : 1.25,
    strokeDasharray: problem ? "6 4" : selected ? "8 4" : undefined,
    vectorEffect: "non-scaling-stroke" as const,
  };
  const labelFits = f.width * scale > 56 && f.depth * scale > 18;
  return (
    <g
      data-fixture-id={f.id}
      data-fixture-name={f.name}
      data-problem={problem || undefined}
      opacity={muted ? 0.35 : 1}
      transform={`translate(${f.x} ${f.y}) rotate(${f.rotation})`}
    >
      {rule.round ? (
        <circle r={Math.min(f.width, f.depth) / 2} {...common} />
      ) : (
        <rect x={-f.width / 2} y={-f.depth / 2} width={f.width} height={f.depth} rx={2} {...common} />
      )}
      {faces.map((face) => faceMarker(f, face.side))}
      {labelFits ? (
        <text
          fontSize={12 / scale}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--ink)"
          // Counter-rotate so the name always reads upright.
          transform={`rotate(${-f.rotation})`}
          className="pointer-events-none select-none"
        >
          {f.name}
        </text>
      ) : null}
    </g>
  );
}
