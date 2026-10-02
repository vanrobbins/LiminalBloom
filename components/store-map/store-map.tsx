// The map itself (spec §10): draws the session, nothing more. Pointer
// handlers come in through `svgProps` from use-pointer-input.ts, the single
// place that reads pointer events.

import { worldToScreen, type Camera, type Viewport } from "@/lib/layout/camera";
import { isEditableFixture, type Focus, type HandleSpot } from "@/lib/layout/hit-test";
import type { Drawing } from "@/lib/layout/outline-draw";
import type { Marquee, VertexRef } from "@/lib/layout/session-core";
import type { Guide } from "@/lib/layout/snap";
import { OUTLINE_ID, type Face, type Issue, type Layout, type Point } from "@/lib/layout/types";

import { DrawingOverlay } from "./drawing-overlay";
import { EntranceShape } from "./entrance-shape";
import { FixtureShape } from "./fixture-shape";
import { mapLabel } from "./map-label";
import { OutlineShape } from "./outline-shape";
import { SelectionHandles } from "./selection-handles";
import { SnapGuides } from "./snap-guides";
import { ZoneShape } from "./zone-shape";

type StoreMapProps = {
  layout: Layout;
  camera: Camera;
  viewport: Viewport;
  focus: Focus;
  selection: readonly string[];
  vertex: VertexRef | null;
  issues: readonly Issue[];
  guides: readonly Guide[];
  handles: readonly HandleSpot[];
  drawing: Drawing | null;
  drawPreview: Point | null;
  marquee: Marquee | null;
  svgProps?: React.SVGProps<SVGSVGElement> & { ref?: React.Ref<SVGSVGElement> };
};

export function StoreMap({
  layout,
  camera,
  viewport,
  focus,
  selection,
  vertex,
  issues,
  guides,
  handles,
  drawing,
  drawPreview,
  marquee,
  svgProps,
}: StoreMapProps) {
  const selected = new Set(selection);
  const problems = new Set(issues.map((issue) => issue.itemId));
  const facesOf = new Map<string, Face[]>();
  for (const face of layout.faces) facesOf.set(face.fixtureId, [...(facesOf.get(face.fixtureId) ?? []), face]);
  const box = marquee ? [worldToScreen(camera, marquee.from), worldToScreen(camera, marquee.to)] : null;
  const outline = layout.outline;

  return (
    <svg role="img" aria-label={mapLabel(layout)} className="block size-full touch-none select-none" {...svgProps}>
      <g transform={`scale(${camera.scale}) translate(${-camera.x} ${-camera.y})`}>
        {layout.outline ? (
          <OutlineShape points={layout.outline.points} selected={selected.has(OUTLINE_ID)} problem={problems.has(OUTLINE_ID)} />
        ) : null}
        {layout.zones.map((zone) => (
          <ZoneShape
            key={zone.id}
            zone={zone}
            scale={camera.scale}
            dimmed={focus.kind === "zone" && focus.id !== zone.id}
            selected={selected.has(zone.id)}
            problem={problems.has(zone.id)}
          />
        ))}
        {layout.fixtures.map((fixture) => (
          <FixtureShape
            key={fixture.id}
            fixture={fixture}
            faces={facesOf.get(fixture.id) ?? []}
            scale={camera.scale}
            muted={!isEditableFixture(fixture, focus)}
            selected={selected.has(fixture.id)}
            problem={problems.has(fixture.id)}
          />
        ))}
        {outline
          ? layout.entrances.map((entrance) => (
              <EntranceShape
                key={entrance.id}
                entrance={entrance}
                outline={outline.points}
                selected={selected.has(entrance.id)}
                problem={problems.has(entrance.id)}
              />
            ))
          : null}
      </g>
      <SnapGuides guides={guides} camera={camera} viewport={viewport} />
      <SelectionHandles handles={handles} camera={camera} vertex={vertex} />
      {box ? (
        <rect
          x={Math.min(box[0].x, box[1].x)}
          y={Math.min(box[0].y, box[1].y)}
          width={Math.abs(box[1].x - box[0].x)}
          height={Math.abs(box[1].y - box[0].y)}
          fill="none"
          stroke="var(--brand-strong)"
          strokeDasharray="4 4"
        />
      ) : null}
      {drawing ? <DrawingOverlay drawing={drawing} preview={drawPreview} camera={camera} /> : null}
    </svg>
  );
}
