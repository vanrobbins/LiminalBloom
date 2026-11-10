// A fixture in its own frame: translated and rotated as one group, so its
// rectangle, face markers and label all turn together (spec §6).

import { bandPath, edgePath, middleOffset } from "@/lib/layout/curves";
import { FIXTURE_FONT, labelAngle } from "@/lib/layout/fixture-labels";
import { FIXTURE_RULES } from "@/lib/layout/fixtures";
import type { Face, Fixture } from "@/lib/layout/types";

type FixtureShapeProps = {
  fixture: Fixture;
  faces: Face[];
  scale: number;
  muted: boolean;
  selected: boolean;
  problem: boolean;
  /** Has room for its name, clear of every other (shownLabels). */
  named: boolean;
};

/** A short bar just inside each displaying side, so you can see which way it faces. */
function faceMarker(f: Fixture, side: Face["side"]) {
  const inset = Math.min(3, f.depth / 6, f.width / 6);
  if (f.curve !== 0 && side === "front") {
    return <path key={side} d={edgePath(f, f.depth / 2 - inset, inset)} fill="none" stroke="var(--ink)" strokeWidth={3} vectorEffect="non-scaling-stroke" />;
  }
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

/** A frame rack: the rail along its length and a post at each end (frame racks spec §2). */
function FrameRail({ fixture: f }: { fixture: Fixture }) {
  const half = f.width / 2;
  const post = Math.min(6, f.depth / 3);
  return (
    <g data-rail aria-hidden="true">
      <line x1={-half + post} y1={0} x2={half - post} y2={0} stroke="var(--ink-muted)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <rect x={-half} y={-post / 2} width={post} height={post} fill="var(--ink-muted)" />
      <rect x={half - post} y={-post / 2} width={post} height={post} fill="var(--ink-muted)" />
    </g>
  );
}

export function FixtureShape({ fixture: f, faces, scale, muted, selected, problem, named }: FixtureShapeProps) {
  const rule = FIXTURE_RULES[f.type];
  const stroke = problem ? "var(--danger)" : selected ? "var(--brand)" : "var(--ink)";
  const common = {
    fill: "var(--surface)",
    stroke,
    strokeWidth: selected || problem ? 2.5 : 1.25,
    strokeDasharray: problem ? "6 4" : selected ? "8 4" : undefined,
    vectorEffect: "non-scaling-stroke" as const,
  };
  return (
    <g
      data-fixture-id={f.id}
      data-fixture-name={f.name}
      data-problem={problem || undefined}
      opacity={muted ? 0.35 : 1}
      transform={`translate(${f.x} ${f.y}) rotate(${f.rotation})`}
    >
      {f.curve !== 0 ? (
        <path data-curved d={bandPath(f)} {...common} />
      ) : rule.round ? (
        <circle r={Math.min(f.width, f.depth) / 2} {...common} />
      ) : (
        <rect x={-f.width / 2} y={-f.depth / 2} width={f.width} height={f.depth} rx={2} {...common} />
      )}
      {f.type === "frame_rack" ? <FrameRail fixture={f} /> : null}
      {faces.map((face) => faceMarker(f, face.side))}
      {named ? (
        <text
          fontSize={FIXTURE_FONT / scale}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--ink)"
          // Through the middle, along the longest edge, never upside down (labelAngle).
          transform={`translate(0 ${middleOffset(f)}) rotate(${labelAngle(f) - f.rotation})`}
          className="pointer-events-none select-none"
        >
          {f.name}
        </text>
      ) : null}
    </g>
  );
}
